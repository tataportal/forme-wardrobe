export interface WardrobeEnv {
  DB?: D1Database;
  WARDROBE_MEDIA?: R2Bucket;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_IMAGE_QUALITY?: string;
  FORME_OPS_TOKEN?: string;
  FORME_OWNER_EMAIL?: string;
}

export interface WardrobeExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type Identity = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type GarmentRow = {
  id: string;
  owner_id: string;
  client_id: string;
  name: string;
  brand: string;
  category: string;
  color_family: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
  favorite: number;
  deleted: number;
  status: string;
  source_image_key: string | null;
  generated_image_key: string | null;
  image_key: string | null;
  open_image_key: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

type ProcessingJobRow = {
  id: string;
  garment_id: string;
  status: string;
  provider: string;
  attempt: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type GarmentPayload = {
  name: string;
  brand: string;
  category: string;
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
  favorite: boolean;
  tags: string[];
};

type ImageQuality = "low" | "medium";
type GarmentPresentation = "auto" | "open" | "closed";
type GarmentOutputVariant = "closed" | "open";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const categories = new Set(["Outerwear", "Tops", "Bottoms", "Tailoring"]);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const garmentColumns = `
  id, owner_id, client_id, name, brand, category, color_family, tone, material,
  finish, silhouette, favorite, deleted, status, source_image_key, generated_image_key,
  image_key, open_image_key, revision, created_at, updated_at
`;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function apiError(message: string, status: number): Response {
  return json({ error: message }, status);
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, 160) : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function imageQuality(value: unknown, fallback: ImageQuality = "medium"): ImageQuality {
  return value === "low" || value === "medium" ? value : fallback;
}

function garmentPresentation(value: unknown): GarmentPresentation {
  return value === "open" || value === "closed" ? value : "auto";
}

function safeClientId(value: string): string | null {
  const id = value.trim();
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
}

function tagsValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, string>();
  for (const item of value) {
    const tag = textValue(item).replace(/^#/, "").slice(0, 40);
    if (tag) unique.set(tag.toLocaleLowerCase(), tag);
    if (unique.size >= 20) break;
  }
  return [...unique.values()];
}

function payloadFrom(value: unknown, fallback?: Partial<GarmentPayload>): GarmentPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const category = textValue(body.category, fallback?.category ?? "Outerwear");
  if (!categories.has(category)) return null;
  return {
    name: textValue(body.name, fallback?.name ?? "Prenda sin nombre") || "Prenda sin nombre",
    brand: textValue(body.brand, fallback?.brand ?? ""),
    category,
    colorFamily: textValue(body.colorFamily, fallback?.colorFamily ?? "Other") || "Other",
    tone: textValue(body.tone, fallback?.tone ?? "Unclassified") || "Unclassified",
    material: textValue(body.material, fallback?.material ?? "Cotton") || "Cotton",
    finish: textValue(body.finish, fallback?.finish ?? "Matte") || "Matte",
    silhouette: textValue(body.silhouette, fallback?.silhouette ?? "Regular") || "Regular",
    favorite: body.favorite === undefined ? Boolean(fallback?.favorite) : booleanValue(body.favorite),
    tags: body.tags === undefined ? fallback?.tags ?? [] : tagsValue(body.tags),
  };
}

function decodeHeader(value: string | null, encoding: string | null): string {
  if (!value) return "";
  if (!["url", "percent-encoded-utf-8"].includes(encoding?.toLocaleLowerCase() ?? "")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.toLocaleLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function identify(request: Request): Promise<Identity | null> {
  const headers = request.headers;
  let email = headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase() ?? "";
  let displayName = decodeHeader(
    headers.get("oai-authenticated-user-full-name"),
    headers.get("oai-authenticated-user-full-name-encoding"),
  ).trim();
  const avatarUrl = headers.get("oai-authenticated-user-picture")?.trim() || null;
  const hostname = new URL(request.url).hostname;

  if (!email && localHosts.has(hostname)) {
    email = "local@forme.test";
    displayName = displayName || "Tata";
  }
  if (!email) return null;
  return {
    id: `usr_${(await hash(email)).slice(0, 28)}`,
    email,
    displayName: displayName || email.split("@")[0] || "Mi perfil",
    avatarUrl,
  };
}

async function ensureUser(db: D1Database, identity: Identity): Promise<void> {
  await db.prepare(`
    INSERT INTO users (id, email, display_name, avatar_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = CURRENT_TIMESTAMP
  `).bind(identity.id, identity.email, identity.displayName, identity.avatarUrl).run();
}

async function authenticated(request: Request, env: WardrobeEnv): Promise<{ db: D1Database; identity: Identity } | Response> {
  if (!env.DB) return apiError("La base de datos todavía no está conectada.", 503);
  const identity = await identify(request);
  if (!identity) return apiError("Inicia sesión para abrir tu armario.", 401);
  await ensureUser(env.DB, identity);
  return { db: env.DB, identity };
}

function garmentJson(row: GarmentRow, tags: string[] = []) {
  const revision = row.revision || 1;
  return {
    serverId: row.id,
    id: row.client_id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    colorFamily: row.color_family,
    tone: row.tone,
    material: row.material,
    finish: row.finish,
    silhouette: row.silhouette,
    favorite: Boolean(row.favorite),
    deleted: Boolean(row.deleted),
    tags,
    status: row.status,
    image: row.image_key ? `/api/media/${encodeURIComponent(row.client_id)}/cutout?v=${revision}` : undefined,
    generatedImage: row.generated_image_key ? `/api/media/${encodeURIComponent(row.client_id)}/generated?v=${revision}` : undefined,
    originalImage: row.source_image_key ? `/api/media/${encodeURIComponent(row.client_id)}/original?v=${revision}` : undefined,
    openImage: row.open_image_key ? `/api/media/${encodeURIComponent(row.client_id)}/open?v=${revision}` : undefined,
    revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findGarment(db: D1Database, ownerId: string, clientId: string): Promise<GarmentRow | null> {
  return db.prepare(`SELECT ${garmentColumns} FROM garments WHERE owner_id = ? AND client_id = ? LIMIT 1`)
    .bind(ownerId, clientId)
    .first<GarmentRow>();
}

async function garmentTagsFor(db: D1Database, garmentId: string): Promise<string[]> {
  const result = await db.prepare("SELECT tag FROM garment_tags WHERE garment_id = ? ORDER BY tag COLLATE NOCASE")
    .bind(garmentId)
    .all<{ tag: string }>();
  return result.results.map((row) => row.tag);
}

async function getWardrobe(db: D1Database, ownerId: string): Promise<Response> {
  const garmentsResult = await db.prepare(`SELECT ${garmentColumns} FROM garments WHERE owner_id = ? ORDER BY updated_at DESC`)
    .bind(ownerId)
    .all<GarmentRow>();
  const tagsResult = await db.prepare(`
    SELECT garment_tags.garment_id, garment_tags.tag
    FROM garment_tags
    INNER JOIN garments ON garments.id = garment_tags.garment_id
    WHERE garments.owner_id = ?
    ORDER BY garment_tags.tag COLLATE NOCASE
  `).bind(ownerId).all<{ garment_id: string; tag: string }>();
  const grouped = new Map<string, string[]>();
  for (const row of tagsResult.results) grouped.set(row.garment_id, [...(grouped.get(row.garment_id) ?? []), row.tag]);
  return json({ garments: garmentsResult.results.map((row) => garmentJson(row, grouped.get(row.id) ?? [])) });
}

async function saveGarment(db: D1Database, ownerId: string, clientId: string, payload: GarmentPayload): Promise<GarmentRow> {
  const existing = await findGarment(db, ownerId, clientId);
  const garmentId = existing?.id ?? crypto.randomUUID();
  const statements = [
    db.prepare(`
      INSERT INTO garments (
        id, owner_id, client_id, name, brand, category, color_family, tone,
        material, finish, silhouette, favorite, deleted, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ready')
      ON CONFLICT(owner_id, client_id) DO UPDATE SET
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        color_family = excluded.color_family,
        tone = excluded.tone,
        material = excluded.material,
        finish = excluded.finish,
        silhouette = excluded.silhouette,
        favorite = excluded.favorite,
        deleted = 0,
        revision = garments.revision + 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      garmentId,
      ownerId,
      clientId,
      payload.name,
      payload.brand,
      payload.category,
      payload.colorFamily,
      payload.tone,
      payload.material,
      payload.finish,
      payload.silhouette,
      payload.favorite ? 1 : 0,
    ),
    db.prepare("DELETE FROM garment_tags WHERE garment_id = ?").bind(garmentId),
    ...payload.tags.map((tag) => db.prepare("INSERT INTO garment_tags (garment_id, tag) VALUES (?, ?)").bind(garmentId, tag)),
  ];
  await db.batch(statements);
  const saved = await findGarment(db, ownerId, clientId);
  if (!saved) throw new Error("No se pudo leer la prenda guardada.");
  return saved;
}

function extensionFor(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return byType[file.type.toLocaleLowerCase()] ?? "img";
}

function formPayload(form: FormData): GarmentPayload | null {
  let tags: unknown = [];
  const rawTags = form.get("tags");
  if (typeof rawTags === "string" && rawTags) {
    try {
      tags = JSON.parse(rawTags);
    } catch {
      tags = rawTags.split(",");
    }
  }
  return payloadFrom({
    name: form.get("name"),
    brand: form.get("brand"),
    category: form.get("category"),
    colorFamily: form.get("colorFamily"),
    tone: form.get("tone"),
    material: form.get("material"),
    finish: form.get("finish"),
    silhouette: form.get("silhouette"),
    favorite: form.get("favorite"),
    tags,
  });
}

async function createProcessingJob(
  db: D1Database,
  ownerId: string,
  garmentId: string,
  enabled: boolean,
  quality: ImageQuality,
): Promise<{ id: string; status: string }> {
  const id = crypto.randomUUID();
  const status = enabled ? "queued" : "waiting_for_key";
  await db.batch([
    db.prepare(`
      INSERT INTO processing_jobs (id, garment_id, owner_id, status, provider)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, garmentId, ownerId, status, `openai+cloudflare:${quality}`),
    db.prepare("UPDATE garments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
      .bind(enabled ? "queued" : "uploaded", garmentId, ownerId),
  ]);
  return { id, status };
}

async function uploadGarment(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
  db: D1Database,
  identity: Identity,
): Promise<Response> {
  if (!env.WARDROBE_MEDIA) return apiError("El almacenamiento de imágenes todavía no está conectado.", 503);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return apiError("Selecciona una foto válida.", 400);
  if (file.size > MAX_IMAGE_BYTES) return apiError("La foto pesa demasiado. El máximo es 20 MB.", 413);
  const payload = formPayload(form);
  if (!payload) return apiError("Revisa el tipo y los datos de la prenda.", 400);

  const clientId = crypto.randomUUID();
  const garmentId = crypto.randomUUID();
  const sourceKey = `users/${identity.id}/garments/${clientId}/original.${extensionFor(file)}`;
  await env.WARDROBE_MEDIA.put(sourceKey, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { filename: file.name.slice(0, 160), owner: identity.id, garment: clientId },
  });

  try {
    await db.prepare(`
      INSERT INTO garments (
        id, owner_id, client_id, name, brand, category, color_family, tone,
        material, finish, silhouette, favorite, status, source_image_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)
    `).bind(
      garmentId,
      identity.id,
      clientId,
      payload.name,
      payload.brand,
      payload.category,
      payload.colorFamily,
      payload.tone,
      payload.material,
      payload.finish,
      payload.silhouette,
      payload.favorite ? 1 : 0,
      sourceKey,
    ).run();
    if (payload.tags.length) {
      await db.batch(payload.tags.map((tag) => db.prepare("INSERT INTO garment_tags (garment_id, tag) VALUES (?, ?)").bind(garmentId, tag)));
    }
  } catch (error) {
    await env.WARDROBE_MEDIA.delete(sourceKey);
    throw error;
  }

  const enabled = Boolean(env.OPENAI_API_KEY && env.IMAGES);
  const quality = imageQuality(env.OPENAI_IMAGE_QUALITY);
  const job = await createProcessingJob(db, identity.id, garmentId, enabled, quality);
  if (enabled) ctx.waitUntil(processGarment(env, db, identity.id, garmentId, job.id, quality));
  const row = await findGarment(db, identity.id, clientId);
  if (!row) throw new Error("No se pudo crear la prenda.");
  return json({ garment: garmentJson(row, payload.tags), job }, 202);
}

function ghostPrompt(garment: GarmentRow, presentation: GarmentPresentation = "auto"): string {
  const isLayerable = garment.category === "Outerwear" || garment.category === "Tailoring";
  const construction = presentation === "open"
    ? `PRESENTATION — OPEN STATE REQUIRED
- Unfasten only the garment's existing front closure and show a small, natural opening suitable for layering.
- Keep both front panels facing the camera. Do not fold back, widen, shorten, stretch or redesign them.
- Preserve every exterior detail in its original position on its original panel. Opening the garment must never erase, move, split, hide or redraw graphics, lettering, patches, pockets or hardware.
- Show only plain matching interior lining inside the opening. Never expose a brand label, care label, size tag, hanger or neck block.`
    : presentation === "closed"
      ? `PRESENTATION — PRESERVE THE CLOSED SOURCE STATE
- Keep the garment in the same closed or naturally continuous construction shown in the source.
- Do not introduce a new opening, exposed lining, closure, collar, cuff, fold or seam.`
      : isLayerable
    ? `PRESENTATION DECISION — FIDELITY OVERRIDES OPENING
- First inspect the exterior. If the garment contains graphics, lettering, embroidery, patches, logos, artwork, strong panel blocking or details near/across the front closure, preserve the source fastening state exactly. Do not open it.
- Open the garment only when it is visually plain around the closure and opening it requires no reconstruction, remapping or invention of exterior details. If uncertain, keep the source fastening state.
- When a safe opening is possible, unfasten only the existing front closure and create a small natural gap. Keep both panels facing the camera; do not fold back, widen, shorten, stretch or redesign them.
- Fidelity is more important than layerability. Never sacrifice, move, split, hide or redraw an exterior detail merely to make the garment open.`
      : `PRESENTATION OF THE CONSTRUCTION
- Keep the garment in its original wearable construction and fastening state.
- Do not introduce an opening, closure, collar, cuff, fold or seam that is not present in the source.`;

  return `IMAGE EDIT — NOT A REDESIGN

GOAL
Turn the attached source photo into one premium, photorealistic ghost-mannequin catalog image. Change only the presentation: remove the environment and invisible support, correct the front-on catalog pose, and place the garment in a clean studio frame. The source garment is the absolute visual source of truth.

GARMENT REFERENCE
- Catalog category: ${garment.category}.
- Catalog name: ${garment.name || "Garment"}. This name is metadata only; never render it as new text.

${construction}

MANDATORY EXTERIOR FIDELITY
- Preserve the exact silhouette, proportions, length, shoulder width, sleeve volume, collar or hood shape, cuffs, hem and drape.
- Preserve every seam, pocket, flap, button, snap, zipper, pull, rib, drawcord, buckle and piece of hardware in the exact position, count, scale, shape and color visible in the source.
- Every exterior graphic is mandatory. Copy all visible prints, embroidery, appliqué, patches, logos, letters, numbers, symbols, characters and artwork exactly as seen: same content, spelling, orientation, color, scale and placement.
- Existing text and branding printed, embroidered or patched on the outside are part of the garment. They must remain visible. Do not censor, translate, correct, replace, reinterpret, simplify, duplicate, recolor or invent them.
- Preserve the original material boundaries and finish, including leather versus textile panels, knit ribs, sheen, wear marks and restrained natural texture.
- If a detail is difficult to read, preserve its visible shapes and placement from the source instead of guessing or replacing it with a lookalike design.

REMOVE ONLY PHOTOGRAPHY ARTIFACTS
- Remove the hanger, hook, rail, bars, wall, switch, room, person, mannequin body, neck block and any floating support.
- Never show an interior brand label, care label, size tag or hanger. Replace only that hidden support/label area with plain matching interior lining; do not erase or alter exterior branding.
- Do not add a shirt, body, neck, styling piece, prop, caption, watermark or new text.

CATALOG OUTPUT
- One garment only, front view, centered with the entire garment visible and comfortable margins in an exact vertical 4:5 composition.
- Neutral pure-white seamless background, soft even studio lighting, controlled subtle shadow and faithful source color.
- Natural restrained texture: no aggressive sharpening, fake grain, added distressing or exaggerated gloss.

FINAL CHECK BEFORE OUTPUT
Compare the result against the source once more. If any exterior graphic, letter, number, patch, logo, hardware item or construction detail is missing or changed, restore it before returning the image.`;
}

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function processGarment(
  env: WardrobeEnv,
  db: D1Database,
  ownerId: string,
  garmentId: string,
  jobId: string,
  quality: ImageQuality,
  presentation: GarmentPresentation = "auto",
  outputVariant: GarmentOutputVariant = "closed",
): Promise<void> {
  if (!env.OPENAI_API_KEY || !env.WARDROBE_MEDIA || !env.IMAGES) return;
  try {
    await db.batch([
      db.prepare("UPDATE processing_jobs SET status = 'processing', attempt = attempt + 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND owner_id = ?")
        .bind(jobId, ownerId),
      db.prepare("UPDATE garments SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(garmentId, ownerId),
    ]);

    const garment = await db.prepare(`SELECT ${garmentColumns} FROM garments WHERE id = ? AND owner_id = ? LIMIT 1`)
      .bind(garmentId, ownerId)
      .first<GarmentRow>();
    if (!garment?.source_image_key) throw new Error("La imagen original no está disponible.");
    const source = await env.WARDROBE_MEDIA.get(garment.source_image_key);
    if (!source) throw new Error("La imagen original no se encontró en el almacenamiento.");
    const sourceBytes = await source.arrayBuffer();
    const contentType = source.httpMetadata?.contentType || "image/jpeg";
    const filename = source.customMetadata?.filename || `garment.${contentType.split("/")[1] || "jpg"}`;

    const form = new FormData();
    form.append("model", env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    form.append("image[]", new File([sourceBytes], filename, { type: contentType }));
    form.append("prompt", ghostPrompt(garment, presentation));
    form.append("size", "1024x1280");
    form.append("quality", quality);
    form.append("output_format", "png");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });
    const result = await response.json() as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string };
    };
    if (!response.ok || !result.data?.[0]?.b64_json) {
      throw new Error(result.error?.message || `El generador respondió con ${response.status}.`);
    }

    const generated = decodeBase64(result.data[0].b64_json);
    const baseKey = `users/${ownerId}/garments/${garment.client_id}`;
    const generatedKey = `${baseKey}/ghost-${outputVariant}-${quality}-${Date.now()}.png`;
    await env.WARDROBE_MEDIA.put(generatedKey, generated, {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { owner: ownerId, garment: garment.client_id, kind: "generated" },
    });

    const segmented = await env.IMAGES
      .input(new Blob([generated], { type: "image/png" }).stream())
      .transform({ segment: "foreground" })
      .output({ format: "image/webp", quality: 92 });
    const segmentedResponse = await segmented.response();
    if (!segmentedResponse.ok) throw new Error(`El recorte respondió con ${segmentedResponse.status}.`);
    const cutout = await segmentedResponse.arrayBuffer();
    const cutoutKey = `${baseKey}/cutout-${outputVariant}-${quality}-${Date.now()}.webp`;
    await env.WARDROBE_MEDIA.put(cutoutKey, cutout, {
      httpMetadata: { contentType: "image/webp" },
      customMetadata: { owner: ownerId, garment: garment.client_id, kind: `cutout-${outputVariant}` },
    });

    const garmentUpdate = outputVariant === "open"
      ? db.prepare(`
        UPDATE garments
        SET status = 'ready', generated_image_key = ?, open_image_key = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(generatedKey, cutoutKey, garmentId, ownerId)
      : db.prepare(`
        UPDATE garments
        SET status = 'ready', generated_image_key = ?, image_key = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(generatedKey, cutoutKey, garmentId, ownerId);
    await db.batch([
      garmentUpdate,
      db.prepare(`
        UPDATE processing_jobs
        SET status = 'succeeded', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = NULL
        WHERE id = ? AND owner_id = ?
      `).bind(jobId, ownerId),
    ]);
  } catch (error) {
    const message = (error instanceof Error ? error.message : "El procesamiento falló.").slice(0, 500);
    await db.batch([
      db.prepare("UPDATE garments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(garmentId, ownerId),
      db.prepare("UPDATE processing_jobs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(message, jobId, ownerId),
    ]);
  }
}

async function retryGarment(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
  db: D1Database,
  identity: Identity,
  clientId: string,
): Promise<Response> {
  const garment = await findGarment(db, identity.id, clientId);
  if (!garment) return apiError("Prenda no encontrada.", 404);
  if (!garment.source_image_key) return apiError("Esta prenda no tiene una foto original para reprocesar.", 400);
  const enabled = Boolean(env.OPENAI_API_KEY && env.IMAGES && env.WARDROBE_MEDIA);
  const body = await request.json().catch(() => null) as { quality?: unknown } | null;
  const quality = imageQuality(body?.quality, imageQuality(env.OPENAI_IMAGE_QUALITY));
  const job = await createProcessingJob(db, identity.id, garment.id, enabled, quality);
  if (enabled) ctx.waitUntil(processGarment(env, db, identity.id, garment.id, job.id, quality));
  return json({ job }, 202);
}

async function garmentStatus(db: D1Database, ownerId: string, clientId: string): Promise<Response> {
  const garment = await findGarment(db, ownerId, clientId);
  if (!garment) return apiError("Prenda no encontrada.", 404);
  const job = await db.prepare(`
    SELECT id, garment_id, status, provider, attempt, error, created_at, updated_at
    FROM processing_jobs
    WHERE garment_id = ? AND owner_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(garment.id, ownerId).first<ProcessingJobRow>();
  const tags = await garmentTagsFor(db, garment.id);
  return json({ garment: garmentJson(garment, tags), job });
}

async function mediaResponse(env: WardrobeEnv, db: D1Database, ownerId: string, clientId: string, variant: string): Promise<Response> {
  if (!env.WARDROBE_MEDIA) return new Response("Not found", { status: 404 });
  const garment = await findGarment(db, ownerId, clientId);
  if (!garment) return new Response("Not found", { status: 404 });
  const keys: Record<string, string | null> = {
    original: garment.source_image_key,
    generated: garment.generated_image_key,
    cutout: garment.image_key,
    open: garment.open_image_key,
  };
  const key = keys[variant];
  if (!key) return new Response("Not found", { status: 404 });
  const object = await env.WARDROBE_MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

async function internalGarmentOperation(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
): Promise<Response> {
  if (!env.FORME_OPS_TOKEN || request.headers.get("x-forme-ops-token") !== env.FORME_OPS_TOKEN) {
    return apiError("Ruta no encontrada.", 404);
  }
  if (!env.DB || !env.WARDROBE_MEDIA) return apiError("El armario todavía no está conectado.", 503);
  const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
  if (!ownerEmail) return apiError("El propietario del armario no está configurado.", 503);
  const identity: Identity = {
    id: `usr_${(await hash(ownerEmail)).slice(0, 28)}`,
    email: ownerEmail,
    displayName: "Tata Portal",
    avatarUrl: null,
  };
  await ensureUser(env.DB, identity);

  if (request.method === "GET") {
    const clientId = safeClientId(new URL(request.url).searchParams.get("clientId") ?? "");
    return clientId ? garmentStatus(env.DB, identity.id, clientId) : apiError("Prenda no válida.", 400);
  }
  if (request.method !== "POST") return apiError("Ruta no encontrada.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return apiError("Selecciona una foto válida.", 400);
  if (file.size > MAX_IMAGE_BYTES) return apiError("La foto pesa demasiado. El máximo es 20 MB.", 413);
  const clientId = safeClientId(textValue(form.get("clientId")));
  if (!clientId) return apiError("La prenda no es válida.", 400);
  const category = textValue(form.get("category"), "Outerwear");
  if (!categories.has(category)) return apiError("El tipo de prenda no es válido.", 400);
  const quality = imageQuality(form.get("quality"));
  const presentation = garmentPresentation(form.get("presentation"));
  const outputVariant: GarmentOutputVariant = form.get("outputVariant") === "open" ? "open" : "closed";
  const existing = await findGarment(env.DB, identity.id, clientId);
  const garmentId = existing?.id ?? crypto.randomUUID();
  const sourceKey = `users/${identity.id}/garments/${clientId}/original-${Date.now()}.${extensionFor(file)}`;
  await env.WARDROBE_MEDIA.put(sourceKey, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { filename: file.name.slice(0, 160), owner: identity.id, garment: clientId },
  });

  await env.DB.prepare(`
    INSERT INTO garments (
      id, owner_id, client_id, name, brand, category, color_family, tone,
      material, finish, silhouette, favorite, deleted, status, source_image_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'uploaded', ?)
    ON CONFLICT(owner_id, client_id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      color_family = excluded.color_family,
      tone = excluded.tone,
      material = excluded.material,
      finish = excluded.finish,
      silhouette = excluded.silhouette,
      deleted = 0,
      status = 'uploaded',
      source_image_key = excluded.source_image_key,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    garmentId,
    identity.id,
    clientId,
    textValue(form.get("name"), existing?.name ?? "Prenda sin nombre") || "Prenda sin nombre",
    existing?.brand ?? "",
    category,
    textValue(form.get("colorFamily"), existing?.color_family ?? "Other") || "Other",
    textValue(form.get("tone"), existing?.tone ?? "Unclassified") || "Unclassified",
    textValue(form.get("material"), existing?.material ?? "Textile") || "Textile",
    textValue(form.get("finish"), existing?.finish ?? "Matte") || "Matte",
    textValue(form.get("silhouette"), existing?.silhouette ?? "Regular") || "Regular",
    existing?.favorite ?? 0,
    sourceKey,
  ).run();

  const enabled = Boolean(env.OPENAI_API_KEY && env.IMAGES);
  const job = await createProcessingJob(env.DB, identity.id, garmentId, enabled, quality);
  if (enabled) {
    ctx.waitUntil(processGarment(env, env.DB, identity.id, garmentId, job.id, quality, presentation, outputVariant));
  }
  return json({ clientId, quality, presentation, outputVariant, job }, 202);
}

async function getOutfits(db: D1Database, ownerId: string): Promise<Response> {
  const outfits = await db.prepare("SELECT id, client_id, name, created_at, updated_at FROM outfits WHERE owner_id = ? ORDER BY updated_at DESC")
    .bind(ownerId)
    .all<{ id: string; client_id: string; name: string; created_at: string; updated_at: string }>();
  const items = await db.prepare(`
    SELECT outfit_items.id, outfit_items.outfit_id, outfit_items.garment_client_id,
      outfit_items.variant, outfit_items.x, outfit_items.y, outfit_items.scale,
      outfit_items.rotation, outfit_items.z
    FROM outfit_items
    INNER JOIN outfits ON outfits.id = outfit_items.outfit_id
    WHERE outfits.owner_id = ?
    ORDER BY outfit_items.z
  `).bind(ownerId).all<{
    id: string;
    outfit_id: string;
    garment_client_id: string;
    variant: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    z: number;
  }>();
  const byOutfit = new Map<string, typeof items.results>();
  for (const item of items.results) byOutfit.set(item.outfit_id, [...(byOutfit.get(item.outfit_id) ?? []), item]);
  return json({
    outfits: outfits.results.map((outfit) => ({
      id: outfit.client_id,
      name: outfit.name,
      createdAt: outfit.created_at,
      updatedAt: outfit.updated_at,
      items: (byOutfit.get(outfit.id) ?? []).map((item) => ({
        instanceId: item.id,
        garmentId: item.garment_client_id,
        variant: item.variant,
        x: item.x / 1000,
        y: item.y / 1000,
        scale: item.scale / 1000,
        rotation: item.rotation / 1000,
        z: item.z,
      })),
    })),
  });
}

async function saveOutfit(request: Request, db: D1Database, ownerId: string, outfitId: string): Promise<Response> {
  const value = await request.json().catch(() => null) as { name?: unknown; items?: unknown } | null;
  if (!value || !Array.isArray(value.items) || value.items.length > 30) return apiError("El conjunto no es válido.", 400);
  const name = textValue(value.name, "Conjunto sin nombre") || "Conjunto sin nombre";
  const items: Array<{
    instanceId: string;
    garmentId: string;
    variant: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    z: number;
  }> = [];
  for (const raw of value.items) {
    if (!raw || typeof raw !== "object") return apiError("Una prenda del conjunto no es válida.", 400);
    const item = raw as Record<string, unknown>;
    const instanceId = safeClientId(textValue(item.instanceId)) ?? crypto.randomUUID();
    const garmentId = safeClientId(textValue(item.garmentId));
    if (!garmentId) return apiError("Una prenda del conjunto no es válida.", 400);
    items.push({
      instanceId,
      garmentId,
      variant: item.variant === "open" ? "open" : "closed",
      x: Math.round(Number(item.x) * 1000),
      y: Math.round(Number(item.y) * 1000),
      scale: Math.round(Number(item.scale) * 1000),
      rotation: Math.round(Number(item.rotation) * 1000),
      z: Math.round(Number(item.z)),
    });
  }
  const existing = await db.prepare("SELECT id FROM outfits WHERE owner_id = ? AND client_id = ? LIMIT 1")
    .bind(ownerId, outfitId)
    .first<{ id: string }>();
  const serverId = existing?.id ?? crypto.randomUUID();
  await db.batch([
    db.prepare(`
      INSERT INTO outfits (id, owner_id, client_id, name) VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_id, client_id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP
    `).bind(serverId, ownerId, outfitId, name),
    db.prepare("DELETE FROM outfit_items WHERE outfit_id = ? AND EXISTS (SELECT 1 FROM outfits WHERE id = ? AND owner_id = ?)")
      .bind(serverId, serverId, ownerId),
    ...items.map((item) => db.prepare(`
      INSERT INTO outfit_items (id, outfit_id, garment_client_id, variant, x, y, scale, rotation, z)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM outfits WHERE id = ? AND owner_id = ?)
    `).bind(
      item.instanceId,
      serverId,
      item.garmentId,
      item.variant,
      item.x,
      item.y,
      item.scale,
      item.rotation,
      item.z,
      serverId,
      ownerId,
    )),
  ]);
  return json({ id: outfitId, name, items });
}

async function deleteOutfit(db: D1Database, ownerId: string, outfitId: string): Promise<Response> {
  const existing = await db.prepare("SELECT id FROM outfits WHERE owner_id = ? AND client_id = ? LIMIT 1")
    .bind(ownerId, outfitId)
    .first<{ id: string }>();
  if (!existing) return apiError("Look no encontrado.", 404);
  await db.batch([
    db.prepare("DELETE FROM outfit_items WHERE outfit_id = ?").bind(existing.id),
    db.prepare("DELETE FROM outfits WHERE id = ? AND owner_id = ?").bind(existing.id, ownerId),
  ]);
  return new Response(null, { status: 204 });
}

export async function handleWardrobeApi(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/internal/garment-operation") {
    return internalGarmentOperation(request, env, ctx);
  }
  const auth = await authenticated(request, env);
  if (auth instanceof Response) return auth;
  const { db, identity } = auth;

  try {
    if (url.pathname === "/api/session" && request.method === "GET") {
      return json({ user: { id: identity.id, name: identity.displayName, handle: `@${identity.email.split("@")[0]}`, avatarUrl: identity.avatarUrl } });
    }
    if (url.pathname === "/api/wardrobe" && request.method === "GET") return getWardrobe(db, identity.id);
    if (url.pathname === "/api/upload" && request.method === "POST") return uploadGarment(request, env, ctx, db, identity);
    if (url.pathname === "/api/outfits" && request.method === "GET") return getOutfits(db, identity.id);

    const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)\/(original|generated|cutout|open)$/);
    if (mediaMatch && request.method === "GET") {
      const clientId = safeClientId(decodeURIComponent(mediaMatch[1]));
      return clientId ? mediaResponse(env, db, identity.id, clientId, mediaMatch[2]) : apiError("Ruta inválida.", 400);
    }

    const statusMatch = url.pathname.match(/^\/api\/garments\/([^/]+)\/status$/);
    if (statusMatch && request.method === "GET") {
      const clientId = safeClientId(decodeURIComponent(statusMatch[1]));
      return clientId ? garmentStatus(db, identity.id, clientId) : apiError("Ruta inválida.", 400);
    }

    const retryMatch = url.pathname.match(/^\/api\/garments\/([^/]+)\/retry$/);
    if (retryMatch && request.method === "POST") {
      const clientId = safeClientId(decodeURIComponent(retryMatch[1]));
      return clientId ? retryGarment(request, env, ctx, db, identity, clientId) : apiError("Ruta inválida.", 400);
    }

    const garmentMatch = url.pathname.match(/^\/api\/garments\/([^/]+)$/);
    if (garmentMatch) {
      const clientId = safeClientId(decodeURIComponent(garmentMatch[1]));
      if (!clientId) return apiError("Ruta inválida.", 400);
      if (request.method === "PUT") {
        const body = await request.json().catch(() => null);
        const payload = payloadFrom(body);
        if (!payload) return apiError("Revisa los datos de la prenda.", 400);
        const row = await saveGarment(db, identity.id, clientId, payload);
        return json({ garment: garmentJson(row, payload.tags) });
      }
      if (request.method === "DELETE") {
        let garment = await findGarment(db, identity.id, clientId);
        if (!garment) {
          const body = await request.json().catch(() => null);
          const payload = payloadFrom(body);
          if (!payload) return apiError("Prenda no encontrada.", 404);
          garment = await saveGarment(db, identity.id, clientId, payload);
        }
        const keys = [garment.source_image_key, garment.generated_image_key, garment.image_key, garment.open_image_key].filter(Boolean) as string[];
        if (garment.source_image_key) {
          await db.prepare("DELETE FROM garments WHERE id = ? AND owner_id = ?").bind(garment.id, identity.id).run();
        } else {
          await db.prepare("UPDATE garments SET deleted = 1, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(garment.id, identity.id)
            .run();
        }
        if (env.WARDROBE_MEDIA && keys.length) ctx.waitUntil(env.WARDROBE_MEDIA.delete(keys));
        return new Response(null, { status: 204 });
      }
    }

    const outfitMatch = url.pathname.match(/^\/api\/outfits\/([^/]+)$/);
    if (outfitMatch && (request.method === "PUT" || request.method === "DELETE")) {
      const outfitId = safeClientId(decodeURIComponent(outfitMatch[1]));
      if (!outfitId) return apiError("Ruta inválida.", 400);
      return request.method === "PUT"
        ? saveOutfit(request, db, identity.id, outfitId)
        : deleteOutfit(db, identity.id, outfitId);
    }
    return apiError("Ruta no encontrada.", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
    return apiError(message.slice(0, 300), 500);
  }
}
