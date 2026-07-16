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
  processing_image_key: string | null;
  generated_image_key: string | null;
  generated_open_image_key: string | null;
  image_key: string | null;
  open_image_key: string | null;
  quality: string;
  qa_status: string;
  qa_notes: string | null;
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
  quality: string;
  presentation: string;
  output_variant: string;
  mode: string;
  batch_id: string | null;
  openai_file_id: string | null;
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
const BATCH_EXPIRY_SECONDS = 3 * 24 * 60 * 60;
const categories = new Set(["Outerwear", "Tops", "Bottoms", "Tailoring", "Footwear", "Accessories"]);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const garmentColumns = `
  id, owner_id, client_id, name, brand, category, color_family, tone, material,
  finish, silhouette, favorite, deleted, status, source_image_key, processing_image_key,
  generated_image_key, generated_open_image_key, image_key, open_image_key, quality,
  qa_status, qa_notes, revision, created_at, updated_at
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

function imageQuality(value: unknown, fallback: ImageQuality = "low"): ImageQuality {
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
    quality: imageQuality(row.quality),
    qaStatus: row.qa_status,
    qaNotes: row.qa_notes ?? undefined,
    image: row.image_key ? `/api/media/${encodeURIComponent(row.client_id)}/cutout?v=${revision}` : undefined,
    generatedImage: row.generated_image_key ? `/api/media/${encodeURIComponent(row.client_id)}/generated?v=${revision}` : undefined,
    generatedOpenImage: row.generated_open_image_key ? `/api/media/${encodeURIComponent(row.client_id)}/generated-open?v=${revision}` : undefined,
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
  presentation: GarmentPresentation = "auto",
  outputVariant: GarmentOutputVariant = "closed",
  mode: "immediate" | "batch" = "immediate",
): Promise<{ id: string; status: string }> {
  const id = crypto.randomUUID();
  const status = enabled ? (mode === "batch" ? "batch_staged" : "queued") : "waiting_for_key";
  await db.batch([
    db.prepare(`
      INSERT INTO processing_jobs (
        id, garment_id, owner_id, status, provider, quality, presentation, output_variant, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, garmentId, ownerId, status, `openai+client-cutout:${quality}`, quality, presentation, outputVariant, mode),
    db.prepare("UPDATE garments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
      .bind(enabled ? (mode === "batch" ? "batch_staged" : "queued") : "uploaded", garmentId, ownerId),
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
  const original = form.get("original");
  if (original instanceof File && (!original.type.startsWith("image/") || original.size > MAX_IMAGE_BYTES)) {
    return apiError("La foto original no es válida o supera 20 MB.", 413);
  }
  const payload = formPayload(form);
  if (!payload) return apiError("Revisa el tipo y los datos de la prenda.", 400);

  const clientId = crypto.randomUUID();
  const garmentId = crypto.randomUUID();
  const sourceFile = original instanceof File ? original : file;
  const sourceKey = `users/${identity.id}/garments/${clientId}/original.${extensionFor(sourceFile)}`;
  const processingKey = original instanceof File
    ? `users/${identity.id}/garments/${clientId}/processing.${extensionFor(file)}`
    : sourceKey;
  await env.WARDROBE_MEDIA.put(sourceKey, sourceFile.stream(), {
    httpMetadata: { contentType: sourceFile.type || "application/octet-stream" },
    customMetadata: { filename: sourceFile.name.slice(0, 160), owner: identity.id, garment: clientId, kind: "original" },
  });
  if (processingKey !== sourceKey) {
    await env.WARDROBE_MEDIA.put(processingKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { filename: file.name.slice(0, 160), owner: identity.id, garment: clientId, kind: "processing" },
    });
  }

  try {
    await db.prepare(`
      INSERT INTO garments (
        id, owner_id, client_id, name, brand, category, color_family, tone,
        material, finish, silhouette, favorite, status, source_image_key, processing_image_key, quality
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?)
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
      processingKey,
      imageQuality(env.OPENAI_IMAGE_QUALITY),
    ).run();
    if (payload.tags.length) {
      await db.batch(payload.tags.map((tag) => db.prepare("INSERT INTO garment_tags (garment_id, tag) VALUES (?, ?)").bind(garmentId, tag)));
    }
  } catch (error) {
    await env.WARDROBE_MEDIA.delete([...new Set([sourceKey, processingKey])]);
    throw error;
  }

  const enabled = Boolean(env.OPENAI_API_KEY && env.WARDROBE_MEDIA);
  const quality = imageQuality(env.OPENAI_IMAGE_QUALITY);
  const mode = form.get("processingMode") === "batch" ? "batch" : "immediate";
  const job = await createProcessingJob(db, identity.id, garmentId, enabled, quality, "closed", "closed", mode);
  if (enabled && mode === "immediate") ctx.waitUntil(processGarment(env, db, identity.id, garmentId, job.id, quality, "closed", "closed"));
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
- Neutral pure-white flat seamless background, soft even studio lighting and faithful source color.
- No cast shadow, contact shadow, floor shadow, grey halo, vignette or gradient behind the garment. Keep the exterior background uniformly white so it can be removed cleanly.
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
  if (!env.OPENAI_API_KEY || !env.WARDROBE_MEDIA) return;
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
    const processingKey = garment?.processing_image_key || garment?.source_image_key;
    if (!processingKey) throw new Error("La imagen original no está disponible.");
    const source = await env.WARDROBE_MEDIA.get(processingKey);
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

    let cutoutKey: string | null = null;
    if (env.IMAGES) {
      const segmented = await env.IMAGES
        .input(new Blob([generated], { type: "image/png" }).stream())
        .transform({ segment: "foreground" })
        .output({ format: "image/webp", quality: 92 });
      const segmentedResponse = await segmented.response();
      if (!segmentedResponse.ok) throw new Error(`El recorte respondió con ${segmentedResponse.status}.`);
      const cutout = await segmentedResponse.arrayBuffer();
      cutoutKey = `${baseKey}/cutout-${outputVariant}-${quality}-${Date.now()}.webp`;
      await env.WARDROBE_MEDIA.put(cutoutKey, cutout, {
        httpMetadata: { contentType: "image/webp" },
        customMetadata: { owner: ownerId, garment: garment.client_id, kind: `cutout-${outputVariant}` },
      });
    }

    const nextStatus = cutoutKey ? "ready" : "cutout_pending";
    const nextJobStatus = cutoutKey ? "succeeded" : "awaiting_cutout";
    const garmentUpdate = outputVariant === "open"
      ? db.prepare(`
        UPDATE garments
        SET status = ?, generated_open_image_key = ?, open_image_key = COALESCE(?, open_image_key),
          quality = ?, qa_status = 'pending', qa_notes = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(nextStatus, generatedKey, cutoutKey, quality, garmentId, ownerId)
      : db.prepare(`
        UPDATE garments
        SET status = ?, generated_image_key = ?, image_key = COALESCE(?, image_key),
          quality = ?, qa_status = 'pending', qa_notes = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(nextStatus, generatedKey, cutoutKey, quality, garmentId, ownerId);
    await db.batch([
      garmentUpdate,
      db.prepare(`
        UPDATE processing_jobs
        SET status = ?, finished_at = CASE WHEN ? = 'succeeded' THEN CURRENT_TIMESTAMP ELSE finished_at END,
          updated_at = CURRENT_TIMESTAMP, error = NULL
        WHERE id = ? AND owner_id = ?
      `).bind(nextJobStatus, nextJobStatus, jobId, ownerId),
    ]);
  } catch (error) {
    const message = (error instanceof Error ? error.message : "El procesamiento falló.").slice(0, 500);
    const existing = await db.prepare("SELECT image_key FROM garments WHERE id = ? AND owner_id = ? LIMIT 1")
      .bind(garmentId, ownerId)
      .first<{ image_key: string | null }>();
    await db.batch([
      db.prepare("UPDATE garments SET status = ?, qa_status = 'review', qa_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(outputVariant === "open" && existing?.image_key ? "ready" : "failed", message, garmentId, ownerId),
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
  const enabled = Boolean(env.OPENAI_API_KEY && env.WARDROBE_MEDIA);
  const body = await request.json().catch(() => null) as { quality?: unknown; presentation?: unknown; outputVariant?: unknown } | null;
  const quality = imageQuality(body?.quality, imageQuality(env.OPENAI_IMAGE_QUALITY));
  const outputVariant: GarmentOutputVariant = body?.outputVariant === "open" ? "open" : "closed";
  const presentation = outputVariant === "open" ? "open" : garmentPresentation(body?.presentation ?? "closed");
  const job = await createProcessingJob(db, identity.id, garment.id, enabled, quality, presentation, outputVariant);
  if (enabled) ctx.waitUntil(processGarment(env, db, identity.id, garment.id, job.id, quality, presentation, outputVariant));
  return json({ job }, 202);
}

async function attachCutout(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
  db: D1Database,
  identity: Identity,
  clientId: string,
): Promise<Response> {
  if (!env.WARDROBE_MEDIA) return apiError("El almacenamiento de imágenes todavía no está conectado.", 503);
  const garment = await findGarment(db, identity.id, clientId);
  if (!garment) return apiError("Prenda no encontrada.", 404);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !["image/png", "image/webp"].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    return apiError("El recorte no es válido.", 400);
  }
  const outputVariant: GarmentOutputVariant = form.get("outputVariant") === "open" ? "open" : "closed";
  const qaStatus = form.get("qaStatus") === "review" ? "review" : "passed";
  const qaNotes = textValue(form.get("qaNotes")).slice(0, 300);
  const key = `users/${identity.id}/garments/${clientId}/cutout-${outputVariant}-${Date.now()}.${extensionFor(file)}`;
  await env.WARDROBE_MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { filename: file.name.slice(0, 160), owner: identity.id, garment: clientId, kind: `cutout-${outputVariant}` },
  });

  const imageUpdate = outputVariant === "open"
    ? db.prepare(`
      UPDATE garments SET open_image_key = ?, qa_status = CASE WHEN qa_status = 'review' OR ? = 'review' THEN 'review' ELSE 'passed' END,
        qa_notes = CASE WHEN ? = 'review' THEN ? ELSE qa_notes END, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ?
    `).bind(key, qaStatus, qaStatus, qaNotes || "Revisar el borde del recorte.", garment.id, identity.id)
    : db.prepare(`
      UPDATE garments SET image_key = ?, qa_status = ?, qa_notes = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ?
    `).bind(key, qaStatus, qaNotes || null, garment.id, identity.id);
  await db.batch([
    imageUpdate,
    db.prepare(`
      UPDATE processing_jobs SET status = 'succeeded', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = NULL
      WHERE garment_id = ? AND owner_id = ? AND output_variant = ? AND status = 'awaiting_cutout'
    `).bind(garment.id, identity.id, outputVariant),
  ]);

  let openedJob: { id: string; status: string } | null = null;
  if (outputVariant === "closed" && garment.category === "Outerwear" && !garment.open_image_key) {
    const existingOpen = await db.prepare(`
      SELECT id FROM processing_jobs
      WHERE garment_id = ? AND owner_id = ? AND output_variant = 'open'
        AND status IN ('queued', 'processing', 'batch_staged', 'batch_processing', 'awaiting_cutout')
      LIMIT 1
    `).bind(garment.id, identity.id).first<{ id: string }>();
    if (!existingOpen) {
      const enabled = Boolean(env.OPENAI_API_KEY && env.WARDROBE_MEDIA);
      const quality = imageQuality(garment.quality, imageQuality(env.OPENAI_IMAGE_QUALITY));
      openedJob = await createProcessingJob(db, identity.id, garment.id, enabled, quality, "open", "open");
      if (enabled) ctx.waitUntil(processGarment(env, db, identity.id, garment.id, openedJob.id, quality, "open", "open"));
    }
  }

  const pending = await db.prepare(`
    SELECT COUNT(*) AS count FROM processing_jobs
    WHERE garment_id = ? AND owner_id = ?
      AND status IN ('queued', 'processing', 'batch_staged', 'batch_processing', 'awaiting_cutout')
  `).bind(garment.id, identity.id).first<{ count: number }>();
  const nextStatus = Number(pending?.count || 0) > 0 ? "cutout_pending" : "ready";
  await db.prepare("UPDATE garments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
    .bind(nextStatus, garment.id, identity.id)
    .run();
  const updated = await findGarment(db, identity.id, clientId);
  const tags = await garmentTagsFor(db, garment.id);
  return json({ garment: updated ? garmentJson(updated, tags) : null, openJob: openedJob }, 201);
}

async function garmentStatus(db: D1Database, ownerId: string, clientId: string): Promise<Response> {
  const garment = await findGarment(db, ownerId, clientId);
  if (!garment) return apiError("Prenda no encontrada.", 404);
  const job = await db.prepare(`
    SELECT id, garment_id, status, provider, attempt, quality, presentation, output_variant,
      mode, batch_id, openai_file_id, error, created_at, updated_at
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
    "generated-open": garment.generated_open_image_key,
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
    const searchParams = new URL(request.url).searchParams;
    const clientId = safeClientId(searchParams.get("clientId") ?? "");
    if (!clientId) return apiError("Prenda no válida.", 400);
    const variant = searchParams.get("variant");
    return variant && ["original", "generated", "generated-open", "cutout", "open"].includes(variant)
      ? mediaResponse(env, env.DB, identity.id, clientId, variant)
      : garmentStatus(env.DB, identity.id, clientId);
  }
  if (request.method !== "POST") return apiError("Ruta no encontrada.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return apiError("Selecciona una foto válida.", 400);
  if (file.size > MAX_IMAGE_BYTES) return apiError("La foto pesa demasiado. El máximo es 20 MB.", 413);
  const clientId = safeClientId(textValue(form.get("clientId")));
  if (!clientId) return apiError("La prenda no es válida.", 400);
  const outputVariant: GarmentOutputVariant = form.get("outputVariant") === "open" ? "open" : "closed";
  if (form.get("operation") === "attach-cutout") {
    const garment = await findGarment(env.DB, identity.id, clientId);
    if (!garment) return apiError("Prenda no encontrada.", 404);
    const cutoutKey = `users/${identity.id}/garments/${clientId}/cutout-${outputVariant}-manual-${Date.now()}.${extensionFor(file)}`;
    await env.WARDROBE_MEDIA.put(cutoutKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { filename: file.name.slice(0, 160), owner: identity.id, garment: clientId, kind: `cutout-${outputVariant}` },
    });
    const statement = outputVariant === "open"
      ? env.DB.prepare("UPDATE garments SET open_image_key = ?, status = 'ready', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(cutoutKey, garment.id, identity.id)
      : env.DB.prepare("UPDATE garments SET image_key = ?, status = 'ready', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(cutoutKey, garment.id, identity.id);
    await statement.run();
    return json({ clientId, outputVariant, status: "ready" });
  }
  const category = textValue(form.get("category"), "Outerwear");
  if (!categories.has(category)) return apiError("El tipo de prenda no es válido.", 400);
  const quality = imageQuality(form.get("quality"));
  const presentation = garmentPresentation(form.get("presentation"));
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

  const enabled = Boolean(env.OPENAI_API_KEY && env.WARDROBE_MEDIA);
  const job = await createProcessingJob(env.DB, identity.id, garmentId, enabled, quality);
  if (enabled) {
    ctx.waitUntil(processGarment(env, env.DB, identity.id, garmentId, job.id, quality, presentation, outputVariant));
  }
  return json({ clientId, quality, presentation, outputVariant, job }, 202);
}

async function uploadOpenAIFile(env: WardrobeEnv, file: File, purpose: "user_data" | "batch"): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error("Falta la clave de procesamiento.");
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);
  form.append("expires_after[anchor]", "created_at");
  form.append("expires_after[seconds]", String(BATCH_EXPIRY_SECONDS));
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  const result = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || `No se pudo preparar el lote (${response.status}).`);
  return result.id;
}

