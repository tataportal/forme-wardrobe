/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  WARDROBE_MEDIA?: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
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

    if (url.pathname === "/api/upload" && request.method === "POST") {
      if (!env.WARDROBE_MEDIA) return Response.json({ error: "Upload storage is not available locally." }, { status: 503 });
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "A valid image is required." }, { status: 400 });
      const id = crypto.randomUUID();
      const key = `wardrobe/${id}`;
      await env.WARDROBE_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { filename: file.name } });
      return Response.json({ id, url: `/api/media/${id}` });
    }

    if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
      if (!env.WARDROBE_MEDIA) return new Response("Not found", { status: 404 });
      const id = url.pathname.split("/").pop();
      const object = id ? await env.WARDROBE_MEDIA.get(`wardrobe/${id}`) : null;
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "private, max-age=31536000");
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
