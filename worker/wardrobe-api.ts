import { readNativeSession } from "./google-auth";
import { garmentTypesByCategory, inferGarmentType, starterGarments } from "../app/garments";

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
  OPENAI_QA_MODEL?: string;
  FORME_OPS_TOKEN?: string;
  FORME_OWNER_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
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
  garment_type: string;
  color_family: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
  favorite: number;
  is_public: number;
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

type IntakeBatchSummary = {
  id: string;
  clientId: string;
  status: string;
  expected: number;
  pending: number;
  uploaded: number;
  processing: number;
  passed: number;
  review: number;
  failed: number;
};

type GarmentPayload = {
  name: string;
  brand: string;
  category: string;
  garmentType: string;
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
  favorite: boolean;
  isPublic: boolean;
  tags: string[];
};

type UserProfileRow = {
  id: string;
  email: string;
  display_name: string;
  handle: string | null;
  bio: string;
  avatar_url: string | null;
  profile_public: number;
  discoverable: number;
  show_closet: number;
  show_looks: number;
};

type ImageQuality = "low" | "medium";
type GarmentPresentation = "auto" | "open" | "closed";
type GarmentOutputVariant = "closed" | "open";
type StyleAudience = "hombre" | "mujer";

type StyleFamilyRatingPayload = {
  family: string;
  affinity: number;
  blocked: boolean;
  reason: string | null;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const BATCH_EXPIRY_SECONDS = 3 * 24 * 60 * 60;
const categories = new Set(["Outerwear", "Tops", "Bottoms", "Tailoring", "Footwear", "Accessories"]);
const garmentTypes = new Set(Object.values(garmentTypesByCategory).flat());
const styleFamilies = new Set([
  "classic",
  "minimal",
  "relaxed",
  "tailored",
  "preppy",
  "streetwear",
  "sporty",
  "utility",
  "romantic",
  "bohemian",
  "rebel",
  "avant_garde",
]);
const styleFeedbackReasons = new Set(["color", "silhouette", "combination", "formality", "expression", "fit", "footwear", "specific"]);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const staticGarmentMedia = new Map(starterGarments.map((garment) => [garment.id, {
  image: garment.image,
  openImage: garment.openImage,
}]));

const garmentColumns = `
  id, owner_id, client_id, name, brand, category, garment_type, color_family, tone, material,
  finish, silhouette, favorite, is_public, deleted, status, source_image_key, processing_image_key,
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

function safeFingerprint(value: unknown): string | null {
  const fingerprint = textValue(value).slice(0, 240);
  return fingerprint && /^[^\u0000-\u001f]+$/.test(fingerprint) ? fingerprint : null;
}

async function intakeBatchSummary(db: D1Database, ownerId: string, clientId: string): Promise<IntakeBatchSummary | null> {
  const batch = await db.prepare(`
    SELECT id, client_id, expected_count, status
    FROM intake_batches WHERE owner_id = ? AND client_id = ? LIMIT 1
  `).bind(ownerId, clientId).first<{ id: string; client_id: string; expected_count: number; status: string }>();
  if (!batch) return null;
  const counts = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) AS uploaded,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM intake_batch_items WHERE batch_id = ?
  `).bind(batch.id).first<Record<string, number | null>>();
  const expected = Number(batch.expected_count);
  const total = Number(counts?.total || 0);
  const passed = Number(counts?.passed || 0);
  const review = Number(counts?.review || 0);
  const failed = Number(counts?.failed || 0);
  const processing = Number(counts?.processing || 0);
  const uploaded = Number(counts?.uploaded || 0);
  const pending = Number(counts?.pending || 0) + Math.max(0, expected - total);
  const status = total === expected && passed === expected
    ? "ready"
    : review > 0 || failed > 0
      ? "review"
      : processing > 0 || uploaded > 0
        ? "processing"
        : "uploading";
  await db.prepare(`
    UPDATE intake_batches SET status = ?, updated_at = CURRENT_TIMESTAMP,
      completed_at = CASE WHEN ? = 'ready' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END
    WHERE id = ?
  `).bind(status, status, batch.id).run();
  return { id: batch.id, clientId: batch.client_id, status, expected, pending, uploaded, processing, passed, review, failed };
}

async function syncIntakeItem(db: D1Database, garmentId: string, status: "uploaded" | "processing" | "passed" | "review" | "failed", error?: string | null): Promise<void> {
  const linked = await db.prepare(`
    SELECT intake_batches.owner_id, intake_batches.client_id
    FROM intake_batch_items
    INNER JOIN intake_batches ON intake_batches.id = intake_batch_items.batch_id
    WHERE intake_batch_items.garment_id = ? LIMIT 1
  `).bind(garmentId).first<{ owner_id: string; client_id: string }>();
  if (!linked) return;
  await db.prepare(`
    UPDATE intake_batch_items SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE garment_id = ?
  `).bind(status, error?.slice(0, 500) || null, garmentId).run();
  await intakeBatchSummary(db, linked.owner_id, linked.client_id);
}