async function deleteOpenAIFile(env: WardrobeEnv, fileId: string): Promise<void> {
  if (!env.OPENAI_API_KEY || !fileId) return;
  await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
  }).catch(() => null);
}

async function createGarmentBatch(
  request: Request,
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
  db: D1Database,
  identity: Identity,
): Promise<Response> {
  if (!env.OPENAI_API_KEY || !env.WARDROBE_MEDIA) return apiError("El procesamiento todavía no está conectado.", 503);
  const body = await request.json().catch(() => null) as { garmentIds?: unknown } | null;
  const garmentIds = Array.isArray(body?.garmentIds)
    ? [...new Set(body.garmentIds.map((item) => safeClientId(textValue(item))).filter((item): item is string => Boolean(item)))].slice(0, 12)
    : [];
  if (garmentIds.length < 2) return apiError("El lote necesita al menos dos prendas.", 400);

  const batchItems: Array<{ garment: GarmentRow; job: { id: string; quality: ImageQuality; presentation: GarmentPresentation; outputVariant: GarmentOutputVariant }; fileId: string }> = [];
  const sourceFileIds = new Set<string>();
  let batchInputFileId = "";
  try {
    for (const clientId of garmentIds) {
      const garment = await findGarment(db, identity.id, clientId);
      const processingKey = garment?.processing_image_key || garment?.source_image_key;
      if (!garment || !processingKey) continue;
      const source = await env.WARDROBE_MEDIA.get(processingKey);
      if (!source) continue;
      const bytes = await source.arrayBuffer();
      const contentType = source.httpMetadata?.contentType || "image/jpeg";
      const filename = source.customMetadata?.filename || `${clientId}.${contentType.split("/")[1] || "jpg"}`;
      const fileId = await uploadOpenAIFile(env, new File([bytes], filename, { type: contentType }), "user_data");
      sourceFileIds.add(fileId);

      let closedJob = await db.prepare(`
        SELECT id FROM processing_jobs
        WHERE garment_id = ? AND owner_id = ? AND output_variant = 'closed' AND status = 'batch_staged'
        ORDER BY created_at DESC LIMIT 1
      `).bind(garment.id, identity.id).first<{ id: string }>();
      if (!closedJob) closedJob = await createProcessingJob(db, identity.id, garment.id, true, "low", "closed", "closed", "batch");
      batchItems.push({ garment, job: { id: closedJob.id, quality: "low", presentation: "closed", outputVariant: "closed" }, fileId });

      if (garment.category === "Outerwear") {
        const openJob = await createProcessingJob(db, identity.id, garment.id, true, "low", "open", "open", "batch");
        batchItems.push({ garment, job: { id: openJob.id, quality: "low", presentation: "open", outputVariant: "open" }, fileId });
      }
    }
    if (batchItems.length < 2) throw new Error("No encontramos suficientes prendas válidas para el lote.");

    const jsonl = batchItems.map(({ garment, job, fileId }) => JSON.stringify({
      custom_id: job.id,
      method: "POST",
      url: "/v1/images/edits",
      body: {
        model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        images: [{ file_id: fileId }],
        prompt: ghostPrompt(garment, job.presentation),
        size: "1024x1280",
        quality: "low",
        output_format: "png",
      },
    })).join("\n");
    const inputFileId = await uploadOpenAIFile(env, new File([jsonl], `forme-${Date.now()}.jsonl`, { type: "application/jsonl" }), "batch");
    batchInputFileId = inputFileId;
    const response = await fetch("https://api.openai.com/v1/batches", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        input_file_id: inputFileId,
        endpoint: "/v1/images/edits",
        completion_window: "24h",
        output_expires_after: { anchor: "created_at", seconds: BATCH_EXPIRY_SECONDS },
        metadata: { product: "forme", owner: identity.id.slice(0, 48) },
      }),
    });
    const result = await response.json() as { id?: string; status?: string; error?: { message?: string } };
    if (!response.ok || !result.id) throw new Error(result.error?.message || `El lote respondió con ${response.status}.`);
    await db.batch(batchItems.flatMap(({ garment, job, fileId }) => [
      db.prepare(`
        UPDATE processing_jobs SET status = 'batch_processing', batch_id = ?, openai_file_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(result.id, fileId, job.id, identity.id),
      db.prepare("UPDATE garments SET status = 'batch_processing', quality = 'low', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(garment.id, identity.id),
    ]));
    return json({ batch: { id: result.id, status: result.status || "validating", garments: garmentIds.length, requests: batchItems.length } }, 202);
  } catch (error) {
    for (const fileId of sourceFileIds) ctx.waitUntil(deleteOpenAIFile(env, fileId));
    if (batchInputFileId) ctx.waitUntil(deleteOpenAIFile(env, batchInputFileId));
    for (const { garment, job } of batchItems) {
      await db.prepare("UPDATE processing_jobs SET status = 'queued', mode = 'immediate', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
        .bind(job.id, identity.id).run();
      ctx.waitUntil(processGarment(env, db, identity.id, garment.id, job.id, job.quality, job.presentation, job.outputVariant));
    }
    return json({ fallback: "immediate", message: error instanceof Error ? error.message : "El lote pasó al flujo inmediato." }, 202);
  }
}

async function reconcileGarmentBatches(
  env: WardrobeEnv,
  ctx: WardrobeExecutionContext,
  db: D1Database,
  identity: Identity,
): Promise<Response> {
  if (!env.OPENAI_API_KEY || !env.WARDROBE_MEDIA) return json({ batches: [] });
  const pending = await db.prepare(`
    SELECT DISTINCT batch_id FROM processing_jobs
    WHERE owner_id = ? AND batch_id IS NOT NULL AND status = 'batch_processing'
  `).bind(identity.id).all<{ batch_id: string }>();
  const summaries: Array<{ id: string; status: string }> = [];
  for (const { batch_id: batchId } of pending.results) {
    const response = await fetch(`https://api.openai.com/v1/batches/${encodeURIComponent(batchId)}`, {
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });
    const batch = await response.json() as { status?: string; output_file_id?: string | null; error_file_id?: string | null; input_file_id?: string; errors?: { data?: Array<{ message?: string }> } };
    if (!response.ok) continue;
    summaries.push({ id: batchId, status: batch.status || "unknown" });
    if (batch.status === "completed" && batch.output_file_id) {
      const outputResponse = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(batch.output_file_id)}/content`, {
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      });
      if (!outputResponse.ok) continue;
      const lines = (await outputResponse.text()).split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        let item: { custom_id?: string; response?: { status_code?: number; body?: { data?: Array<{ b64_json?: string }>; error?: { message?: string } } }; error?: { message?: string } };
        try { item = JSON.parse(line) as typeof item; } catch { continue; }
        if (!item.custom_id) continue;
        const job = await db.prepare(`
          SELECT id, garment_id, quality, output_variant FROM processing_jobs
          WHERE id = ? AND owner_id = ? AND batch_id = ? AND status = 'batch_processing' LIMIT 1
        `).bind(item.custom_id, identity.id, batchId).first<{ id: string; garment_id: string; quality: string; output_variant: string }>();
        if (!job) continue;
        const garment = await db.prepare(`SELECT ${garmentColumns} FROM garments WHERE id = ? AND owner_id = ? LIMIT 1`)
          .bind(job.garment_id, identity.id).first<GarmentRow>();
        const encoded = item.response?.body?.data?.[0]?.b64_json;
        if (!garment || item.response?.status_code !== 200 || !encoded) {
          const message = item.response?.body?.error?.message || item.error?.message || "La edición del lote falló.";
          await db.prepare("UPDATE processing_jobs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(message.slice(0, 500), job.id, identity.id).run();
          continue;
        }
        const outputVariant: GarmentOutputVariant = job.output_variant === "open" ? "open" : "closed";
        const quality = imageQuality(job.quality);
        const generatedKey = `users/${identity.id}/garments/${garment.client_id}/ghost-${outputVariant}-${quality}-${Date.now()}.png`;
        await env.WARDROBE_MEDIA.put(generatedKey, decodeBase64(encoded), {
          httpMetadata: { contentType: "image/png" },
          customMetadata: { owner: identity.id, garment: garment.client_id, kind: `generated-${outputVariant}` },
        });
        const updateGarment = outputVariant === "open"
          ? db.prepare("UPDATE garments SET generated_open_image_key = ?, status = 'cutout_pending', quality = ?, qa_status = 'pending', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(generatedKey, quality, garment.id, identity.id)
          : db.prepare("UPDATE garments SET generated_image_key = ?, status = 'cutout_pending', quality = ?, qa_status = 'pending', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(generatedKey, quality, garment.id, identity.id);
        await db.batch([
          updateGarment,
          db.prepare("UPDATE processing_jobs SET status = 'awaiting_cutout', updated_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND owner_id = ?")
            .bind(job.id, identity.id),
        ]);
      }
      await db.prepare(`
        UPDATE processing_jobs SET status = 'failed', error = 'No se recibió una imagen para esta solicitud.', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND batch_id = ? AND status = 'batch_processing'
      `).bind(identity.id, batchId).run();
      const sourceFiles = await db.prepare("SELECT DISTINCT openai_file_id FROM processing_jobs WHERE owner_id = ? AND batch_id = ? AND openai_file_id IS NOT NULL")
        .bind(identity.id, batchId).all<{ openai_file_id: string }>();
      for (const file of sourceFiles.results) ctx.waitUntil(deleteOpenAIFile(env, file.openai_file_id));
      if (batch.input_file_id) ctx.waitUntil(deleteOpenAIFile(env, batch.input_file_id));
      ctx.waitUntil(deleteOpenAIFile(env, batch.output_file_id));
    } else if (["failed", "expired", "cancelled"].includes(batch.status || "")) {
      const message = batch.errors?.data?.[0]?.message || "El lote no pudo completarse.";
      await db.batch([
        db.prepare("UPDATE processing_jobs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ? AND batch_id = ? AND status = 'batch_processing'")
          .bind(message.slice(0, 500), identity.id, batchId),
        db.prepare("UPDATE garments SET status = CASE WHEN image_key IS NULL THEN 'failed' ELSE 'ready' END, qa_status = 'review', qa_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ? AND id IN (SELECT garment_id FROM processing_jobs WHERE batch_id = ?)")
          .bind(message.slice(0, 300), identity.id, batchId),
      ]);
    }
  }
  return json({ batches: summaries });
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
    db.prepare("DELETE FROM weekly_plan_entries WHERE owner_id = ? AND outfit_client_id = ?").bind(ownerId, outfitId),
    db.prepare("DELETE FROM outfit_items WHERE outfit_id = ?").bind(existing.id),
    db.prepare("DELETE FROM outfits WHERE id = ? AND owner_id = ?").bind(existing.id, ownerId),
  ]);
  return new Response(null, { status: 204 });
}

async function getWeeklyPlan(db: D1Database, ownerId: string): Promise<Response> {
  const entries = await db.prepare(`
    SELECT plan_date, outfit_client_id, occasion, worn, created_at, updated_at
    FROM weekly_plan_entries
    WHERE owner_id = ?
    ORDER BY plan_date
  `).bind(ownerId).all<{
    plan_date: string;
    outfit_client_id: string;
    occasion: string;
    worn: number;
    created_at: string;
    updated_at: string;
  }>();
  return json({
    entries: entries.results.map((entry) => ({
      date: entry.plan_date,
      outfitId: entry.outfit_client_id,
      occasion: entry.occasion,
      worn: Boolean(entry.worn),
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
  });
}

async function saveWeeklyPlanEntry(
  request: Request,
  db: D1Database,
  ownerId: string,
  planDate: string,
): Promise<Response> {
  const value = await request.json().catch(() => null) as {
    outfitId?: unknown;
    occasion?: unknown;
    worn?: unknown;
  } | null;
  const outfitId = safeClientId(textValue(value?.outfitId));
  if (!outfitId) return apiError("El look no es válido.", 400);
  const outfit = await db.prepare("SELECT 1 FROM outfits WHERE owner_id = ? AND client_id = ? LIMIT 1")
    .bind(ownerId, outfitId)
    .first();
  if (!outfit) return apiError("Look no encontrado.", 404);
  const allowedOccasions = new Set(["daily", "work", "dinner", "event", "weekend"]);
  const requestedOccasion = textValue(value?.occasion, "daily").toLocaleLowerCase();
  const occasion = allowedOccasions.has(requestedOccasion) ? requestedOccasion : "daily";
  const worn = booleanValue(value?.worn);
  const entryId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO weekly_plan_entries (id, owner_id, plan_date, outfit_client_id, occasion, worn)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, plan_date) DO UPDATE SET
      outfit_client_id = excluded.outfit_client_id,
      occasion = excluded.occasion,
      worn = excluded.worn,
      updated_at = CURRENT_TIMESTAMP
  `).bind(entryId, ownerId, planDate, outfitId, occasion, worn ? 1 : 0).run();
  return json({ entry: { date: planDate, outfitId, occasion, worn } });
}

