/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleGarmentQueue, handleWardrobeApi, WardrobeEnv, WardrobeQueueBatch } from "./wardrobe-api";
import { enforceProductionHttps, handleGoogleAuth } from "./google-auth";
import { guardAdminPage, handleAdminApi } from "./admin-api";

interface Env extends WardrobeEnv {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function secured(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("content-security-policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  if (new URL(request.url).protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const httpsRedirect = enforceProductionHttps(request);
    if (httpsRedirect) return secured(httpsRedirect, request);
    const url = new URL(request.url);
    if (url.hostname === "admin.forme.gallery") {
      const canonical = new URL(request.url);
      canonical.hostname = "forme.gallery";
      canonical.pathname = url.pathname === "/" ? "/admin" : url.pathname;
      return secured(Response.redirect(canonical, 308), request);
    }

    const authResponse = await handleGoogleAuth(request, env);
    if (authResponse) return secured(authResponse, request);

    const adminGuard = await guardAdminPage(request, env);
    if (adminGuard) return secured(adminGuard, request);

    const adminResponse = await handleAdminApi(request, env);
    if (adminResponse) return secured(adminResponse, request);

    const apiResponse = await handleWardrobeApi(request, env, ctx);
    if (apiResponse) return secured(apiResponse, request);

    if (url.pathname === "/forme-social-instagram-v1.gif") {
      const assetUrl = new URL(url);
      const assetResponse = await env.ASSETS.fetch(
        new Request(assetUrl, { method: "GET" }),
      );
      const body = await assetResponse.arrayBuffer();
      const headers = new Headers(assetResponse.headers);
      headers.set("content-type", "image/gif");
      headers.set("content-length", String(body.byteLength));
      headers.set("cache-control", "public, max-age=315360000, immutable");
      headers.set("access-control-allow-origin", "*");
      headers.set("cross-origin-resource-policy", "cross-origin");
      return secured(new Response(request.method === "HEAD" ? null : body, {
        status: assetResponse.status,
        headers,
      }), request);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return secured(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          if (!env.IMAGES) return new Response(body);
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths), request);
    }

    return secured(await handler.fetch(request, env, ctx), request);
  },
  async queue(batch: WardrobeQueueBatch, env: Env): Promise<void> {
    await handleGarmentQueue(batch, env);
  },
};

export default worker;