async function createIntakeBatch(request: Request, db: D1Database, identity: Identity): Promise<Response> {
  const value = await request.json().catch(() => null) as {
    clientId?: unknown;
    items?: Array<{ clientItemId?: unknown; filename?: unknown; fingerprint?: unknown }>;
  } | null;
  const clientId = safeClientId(textValue(value?.clientId));
  const rawItems = Array.isArray(value?.items) ? value.items.slice(0, 15) : [];
  if (!clientId || !rawItems.length) return apiError("El lote de fotos no es válido.", 400);
  const items = rawItems.map((item) => ({
    clientItemId: safeClientId(textValue(item.clientItemId)),
    filename: textValue(item.filename, "foto").slice(0, 160),
    fingerprint: safeFingerprint(item.fingerprint),
  }));
  if (items.some((item) => !item.clientItemId || !item.fingerprint)) return apiError("Una de las fotos no se pudo registrar.", 400);
  if (new Set(items.map((item) => item.clientItemId)).size !== items.length || new Set(items.map((item) => item.fingerprint)).size !== items.length) {
    return apiError("El lote contiene fotos duplicadas.", 409);
  }
  const existing = await intakeBatchSummary(db, identity.id, clientId);
  if (existing) return json({ batch: existing });
  const batchId = crypto.randomUUID();
  await db.batch([
    db.prepare(`
      INSERT INTO intake_batches (id, owner_id, client_id, expected_count, status)
      VALUES (?, ?, ?, ?, 'uploading')
    `).bind(batchId, identity.id, clientId, items.length),
    ...items.map((item) => db.prepare(`
      INSERT INTO intake_batch_items (id, batch_id, client_item_id, original_filename, source_fingerprint, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(crypto.randomUUID(), batchId, item.clientItemId, item.filename, item.fingerprint)),
  ]);
  return json({ batch: await intakeBatchSummary(db, identity.id, clientId) }, 201);
}

async function failIntakeItem(request: Request, db: D1Database, identity: Identity, batchClientId: string, itemClientId: string): Promise<Response> {
  const value = await request.json().catch(() => null) as { error?: unknown } | null;
  const error = textValue(value?.error, "No se pudo cargar la foto.").slice(0, 500);
  const result = await db.prepare(`
    UPDATE intake_batch_items SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE client_item_id = ? AND batch_id = (
      SELECT id FROM intake_batches WHERE owner_id = ? AND client_id = ? LIMIT 1
    ) AND garment_id IS NULL
  `).bind(error, itemClientId, identity.id, batchClientId).run();
  if (!result.meta.changes) return apiError("La foto del lote no existe o ya fue procesada.", 404);
  return json({ batch: await intakeBatchSummary(db, identity.id, batchClientId) });
}

async function finalizeIntakeBatch(db: D1Database, identity: Identity, batchClientId: string): Promise<Response> {
  const batch = await intakeBatchSummary(db, identity.id, batchClientId);
  if (!batch) return apiError("El lote no existe.", 404);
  if (batch.status !== "ready") {
    return json({
      error: "El lote todavía no puede publicarse.",
      batch,
    }, 409);
  }
  return json({ batch });
}

function normalizeHandle(value: unknown): string | null {
  const handle = textValue(value, "").replace(/^@+/, "").toLocaleLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/.test(handle)) return null;
  return handle;
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
  const name = textValue(body.name, fallback?.name ?? "Prenda sin nombre") || "Prenda sin nombre";
  const allowedTypes = garmentTypesByCategory[category as keyof typeof garmentTypesByCategory];
  const requestedType = textValue(body.garmentType, fallback?.garmentType ?? "");
  const garmentType = garmentTypes.has(requestedType) && allowedTypes.some((type) => type === requestedType)
    ? requestedType
    : inferGarmentType(name, category as keyof typeof garmentTypesByCategory);
  return {
    name,
    brand: textValue(body.brand, fallback?.brand ?? ""),
    category,
    garmentType,
    colorFamily: textValue(body.colorFamily, fallback?.colorFamily ?? "Other") || "Other",
    tone: textValue(body.tone, fallback?.tone ?? "Unclassified") || "Unclassified",
    material: textValue(body.material, fallback?.material ?? "Cotton") || "Cotton",
    finish: textValue(body.finish, fallback?.finish ?? "Matte") || "Matte",
    silhouette: textValue(body.silhouette, fallback?.silhouette ?? "Regular") || "Regular",
    favorite: body.favorite === undefined ? Boolean(fallback?.favorite) : booleanValue(body.favorite),
    isPublic: body.isPublic === undefined ? Boolean(fallback?.isPublic) : booleanValue(body.isPublic),
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

async function identify(request: Request, env: WardrobeEnv): Promise<Identity | null> {
  const headers = request.headers;
  let email = headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase() ?? "";
  let displayName = decodeHeader(
    headers.get("oai-authenticated-user-full-name"),
    headers.get("oai-authenticated-user-full-name-encoding"),
  ).trim();
  let avatarUrl = headers.get("oai-authenticated-user-picture")?.trim() || null;
  const hostname = new URL(request.url).hostname;

  if (!email) {
    const nativeIdentity = await readNativeSession(request, env.SESSION_SECRET);
    if (nativeIdentity) {
      email = nativeIdentity.email;
      displayName = nativeIdentity.displayName;
      avatarUrl = nativeIdentity.avatarUrl;
    }
  }

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
  const existing = await db.prepare("SELECT handle FROM users WHERE id = ? LIMIT 1")
    .bind(identity.id)
    .first<{ handle: string | null }>();
  let handle = existing?.handle || normalizeHandle(identity.email.split("@")[0]) || `forme-${identity.id.slice(-6)}`;
  if (!existing) {
    const collision = await db.prepare("SELECT 1 FROM users WHERE handle = ? LIMIT 1").bind(handle).first();
    if (collision) handle = `${handle.slice(0, 23)}-${identity.id.slice(-5)}`;
  }
  await db.prepare(`
    INSERT INTO users (id, email, display_name, handle, avatar_url)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = CASE WHEN users.display_name = '' THEN excluded.display_name ELSE users.display_name END,
      handle = COALESCE(users.handle, excluded.handle),
      avatar_url = excluded.avatar_url,
      updated_at = CURRENT_TIMESTAMP
  `).bind(identity.id, identity.email, identity.displayName, handle, identity.avatarUrl).run();
}

async function authenticated(request: Request, env: WardrobeEnv): Promise<{ db: D1Database; identity: Identity } | Response> {
  if (!env.DB) return apiError("La base de datos todavía no está conectada.", 503);
  const identity = await identify(request, env);
  if (!identity) return apiError("Inicia sesión para abrir tu closet.", 401);
  await ensureUser(env.DB, identity);
  return { db: env.DB, identity };
}

function accountProfileJson(row: UserProfileRow, isOwner = false) {
  const handle = row.handle || normalizeHandle(row.email.split("@")[0]) || "mi-perfil";
  return {
    id: row.id,
    name: row.display_name || "Mi perfil",
    handle: `@${handle}`,
    bio: row.bio || "",
    avatarUrl: row.avatar_url,
    profilePublic: Boolean(row.profile_public),
    discoverable: Boolean(row.discoverable),
    showCloset: Boolean(row.show_closet),
    showLooks: Boolean(row.show_looks),
    isOwner,
  };
}

async function readAccountProfile(db: D1Database, ownerId: string): Promise<UserProfileRow> {
  const row = await db.prepare(`
    SELECT id, email, display_name, handle, bio, avatar_url,
      profile_public, discoverable, show_closet, show_looks
    FROM users WHERE id = ? LIMIT 1
  `).bind(ownerId).first<UserProfileRow>();
  if (!row) throw new Error("No se pudo abrir tu perfil.");
  return row;
}

async function getSession(request: Request, env: WardrobeEnv): Promise<Response> {
  if (!env.DB) return apiError("La base de datos todavía no está conectada.", 503);
  const identity = await identify(request, env);
  if (!identity) return apiError("Inicia sesión para abrir tu closet.", 401);
  let row = await env.DB.prepare(`
    SELECT id, email, display_name, handle, bio, avatar_url,
      profile_public, discoverable, show_closet, show_looks
    FROM users WHERE id = ? LIMIT 1
  `).bind(identity.id).first<UserProfileRow>();
  if (!row) {
    await ensureUser(env.DB, identity);
    row = await readAccountProfile(env.DB, identity.id);
  }
  const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
  return json({ user: accountProfileJson(row, Boolean(ownerEmail && identity.email === ownerEmail)) });
}

async function saveAccountProfile(request: Request, db: D1Database, identity: Identity, isOwner: boolean): Promise<Response> {
  const value = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!value) return apiError("Revisa los datos de tu perfil.", 400);
  const name = textValue(value.name, "").slice(0, 60);
  const handle = normalizeHandle(value.handle);
  const bio = textValue(value.bio, "").slice(0, 240);
  if (!name) return apiError("Escribe el nombre que quieres mostrar.", 400);
  if (!handle) return apiError("El usuario debe tener entre 3 y 30 caracteres, sin espacios.", 400);
  const collision = await db.prepare("SELECT 1 FROM users WHERE handle = ? AND id <> ? LIMIT 1")
    .bind(handle, identity.id)
    .first();
  if (collision) return apiError("Ese @usuario ya está en uso.", 409);
  const profilePublic = booleanValue(value.profilePublic);
  const discoverable = profilePublic && booleanValue(value.discoverable);
  const showCloset = profilePublic && booleanValue(value.showCloset);
  const showLooks = profilePublic && booleanValue(value.showLooks);
  await db.prepare(`
    UPDATE users SET display_name = ?, handle = ?, bio = ?, profile_public = ?,
      discoverable = ?, show_closet = ?, show_looks = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    name,
    handle,
    bio,
    profilePublic ? 1 : 0,
    discoverable ? 1 : 0,
    showCloset ? 1 : 0,
    showLooks ? 1 : 0,
    identity.id,
  ).run();
  return json({ profile: accountProfileJson(await readAccountProfile(db, identity.id), isOwner) });
}

function garmentJson(row: GarmentRow, tags: string[] = []) {
  const revision = row.revision || 1;
  return {
    serverId: row.id,
    id: row.client_id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    garmentType: row.garment_type || inferGarmentType(row.name, row.category as keyof typeof garmentTypesByCategory),
    colorFamily: row.color_family,
    tone: row.tone,
    material: row.material,
    finish: row.finish,
    silhouette: row.silhouette,
    favorite: Boolean(row.favorite),
    isPublic: Boolean(row.is_public),
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
        id, owner_id, client_id, name, brand, category, garment_type, color_family, tone,
        material, finish, silhouette, favorite, is_public, deleted, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ready')
      ON CONFLICT(owner_id, client_id) DO UPDATE SET
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        garment_type = excluded.garment_type,
        color_family = excluded.color_family,
        tone = excluded.tone,
        material = excluded.material,
        finish = excluded.finish,
        silhouette = excluded.silhouette,
        favorite = excluded.favorite,
        is_public = excluded.is_public,
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
      payload.garmentType,
      payload.colorFamily,
      payload.tone,
      payload.material,
      payload.finish,
      payload.silhouette,
      payload.favorite ? 1 : 0,
      payload.isPublic ? 1 : 0,
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
    garmentType: form.get("garmentType"),
    colorFamily: form.get("colorFamily"),
    tone: form.get("tone"),
    material: form.get("material"),
    finish: form.get("finish"),
    silhouette: form.get("silhouette"),
    favorite: form.get("favorite"),
    isPublic: form.get("isPublic"),
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
  const intakeBatchClientId = safeClientId(textValue(form.get("intakeBatchId")));
  const intakeItemClientId = safeClientId(textValue(form.get("intakeItemId")));
  if (!intakeBatchClientId || !intakeItemClientId) return apiError("La foto no pertenece a un lote registrado.", 400);
  const intakeItem = await db.prepare(`
    SELECT intake_batch_items.id, intake_batch_items.batch_id
    FROM intake_batch_items
    INNER JOIN intake_batches ON intake_batches.id = intake_batch_items.batch_id
    WHERE intake_batches.owner_id = ? AND intake_batches.client_id = ?
      AND intake_batch_items.client_item_id = ? AND intake_batch_items.garment_id IS NULL
    LIMIT 1
  `).bind(identity.id, intakeBatchClientId, intakeItemClientId).first<{ id: string; batch_id: string }>();
  if (!intakeItem) return apiError("La foto no está registrada en este lote o ya fue cargada.", 409);

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
    await db.batch([
      db.prepare(`
        INSERT INTO garments (
          id, owner_id, client_id, name, brand, category, garment_type, color_family, tone,
          material, finish, silhouette, favorite, is_public, status, source_image_key, processing_image_key, quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?)
      `).bind(
        garmentId,
        identity.id,
        clientId,
        payload.name,
        payload.brand,
        payload.category,
        payload.garmentType,
        payload.colorFamily,
        payload.tone,
        payload.material,
        payload.finish,
        payload.silhouette,
        payload.favorite ? 1 : 0,
        payload.isPublic ? 1 : 0,
        sourceKey,
        processingKey,
        imageQuality(env.OPENAI_IMAGE_QUALITY),
      ),
      db.prepare(`
        UPDATE intake_batch_items SET garment_id = ?, status = 'uploaded', error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND batch_id = ? AND garment_id IS NULL
      `).bind(garmentId, intakeItem.id, intakeItem.batch_id),
    ]);
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
  await syncIntakeItem(db, garmentId, enabled ? "processing" : "uploaded");
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
- Garment type: ${garment.garment_type || "Unclassified"}.
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

function encodeBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

async function reviewGeneratedGarment(
  env: WardrobeEnv,
  garment: GarmentRow,
  sourceBytes: ArrayBuffer,
  sourceContentType: string,
  generated: Uint8Array,
): Promise<{ passed: boolean; score: number; notes: string }> {
  if (!env.OPENAI_API_KEY) return { passed: false, score: 0, notes: "El control visual no está disponible." };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_QA_MODEL || "gpt-5-mini",
        store: false,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: `You are the final visual quality gate for a fashion digitization service. Compare SOURCE (first image) against OUTPUT (second image). The output must depict the exact same ${garment.garment_type || garment.category} as a ghost-mannequin catalog image. Reject if any silhouette, proportion, color, material, finish, seam, pocket, closure, hardware, graphic, print, embroidery, patch, logo, visible exterior text, distressing, or construction detail is missing, changed, moved, invented or obscured. Reject any hanger, person, mannequin body, visible interior brand/care/size label, solid black neck oval or geometric void, background contamination, cropped garment, malformed edge, or invented styling item. A natural empty neck opening is allowed only when it follows the construction and shows plausible matching lining. Be strict: uncertainty means review. Return only the requested JSON.`,
            },
            { type: "input_image", image_url: `data:${sourceContentType};base64,${encodeBase64(sourceBytes)}`, detail: "high" },
            { type: "input_image", image_url: `data:image/png;base64,${encodeBase64(generated)}`, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "garment_quality_gate",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                passed: { type: "boolean" },
                score: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string" },
                issues: { type: "array", items: { type: "string" }, maxItems: 8 },
              },
              required: ["passed", "score", "summary", "issues"],
            },
          },
        },
      }),
    });
    const result = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(result.error?.message || `Control visual ${response.status}`);
    const raw = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
    const parsed = JSON.parse(raw) as { passed?: boolean; score?: number; summary?: string; issues?: string[] };
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const notes = [parsed.summary, ...(Array.isArray(parsed.issues) ? parsed.issues : [])].filter(Boolean).join(" · ").slice(0, 500);
    return { passed: parsed.passed === true && score >= 85, score, notes: notes || "El resultado necesita revisión visual." };
  } catch (error) {
    return { passed: false, score: 0, notes: `No se pudo completar el control visual: ${error instanceof Error ? error.message : "error desconocido"}`.slice(0, 500) };
  }
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
    await syncIntakeItem(db, garmentId, "processing");

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

    const visualQa = await reviewGeneratedGarment(env, garment, sourceBytes, contentType, generated);
    if (!visualQa.passed) {
      const attempt = await db.prepare("SELECT attempt FROM processing_jobs WHERE id = ? AND owner_id = ? LIMIT 1")
        .bind(jobId, ownerId).first<{ attempt: number }>();
      if (Number(attempt?.attempt || 0) < 2) {
        await env.WARDROBE_MEDIA.delete(generatedKey);
        await db.batch([
          db.prepare("UPDATE garments SET status = 'processing', qa_status = 'pending', qa_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(`Reintentando automáticamente: ${visualQa.notes}`.slice(0, 500), garmentId, ownerId),
          db.prepare("UPDATE processing_jobs SET status = 'queued', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(visualQa.notes, jobId, ownerId),
        ]);
        await syncIntakeItem(db, garmentId, "processing", "Reintentando el control visual.");
        await processGarment(env, db, ownerId, garmentId, jobId, quality, presentation, outputVariant);
        return;
      }
      const reviewUpdate = outputVariant === "open"
        ? db.prepare(`
          UPDATE garments SET generated_open_image_key = ?, status = 'review', quality = ?, qa_status = 'review',
            qa_notes = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?
        `).bind(generatedKey, quality, visualQa.notes, garmentId, ownerId)
        : db.prepare(`
          UPDATE garments SET generated_image_key = ?, status = 'review', quality = ?, qa_status = 'review',
            qa_notes = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?
        `).bind(generatedKey, quality, visualQa.notes, garmentId, ownerId);
      await db.batch([
        reviewUpdate,
        db.prepare("UPDATE processing_jobs SET status = 'review', error = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
          .bind(visualQa.notes, jobId, ownerId),
      ]);
      await syncIntakeItem(db, garmentId, "review", visualQa.notes);
      return;
    }

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
          quality = ?, qa_status = 'passed', qa_notes = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(nextStatus, generatedKey, cutoutKey, quality, garmentId, ownerId)
      : db.prepare(`
        UPDATE garments
        SET status = ?, generated_image_key = ?, image_key = COALESCE(?, image_key),
          quality = ?, qa_status = 'passed', qa_notes = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
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
    let openRequired = false;
    if (nextStatus === "ready" && outputVariant === "closed" && garment.category === "Outerwear") {
      const existingOpen = await db.prepare(`
        SELECT id, status FROM processing_jobs
        WHERE garment_id = ? AND owner_id = ? AND output_variant = 'open'
          AND status IN ('queued', 'processing', 'batch_staged', 'batch_processing', 'awaiting_cutout', 'succeeded')
        LIMIT 1
      `).bind(garmentId, ownerId).first<{ id: string; status: string }>();
      openRequired = !existingOpen || existingOpen.status !== "succeeded";
      if (!existingOpen) {
        const openJob = await createProcessingJob(db, ownerId, garmentId, true, quality, "open", "open");
        await processGarment(env, db, ownerId, garmentId, openJob.id, quality, "open", "open");
      }
    }
    if (nextStatus === "ready" && !openRequired) await syncIntakeItem(db, garmentId, "passed");
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
    await syncIntakeItem(db, garmentId, "failed", message);
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
  await syncIntakeItem(db, garment.id, enabled ? "processing" : "uploaded");
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
  const effectiveQaStatus = qaStatus === "review" || garment.qa_status === "review" ? "review" : "passed";
  const nextStatus = effectiveQaStatus === "review" ? "review" : Number(pending?.count || 0) > 0 ? "cutout_pending" : "ready";
  await db.prepare("UPDATE garments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
    .bind(nextStatus, garment.id, identity.id)
    .run();
  await syncIntakeItem(db, garment.id, nextStatus === "ready" ? "passed" : nextStatus === "review" ? "review" : "processing", qaNotes || null);
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

async function publicMediaResponse(env: WardrobeEnv, db: D1Database, handle: string, clientId: string, variant: string): Promise<Response> {
  if (!env.WARDROBE_MEDIA) return new Response("Not found", { status: 404 });
  const garment = await db.prepare(`
    SELECT ${garmentColumns.split(",").map((column) => `garments.${column.trim()}`).join(", ")}
    FROM garments
    INNER JOIN users ON users.id = garments.owner_id
    WHERE users.handle = ? AND users.profile_public = 1
      AND garments.client_id = ? AND garments.deleted = 0
      AND (
        (users.show_closet = 1 AND garments.is_public = 1)
        OR (users.show_looks = 1 AND EXISTS (
          SELECT 1 FROM outfit_items
          INNER JOIN outfits ON outfits.id = outfit_items.outfit_id
          WHERE outfits.owner_id = users.id AND outfits.is_public = 1
            AND outfit_items.garment_client_id = garments.client_id
        ))
      )
    LIMIT 1
  `).bind(handle, clientId).first<GarmentRow>();
  if (!garment) return new Response("Not found", { status: 404 });
  const key = variant === "open" ? garment.open_image_key : garment.image_key;
  if (!key) return new Response("Not found", { status: 404 });
  const object = await env.WARDROBE_MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
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
  if (!env.DB || !env.WARDROBE_MEDIA) return apiError("El closet todavía no está conectado.", 503);
  const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
  if (!ownerEmail) return apiError("El propietario del closet no está configurado.", 503);
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
  const name = textValue(form.get("name"), "Prenda sin nombre") || "Prenda sin nombre";
  const requestedGarmentType = textValue(form.get("garmentType"), "");
  const allowedTypes = garmentTypesByCategory[category as keyof typeof garmentTypesByCategory];
  const garmentType = allowedTypes.some((type) => type === requestedGarmentType)
    ? requestedGarmentType
    : inferGarmentType(name, category as keyof typeof garmentTypesByCategory);
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
      id, owner_id, client_id, name, brand, category, garment_type, color_family, tone,
      material, finish, silhouette, favorite, deleted, status, source_image_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'uploaded', ?)
    ON CONFLICT(owner_id, client_id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      garment_type = excluded.garment_type,
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
    textValue(form.get("name"), existing?.name ?? name) || name,
    existing?.brand ?? "",
    category,
    garmentType,
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
          if (garment) await syncIntakeItem(db, garment.id, "failed", message);
          continue;
        }
        const outputVariant: GarmentOutputVariant = job.output_variant === "open" ? "open" : "closed";
        const quality = imageQuality(job.quality);
        const generated = decodeBase64(encoded);
        const generatedKey = `users/${identity.id}/garments/${garment.client_id}/ghost-${outputVariant}-${quality}-${Date.now()}.png`;
        await env.WARDROBE_MEDIA.put(generatedKey, generated, {
          httpMetadata: { contentType: "image/png" },
          customMetadata: { owner: identity.id, garment: garment.client_id, kind: `generated-${outputVariant}` },
        });
        const processingKey = garment.processing_image_key || garment.source_image_key;
        const source = processingKey ? await env.WARDROBE_MEDIA.get(processingKey) : null;
        const visualQa = source
          ? await reviewGeneratedGarment(env, garment, await source.arrayBuffer(), source.httpMetadata?.contentType || "image/jpeg", generated)
          : { passed: false, score: 0, notes: "La imagen original no está disponible para el control visual." };
        if (!visualQa.passed) {
          await env.WARDROBE_MEDIA.delete(generatedKey);
          const retryJob = await createProcessingJob(db, identity.id, garment.id, true, quality, outputVariant === "open" ? "open" : "closed", outputVariant);
          await db.batch([
            db.prepare("UPDATE processing_jobs SET status = 'retrying', error = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
              .bind(visualQa.notes, job.id, identity.id),
            db.prepare("UPDATE processing_jobs SET attempt = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
              .bind(retryJob.id, identity.id),
          ]);
          await syncIntakeItem(db, garment.id, "processing", "Reintentando el control visual.");
          ctx.waitUntil(processGarment(env, db, identity.id, garment.id, retryJob.id, quality, outputVariant === "open" ? "open" : "closed", outputVariant));
          continue;
        }
        const updateGarment = outputVariant === "open"
          ? db.prepare("UPDATE garments SET generated_open_image_key = ?, status = 'cutout_pending', quality = ?, qa_status = 'passed', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(generatedKey, quality, garment.id, identity.id)
          : db.prepare("UPDATE garments SET generated_image_key = ?, status = 'cutout_pending', quality = ?, qa_status = 'passed', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?")
            .bind(generatedKey, quality, garment.id, identity.id);
        await db.batch([
          updateGarment,
          db.prepare("UPDATE processing_jobs SET status = 'awaiting_cutout', updated_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND owner_id = ?")
            .bind(job.id, identity.id),
        ]);
        await syncIntakeItem(db, garment.id, "processing");
      }
      await db.prepare(`
        UPDATE processing_jobs SET status = 'failed', error = 'No se recibió una imagen para esta solicitud.', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND batch_id = ? AND status = 'batch_processing'
      `).bind(identity.id, batchId).run();
      const unresolved = await db.prepare(`
        SELECT DISTINCT garment_id FROM processing_jobs
        WHERE owner_id = ? AND batch_id = ? AND status = 'failed'
      `).bind(identity.id, batchId).all<{ garment_id: string }>();
      for (const row of unresolved.results) await syncIntakeItem(db, row.garment_id, "failed", "No se recibió una imagen para esta solicitud.");
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
      const failedGarments = await db.prepare("SELECT DISTINCT garment_id FROM processing_jobs WHERE owner_id = ? AND batch_id = ?")
        .bind(identity.id, batchId).all<{ garment_id: string }>();
      for (const row of failedGarments.results) await syncIntakeItem(db, row.garment_id, "failed", message);
    }
  }
  return json({ batches: summaries });
}

async function getOutfits(db: D1Database, ownerId: string): Promise<Response> {
  const outfits = await db.prepare("SELECT id, client_id, name, is_public, created_at, updated_at FROM outfits WHERE owner_id = ? ORDER BY updated_at DESC")
    .bind(ownerId)
    .all<{ id: string; client_id: string; name: string; is_public: number; created_at: string; updated_at: string }>();
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
      isPublic: Boolean(outfit.is_public),
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
  const value = await request.json().catch(() => null) as { name?: unknown; items?: unknown; isPublic?: unknown } | null;
  if (!value || !Array.isArray(value.items) || value.items.length > 30) return apiError("El look no es válido.", 400);
  const name = textValue(value.name, "Look sin nombre") || "Look sin nombre";
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
    if (!raw || typeof raw !== "object") return apiError("Una prenda del look no es válida.", 400);
    const item = raw as Record<string, unknown>;
    const instanceId = safeClientId(textValue(item.instanceId)) ?? crypto.randomUUID();
    const garmentId = safeClientId(textValue(item.garmentId));
    if (!garmentId) return apiError("Una prenda del look no es válida.", 400);
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
  const existing = await db.prepare("SELECT id, is_public FROM outfits WHERE owner_id = ? AND client_id = ? LIMIT 1")
    .bind(ownerId, outfitId)
    .first<{ id: string; is_public: number }>();
  const serverId = existing?.id ?? crypto.randomUUID();
  const isPublic = value.isPublic === undefined ? Boolean(existing?.is_public) : booleanValue(value.isPublic);
  await db.batch([
    db.prepare(`
      INSERT INTO outfits (id, owner_id, client_id, name, is_public) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, client_id) DO UPDATE SET
        name = excluded.name,
        is_public = excluded.is_public,
        updated_at = CURRENT_TIMESTAMP
    `).bind(serverId, ownerId, outfitId, name, isPublic ? 1 : 0),
    db.prepare("DELETE FROM outfit_items WHERE outfit_id = ? AND EXISTS (SELECT 1 FROM outfits WHERE id = ? AND owner_id = ?)")
      .bind(serverId, serverId, ownerId),
    ...items.map((item) => db.prepare(`
      INSERT INTO outfit_items (id, outfit_id, garment_client_id, variant, x, y, scale, rotation, z)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM outfits WHERE id = ? AND owner_id = ?)
    `).bind(
      crypto.randomUUID(),
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
  return json({ id: outfitId, name, isPublic, items });
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

async function getPublicProfile(db: D1Database, rawHandle: string): Promise<Response> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return apiError("Perfil no encontrado.", 404);
  const user = await db.prepare(`
    SELECT id, email, display_name, handle, bio, avatar_url,
      profile_public, discoverable, show_closet, show_looks
    FROM users WHERE handle = ? AND profile_public = 1 LIMIT 1
  `).bind(handle).first<UserProfileRow>();
  if (!user) return apiError("Este perfil es privado o no existe.", 404);

  const garmentRows = user.show_closet
    ? await db.prepare(`
      SELECT ${garmentColumns} FROM garments
      WHERE owner_id = ? AND is_public = 1 AND deleted = 0
      ORDER BY updated_at DESC LIMIT 120
    `).bind(user.id).all<GarmentRow>()
    : { results: [] as GarmentRow[] };
  const tagRows = garmentRows.results.length
    ? await db.prepare(`
      SELECT garment_tags.garment_id, garment_tags.tag FROM garment_tags
      INNER JOIN garments ON garments.id = garment_tags.garment_id
      WHERE garments.owner_id = ? AND garments.is_public = 1
      ORDER BY garment_tags.tag COLLATE NOCASE
    `).bind(user.id).all<{ garment_id: string; tag: string }>()
    : { results: [] as Array<{ garment_id: string; tag: string }> };
  const tags = new Map<string, string[]>();
  for (const row of tagRows.results) tags.set(row.garment_id, [...(tags.get(row.garment_id) ?? []), row.tag]);

  const outfitRows = user.show_looks
    ? await db.prepare(`
      SELECT id, client_id, name, created_at, updated_at FROM outfits
      WHERE owner_id = ? AND is_public = 1 ORDER BY updated_at DESC LIMIT 60
    `).bind(user.id).all<{ id: string; client_id: string; name: string; created_at: string; updated_at: string }>()
    : { results: [] as Array<{ id: string; client_id: string; name: string; created_at: string; updated_at: string }> };
  const outfitItems = outfitRows.results.length
    ? await db.prepare(`
      SELECT outfit_items.id, outfit_items.outfit_id, outfit_items.garment_client_id,
        outfit_items.variant, outfit_items.x, outfit_items.y, outfit_items.scale,
        outfit_items.rotation, outfit_items.z
      FROM outfit_items
      INNER JOIN outfits ON outfits.id = outfit_items.outfit_id
      WHERE outfits.owner_id = ? AND outfits.is_public = 1
      ORDER BY outfit_items.z
    `).bind(user.id).all<{
      id: string;
      outfit_id: string;
      garment_client_id: string;
      variant: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
      z: number;
    }>()
    : { results: [] as Array<{
      id: string;
      outfit_id: string;
      garment_client_id: string;
      variant: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
      z: number;
    }> };
  const byOutfit = new Map<string, typeof outfitItems.results>();
  for (const item of outfitItems.results) byOutfit.set(item.outfit_id, [...(byOutfit.get(item.outfit_id) ?? []), item]);
  const mediaBase = `/api/public-media/${encodeURIComponent(handle)}`;

  return json({
    profile: {
      name: user.display_name || "Perfil de Formé",
      handle: `@${handle}`,
      bio: user.bio || "",
      avatarUrl: user.avatar_url,
      discoverable: Boolean(user.discoverable),
    },
    garments: garmentRows.results.flatMap((row) => {
      const staticMedia = staticGarmentMedia.get(row.client_id);
      const image = row.image_key
        ? `${mediaBase}/${encodeURIComponent(row.client_id)}/cutout?v=${row.revision || 1}`
        : staticMedia?.image;
      if (!image) return [];
      return [{
        ...garmentJson(row, tags.get(row.id) ?? []),
        image,
        openImage: row.open_image_key
          ? `${mediaBase}/${encodeURIComponent(row.client_id)}/open?v=${row.revision || 1}`
          : staticMedia?.openImage,
        originalImage: undefined,
        generatedImage: undefined,
        generatedOpenImage: undefined,
      }];
    }),
    outfits: outfitRows.results.map((outfit) => ({
      id: outfit.client_id,
      name: outfit.name,
      createdAt: outfit.created_at,
      updatedAt: outfit.updated_at,
      items: (byOutfit.get(outfit.id) ?? []).map((item) => {
        const staticMedia = staticGarmentMedia.get(item.garment_client_id);
        const isOpen = item.variant === "open";
        return {
          instanceId: item.id,
          garmentId: item.garment_client_id,
          variant: isOpen ? "open" : "closed",
          image: isOpen && staticMedia?.openImage
            ? staticMedia.openImage
            : staticMedia?.image ?? `${mediaBase}/${encodeURIComponent(item.garment_client_id)}/${isOpen ? "open" : "cutout"}`,
          x: item.x / 1000,
          y: item.y / 1000,
          scale: item.scale / 1000,
          rotation: item.rotation / 1000,
          z: item.z,
        };
      }),
    })),
  });
}

async function discoverProfiles(db: D1Database, rawQuery: string): Promise<Response> {
  const query = textValue(rawQuery, "").toLocaleLowerCase();
  const pattern = `%${query.replace(/[%_]/g, "")}%`;
  const profiles = await db.prepare(`
    SELECT users.display_name, users.handle, users.bio, users.avatar_url,
      (SELECT COUNT(*) FROM garments WHERE garments.owner_id = users.id AND garments.is_public = 1 AND garments.deleted = 0) AS garment_count,
      (SELECT COUNT(*) FROM outfits WHERE outfits.owner_id = users.id AND outfits.is_public = 1) AS outfit_count
    FROM users
    WHERE users.profile_public = 1 AND users.discoverable = 1
      AND (? = '' OR LOWER(users.display_name) LIKE ? OR LOWER(users.handle) LIKE ?)
    ORDER BY users.updated_at DESC
    LIMIT 24
  `).bind(query, pattern, pattern).all<{
    display_name: string;
    handle: string;
    bio: string;
    avatar_url: string | null;
    garment_count: number;
    outfit_count: number;
  }>();
  return json({ profiles: profiles.results.map((profile) => ({
    name: profile.display_name,
    handle: `@${profile.handle}`,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    garmentCount: profile.garment_count,
    outfitCount: profile.outfit_count,
  })) });
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

async function saveWeeklyPlan(request: Request, db: D1Database, ownerId: string): Promise<Response> {
  const value = await request.json().catch(() => null) as { entries?: unknown } | null;
  if (!value || !Array.isArray(value.entries) || value.entries.length === 0 || value.entries.length > 7) {
    return apiError("La semana no es válida.", 400);
  }
  const allowedOccasions = new Set(["daily", "work", "dinner", "event", "weekend"]);
  const dates = new Set<string>();
  const entries: Array<{ date: string; outfitId: string; occasion: string; worn: boolean }> = [];
  for (const raw of value.entries) {
    if (!raw || typeof raw !== "object") return apiError("Uno de los días no es válido.", 400);
    const item = raw as Record<string, unknown>;
    const date = textValue(item.date);
    const outfitId = safeClientId(textValue(item.outfitId));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dates.has(date) || !outfitId) return apiError("Uno de los días no es válido.", 400);
    dates.add(date);
    const requestedOccasion = textValue(item.occasion, "daily").toLocaleLowerCase();
    entries.push({
      date,
      outfitId,
      occasion: allowedOccasions.has(requestedOccasion) ? requestedOccasion : "daily",
      worn: booleanValue(item.worn),
    });
  }

  const outfitIds = [...new Set(entries.map((entry) => entry.outfitId))];
  const placeholders = outfitIds.map(() => "?").join(", ");
  const existing = await db.prepare(`SELECT client_id FROM outfits WHERE owner_id = ? AND client_id IN (${placeholders})`)
    .bind(ownerId, ...outfitIds)
    .all<{ client_id: string }>();
  const existingIds = new Set(existing.results.map((row) => row.client_id));
  if (outfitIds.some((id) => !existingIds.has(id))) return apiError("Uno de los looks ya no está disponible.", 404);

  await db.batch(entries.map((entry) => db.prepare(`
    INSERT INTO weekly_plan_entries (id, owner_id, plan_date, outfit_client_id, occasion, worn)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, plan_date) DO UPDATE SET
      outfit_client_id = excluded.outfit_client_id,
      occasion = excluded.occasion,
      worn = excluded.worn,
      updated_at = CURRENT_TIMESTAMP
  `).bind(crypto.randomUUID(), ownerId, entry.date, entry.outfitId, entry.occasion, entry.worn ? 1 : 0)));
  return json({ entries });
}

async function deleteWeeklyPlanEntry(db: D1Database, ownerId: string, planDate: string): Promise<Response> {
  await db.prepare("DELETE FROM weekly_plan_entries WHERE owner_id = ? AND plan_date = ?")
    .bind(ownerId, planDate)
    .run();
  return new Response(null, { status: 204 });
}

async function getStyleProfile(db: D1Database, ownerId: string): Promise<Response> {
  const profile = await db.prepare(`
    SELECT audience, exploration, completed, completed_at, updated_at
    FROM style_profiles
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first<{
    audience: string;
    exploration: number;
    completed: number;
    completed_at: string | null;
    updated_at: string;
  }>();
  const ratings = await db.prepare(`
    SELECT family, affinity, blocked, reason, updated_at
    FROM style_family_ratings
    WHERE owner_id = ?
    ORDER BY affinity DESC, family
  `).bind(ownerId).all<{
    family: string;
    affinity: number;
    blocked: number;
    reason: string | null;
    updated_at: string;
  }>();
  return json({
    profile: {
      audience: profile?.audience === "mujer" ? "mujer" : "hombre",
      exploration: Math.max(0, Math.min(100, profile?.exploration ?? 35)),
      completed: Boolean(profile?.completed),
      completedAt: profile?.completed_at ?? null,
      updatedAt: profile?.updated_at ?? null,
      ratings: ratings.results.map((rating) => ({
        family: rating.family,
        affinity: rating.affinity,
        blocked: Boolean(rating.blocked),
        reason: rating.reason,
      })),
    },
  });
}