async function deleteWeeklyPlanEntry(db: D1Database, ownerId: string, planDate: string): Promise<Response> {
  await db.prepare("DELETE FROM weekly_plan_entries WHERE owner_id = ? AND plan_date = ?")
    .bind(ownerId, planDate)
    .run();
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
      const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
      return json({ user: {
        id: identity.id,
        name: identity.displayName,
        handle: `@${identity.email.split("@")[0]}`,
        avatarUrl: identity.avatarUrl,
        isOwner: Boolean(ownerEmail && identity.email === ownerEmail),
      } });
    }
    if (url.pathname === "/api/wardrobe" && request.method === "GET") return getWardrobe(db, identity.id);
    if (url.pathname === "/api/upload" && request.method === "POST") return uploadGarment(request, env, ctx, db, identity);
    if (url.pathname === "/api/batches" && request.method === "POST") return createGarmentBatch(request, env, ctx, db, identity);
    if (url.pathname === "/api/batches/status" && request.method === "GET") return reconcileGarmentBatches(env, ctx, db, identity);
    if (url.pathname === "/api/outfits" && request.method === "GET") return getOutfits(db, identity.id);
    if (url.pathname === "/api/week" && request.method === "GET") return getWeeklyPlan(db, identity.id);

    const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)\/(original|generated|generated-open|cutout|open)$/);
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

    const cutoutMatch = url.pathname.match(/^\/api\/garments\/([^/]+)\/cutout$/);
    if (cutoutMatch && request.method === "POST") {
      const clientId = safeClientId(decodeURIComponent(cutoutMatch[1]));
      return clientId ? attachCutout(request, env, ctx, db, identity, clientId) : apiError("Ruta inválida.", 400);
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
        const keys = [
          garment.source_image_key,
          garment.processing_image_key,
          garment.generated_image_key,
          garment.generated_open_image_key,
          garment.image_key,
          garment.open_image_key,
        ].filter(Boolean) as string[];
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
    const weekMatch = url.pathname.match(/^\/api\/week\/(\d{4}-\d{2}-\d{2})$/);
    if (weekMatch && (request.method === "PUT" || request.method === "DELETE")) {
      const planDate = weekMatch[1];
      return request.method === "PUT"
        ? saveWeeklyPlanEntry(request, db, identity.id, planDate)
        : deleteWeeklyPlanEntry(db, identity.id, planDate);
    }
    return apiError("Ruta no encontrada.", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
    return apiError(message.slice(0, 300), 500);
  }
}
