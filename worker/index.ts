/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleGarmentQueue, handleWardrobeApi, WardrobeEnv, WardrobeQueueBatch } from "./wardrobe-api";
import { handleGoogleAuth } from "./google-auth";
import { guardAdminPage, handleAdminApi } from "./admin-api";

interface Env extends WardrobeEnv {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "admin.forme.gallery") {
      const canonical = new URL(request.url);
      canonical.hostname = "forme.gallery";
      canonical.pathname = url.pathname === "/" ? "/admin" : url.pathname;
      return Response.redirect(canonical, 308);
    }

    const authResponse = await handleGoogleAuth(request, env);
    if (authResponse) return authResponse;

    const adminGuard = await guardAdminPage(request, env);
    if (adminGuard) return adminGuard;

    const adminResponse = await handleAdminApi(request, env);
    if (adminResponse) return adminResponse;

    const apiResponse = await handleWardrobeApi(request, env, ctx);
    if (apiResponse) return apiResponse;

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
      return new Response(request.method === "HEAD" ? null : body, {
        status: assetResponse.status,
        headers,
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          if (!env.IMAGES) return new Response(body);
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async queue(batch: WardrobeQueueBatch, env: Env): Promise<void> {
    await handleGarmentQueue(batch, env);
  },
};

export default worker;