async function saveStyleProfile(request: Request, db: D1Database, ownerId: string): Promise<Response> {
  const value = await request.json().catch(() => null) as {
    audience?: unknown;
    exploration?: unknown;
    completed?: unknown;
    ratings?: unknown;
  } | null;
  if (!value || !Array.isArray(value.ratings)) return apiError("La calibración no es válida.", 400);
  const audience: StyleAudience = value.audience === "mujer" ? "mujer" : "hombre";
  const exploration = Math.max(0, Math.min(100, Math.round(Number(value.exploration) || 0)));
  const completed = booleanValue(value.completed);
  const unique = new Map<string, StyleFamilyRatingPayload>();
  for (const raw of value.ratings) {
    if (!raw || typeof raw !== "object") continue;
    const rating = raw as Record<string, unknown>;
    const family = textValue(rating.family, "").toLocaleLowerCase();
    if (!styleFamilies.has(family)) continue;
    const affinity = Math.max(0, Math.min(100, Math.round(Number(rating.affinity) || 0)));
    const blocked = booleanValue(rating.blocked);
    const rawReason = textValue(rating.reason, "").toLocaleLowerCase();
    const reason = styleFeedbackReasons.has(rawReason) ? rawReason : null;
    unique.set(family, { family, affinity: blocked ? 0 : affinity, blocked, reason });
  }
  if (completed && unique.size !== 0 && unique.size !== styleFamilies.size) return apiError("Califica las 12 familias para terminar.", 400);
  const statements = [
    db.prepare(`
      INSERT INTO style_profiles (owner_id, audience, exploration, completed, completed_at)
      VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
      ON CONFLICT(owner_id) DO UPDATE SET
        audience = excluded.audience,
        exploration = excluded.exploration,
        completed = excluded.completed,
        completed_at = CASE
          WHEN excluded.completed = 1 THEN COALESCE(style_profiles.completed_at, CURRENT_TIMESTAMP)
          ELSE style_profiles.completed_at
        END,
        updated_at = CURRENT_TIMESTAMP
    `).bind(ownerId, audience, exploration, completed ? 1 : 0, completed ? 1 : 0),
    ...[...unique.values()].map((rating) => db.prepare(`
      INSERT INTO style_family_ratings (owner_id, family, affinity, blocked, reason)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, family) DO UPDATE SET
        affinity = excluded.affinity,
        blocked = excluded.blocked,
        reason = excluded.reason,
        updated_at = CURRENT_TIMESTAMP
    `).bind(ownerId, rating.family, rating.affinity, rating.blocked ? 1 : 0, rating.reason)),
  ];
  await db.batch(statements);
  return getStyleProfile(db, ownerId);
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
  const publicProfileMatch = url.pathname.match(/^\/api\/public-profile\/([^/]+)$/);
  if (publicProfileMatch && request.method === "GET") {
    if (!env.DB) return apiError("La base de datos todavía no está conectada.", 503);
    return getPublicProfile(env.DB, decodeURIComponent(publicProfileMatch[1]));
  }
  if (url.pathname === "/api/discover" && request.method === "GET") {
    if (!env.DB) return apiError("La base de datos todavía no está conectada.", 503);
    return discoverProfiles(env.DB, url.searchParams.get("q") ?? "");
  }
  const publicMediaMatch = url.pathname.match(/^\/api\/public-media\/([^/]+)\/([^/]+)\/(cutout|open)$/);
  if (publicMediaMatch && request.method === "GET") {
    if (!env.DB) return new Response("Not found", { status: 404 });
    const handle = normalizeHandle(decodeURIComponent(publicMediaMatch[1]));
    const clientId = safeClientId(decodeURIComponent(publicMediaMatch[2]));
    return handle && clientId
      ? publicMediaResponse(env, env.DB, handle, clientId, publicMediaMatch[3])
      : new Response("Not found", { status: 404 });
  }
  if (url.pathname === "/api/session" && request.method === "GET") return getSession(request, env);
  const auth = await authenticated(request, env);
  if (auth instanceof Response) return auth;
  const { db, identity } = auth;

  try {
    if (url.pathname === "/api/profile" && request.method === "PUT") {
      const ownerEmail = env.FORME_OWNER_EMAIL?.trim().toLocaleLowerCase();
      return saveAccountProfile(request, db, identity, Boolean(ownerEmail && identity.email === ownerEmail));
    }
    if (url.pathname === "/api/wardrobe" && request.method === "GET") return getWardrobe(db, identity.id);
    if (url.pathname === "/api/intake-batches" && request.method === "POST") return createIntakeBatch(request, db, identity);
    if (url.pathname === "/api/upload" && request.method === "POST") return uploadGarment(request, env, ctx, db, identity);
    if (url.pathname === "/api/batches" && request.method === "POST") return createGarmentBatch(request, env, ctx, db, identity);
    if (url.pathname === "/api/batches/status" && request.method === "GET") return reconcileGarmentBatches(env, ctx, db, identity);
    if (url.pathname === "/api/outfits" && request.method === "GET") return getOutfits(db, identity.id);
    if (url.pathname === "/api/week" && request.method === "GET") return getWeeklyPlan(db, identity.id);
    if (url.pathname === "/api/week" && request.method === "POST") return saveWeeklyPlan(request, db, identity.id);
    if (url.pathname === "/api/style-profile" && request.method === "GET") return getStyleProfile(db, identity.id);
    if (url.pathname === "/api/style-profile" && request.method === "PUT") return saveStyleProfile(request, db, identity.id);

    const intakeFailMatch = url.pathname.match(/^\/api\/intake-batches\/([^/]+)\/items\/([^/]+)\/fail$/);
    if (intakeFailMatch && request.method === "POST") {
      const batchClientId = safeClientId(decodeURIComponent(intakeFailMatch[1]));
      const itemClientId = safeClientId(decodeURIComponent(intakeFailMatch[2]));
      return batchClientId && itemClientId
        ? failIntakeItem(request, db, identity, batchClientId, itemClientId)
        : apiError("Ruta inválida.", 400);
    }
    const intakeFinalizeMatch = url.pathname.match(/^\/api\/intake-batches\/([^/]+)\/finalize$/);
    if (intakeFinalizeMatch && request.method === "POST") {
      const batchClientId = safeClientId(decodeURIComponent(intakeFinalizeMatch[1]));
      return batchClientId ? finalizeIntakeBatch(db, identity, batchClientId) : apiError("Ruta inválida.", 400);
    }
    const intakeMatch = url.pathname.match(/^\/api\/intake-batches\/([^/]+)$/);
    if (intakeMatch && request.method === "GET") {
      const batchClientId = safeClientId(decodeURIComponent(intakeMatch[1]));
      const batch = batchClientId ? await intakeBatchSummary(db, identity.id, batchClientId) : null;
      return batch ? json({ batch }) : apiError("El lote no existe.", 404);
    }

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
