import { readNativeSession } from "./google-auth";
import type { WardrobeEnv } from "./wardrobe-api";

type AdminIdentity = {
  email: string;
};

type AdminJobRow = {
  id: string;
  status: string;
  error: string | null;
  attempt: number;
  quality: string;
  presentation: string;
  output_variant: string;
  mode: string;
  batch_id: string | null;
  prompt: string | null;
  provider_request_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  job_created_at: string;
  job_updated_at: string;
  garment_id: string;
  client_id: string;
  name: string;
  source_image_key: string | null;
  generated_image_key: string | null;
  generated_open_image_key: string | null;
  image_key: string | null;
  open_image_key: string | null;
  qa_status: string;
  qa_notes: string | null;
  garment_created_at: string;
  garment_updated_at: string;
  owner_id: string;
  email: string;
  display_name: string;
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

function requestIdentity(request: Request, sessionSecret?: string): Promise<AdminIdentity | null> {
  const accessEmail = request.headers.get("cf-access-authenticated-user-email")
    ?? request.headers.get("oai-authenticated-user-email");
  if (accessEmail?.trim()) return Promise.resolve({ email: accessEmail.trim().toLocaleLowerCase() });
  return readNativeSession(request, sessionSecret).then((identity) => identity
    ? { email: identity.email.trim().toLocaleLowerCase() }
    : null);
}

async function isOwner(request: Request, env: WardrobeEnv): Promise<boolean> {
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
  const identity = await requestIdentity(request, env.SESSION_SECRET);
  return Boolean(ownerEmail && identity?.email === ownerEmail);
}

export async function guardAdminPage(request: Request, env: WardrobeEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const protectedPath = url.pathname === "/admin"
    || url.pathname.startsWith("/admin/")
    || url.pathname.startsWith("/admin-assets/");
  if (!protectedPath || await isOwner(request, env)) return null;
  const identity = await requestIdentity(request, env.SESSION_SECRET);
  if (identity) {
    return new Response("Esta cuenta no tiene acceso al admin de Formé.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const login = new URL("/auth/google", url.origin);
  login.searchParams.set("return_to", "/admin");
  return Response.redirect(login, 302);
}

function mediaUrl(key: string | null): string | null {
  return key ? `/api/admin/media?key=${encodeURIComponent(key)}` : null;
}

function stageState(status: string, complete: boolean, failed = false) {
  if (failed) return "failed";
  if (complete) return "done";
  if (["queued", "processing", "batch_processing", "waiting_for_key"].includes(status)) return "processing";
  return "pending";
}

function serializeJob(row: AdminJobRow) {
  const finished = row.finished_at ?? (row.status === "succeeded" ? row.garment_updated_at : null);
  const generated = Boolean(row.generated_image_key || row.generated_open_image_key);
  const cutout = Boolean(row.image_key || row.open_image_key);
  const failed = row.status === "failed";
  const qaDone = row.qa_status === "passed";
  const prompt = row.prompt || "El prompt exacto no fue persistido por esta versión del pipeline.";
  return {
    id: row.id.slice(0, 8),
    fullId: row.id,
    account: { id: row.owner_id, name: row.display_name || row.email.split("@")[0], email: row.email },
    sourceName: row.name,
    source: mediaUrl(row.source_image_key),
    generated: mediaUrl(row.generated_image_key),
    generatedOpen: mediaUrl(row.generated_open_image_key),
    normalized: mediaUrl(row.image_key),
    normalizedOpen: mediaUrl(row.open_image_key),
    status: row.status,
    error: row.error,
    promptHistory: [{
      prompt,
      recordedAt: row.started_at ?? row.job_created_at,
      record: row.provider_request_id || `processing_jobs/${row.id}`,
      inputImage: mediaUrl(row.source_image_key),
      outputImage: mediaUrl(row.generated_image_key ?? row.generated_open_image_key),
    }],
    pipeline: [
      { key: "input", label: "Input", state: "done", timestamp: row.garment_created_at },
      { key: "generated", label: "Generación", state: stageState(row.status, generated, failed && !generated), timestamp: generated ? (row.finished_at ?? row.job_updated_at) : row.started_at },
      { key: "approval", label: "Aprobación", state: "skipped", timestamp: null },
      { key: "cutout", label: "Calado", state: stageState(row.status, cutout, failed && generated && !cutout), timestamp: cutout ? row.garment_updated_at : null },
      { key: "qa", label: "QA", state: stageState(row.status, qaDone, row.qa_status === "failed"), timestamp: qaDone ? row.garment_updated_at : null },
      { key: "release", label: "Total", state: stageState(row.status, row.status === "succeeded", failed), timestamp: finished },
    ],
  };
}

async function generations(env: WardrobeEnv): Promise<Response> {
  if (!env.DB) return json({ error: "La base de datos no está conectada." }, 503);
  const result = await env.DB.prepare(`
    SELECT
      j.id, j.status, j.error, j.attempt, j.quality, j.presentation, j.output_variant,
      j.mode, j.batch_id, j.prompt, j.provider_request_id, j.started_at, j.finished_at,
      j.created_at AS job_created_at, j.updated_at AS job_updated_at,
      g.id AS garment_id, g.client_id, g.name, g.source_image_key, g.generated_image_key,
      g.generated_open_image_key, g.image_key, g.open_image_key, g.qa_status, g.qa_notes,
      g.created_at AS garment_created_at, g.updated_at AS garment_updated_at,
      u.id AS owner_id, u.email, u.display_name
    FROM processing_jobs j
    JOIN garments g ON g.id = j.garment_id
    JOIN users u ON u.id = j.owner_id
    ORDER BY j.created_at DESC
    LIMIT 250
  `).all<AdminJobRow>();
  const items = result.results.map(serializeJob);
  const accountMap = new Map<string, { id: string; name: string; email: string; itemCount: number }>();
  for (const item of items) {
    const current = accountMap.get(item.account.id);
    if (current) current.itemCount += 1;
    else accountMap.set(item.account.id, { ...item.account, itemCount: 1 });
  }
  return json({
    id: "PRODUCCIÓN LIVE",
    mode: "live-d1-r2",
    syncedAt: new Date().toISOString(),
    itemCount: items.length,
    accounts: [...accountMap.values()],
    items,
  });
}

async function media(request: Request, env: WardrobeEnv): Promise<Response> {
  if (!env.WARDROBE_MEDIA) return new Response("Not found", { status: 404 });
  const key = new URL(request.url).searchParams.get("key")?.trim();
  if (!key || !key.startsWith("users/")) return new Response("Not found", { status: 404 });
  const object = await env.WARDROBE_MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(object.body, { headers });
}

export async function handleAdminApi(request: Request, env: WardrobeEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin/")) return null;
  if (!await isOwner(request, env)) return json({ error: "Admin no autorizado." }, 403);
  if (request.method === "GET" && url.pathname === "/api/admin/generations") return generations(env);
  if (request.method === "GET" && url.pathname === "/api/admin/media") return media(request, env);
  return json({ error: "Ruta admin inexistente." }, 404);
}
