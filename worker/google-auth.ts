export interface GoogleAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

export type NativeIdentity = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type SessionPayload = NativeIdentity & {
  sub: string;
  exp: number;
};

type OAuthState = {
  state: string;
  returnTo: string;
};

const SESSION_COOKIE = "__Host-forme_session";
const STATE_COOKIE = "__Host-forme_oauth_state";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

function authConfigured(env: GoogleAuthEnv): env is Required<GoogleAuthEnv> {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://forme.gallery");
    if (url.origin !== "https://forme.gallery" || url.pathname.startsWith("/auth/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(encodedPayload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(encodedPayload));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSession(payload: SessionPayload, secret: string): Promise<string> {
  const encodedPayload = encodeJson(payload);
  return `${encodedPayload}.${await signPayload(encodedPayload, secret)}`;
}

async function verifySession(value: string, secret: string): Promise<SessionPayload | null> {
  const [encodedPayload, encodedSignature, extra] = value.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(encodedPayload),
  ).catch(() => false);
  if (!valid) return null;
  const payload = decodeJson<SessionPayload>(encodedPayload);
  if (!payload?.email || !payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function authUnavailable(): Response {
  return new Response("El acceso con Google todavía no está configurado.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirectUri(request: Request): string {
  return new URL("/auth/google/callback", request.url).toString();
}

async function startGoogleAuth(request: Request, env: GoogleAuthEnv): Promise<Response> {
  if (!authConfigured(env)) return authUnavailable();
  const url = new URL(request.url);
  const state: OAuthState = { state: randomToken(), returnTo: safeReturnTo(url.searchParams.get("return_to")) };
  const authorization = new URL(AUTHORIZATION_ENDPOINT);
  authorization.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorization.searchParams.set("redirect_uri", redirectUri(request));
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid profile email");
  authorization.searchParams.set("state", state.state);
  authorization.searchParams.set("prompt", "select_account");
  return redirect(authorization.toString(), [secureCookie(STATE_COOKIE, encodeJson(state), 10 * 60)]);
}

async function finishGoogleAuth(request: Request, env: GoogleAuthEnv): Promise<Response> {
  if (!authConfigured(env)) return authUnavailable();
  const url = new URL(request.url);
  const storedState = decodeJson<OAuthState>(cookieValue(request, STATE_COOKIE) ?? "");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!storedState || !state || state !== storedState.state || !code) {
    return new Response("No se pudo verificar el inicio de sesión.", { status: 400 });
  }

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenResponse.ok || !token?.access_token) {
    return new Response("Google no pudo completar el inicio de sesión.", { status: 502 });
  }

  const userResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const user = await userResponse.json().catch(() => null) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  } | null;
  if (!userResponse.ok || !user?.sub || !user.email || user.email_verified !== true) {
    return new Response("No se pudo verificar la cuenta de Google.", { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const session = await createSession({
    sub: user.sub,
    email: user.email.trim().toLocaleLowerCase(),
    displayName: user.name?.trim() || user.email.split("@")[0] || "Mi perfil",
    avatarUrl: user.picture?.trim() || null,
    exp: now + SESSION_TTL_SECONDS,
  }, env.SESSION_SECRET);
  return redirect(storedState.returnTo, [
    secureCookie(STATE_COOKIE, "", 0),
    secureCookie(SESSION_COOKIE, session, SESSION_TTL_SECONDS),
  ]);
}

export async function readNativeSession(request: Request, sessionSecret?: string): Promise<NativeIdentity | null> {
  if (!sessionSecret) return null;
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value) return null;
  const payload = await verifySession(value, sessionSecret);
  if (!payload) return null;
  return { email: payload.email, displayName: payload.displayName, avatarUrl: payload.avatarUrl };
}

export async function handleGoogleAuth(request: Request, env: GoogleAuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/auth/google/start") return startGoogleAuth(request, env);
  if (url.pathname === "/auth/google/callback") return finishGoogleAuth(request, env);
  if (url.pathname === "/auth/logout") {
    return redirect(safeReturnTo(url.searchParams.get("return_to")), [
      secureCookie(SESSION_COOKIE, "", 0),
      secureCookie(STATE_COOKIE, "", 0),
    ]);
  }
  return null;
}
