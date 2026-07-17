import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  handle: text("handle"),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  profilePublic: integer("profile_public", { mode: "boolean" }).notNull().default(false),
  discoverable: integer("discoverable", { mode: "boolean" }).notNull().default(false),
  showCloset: integer("show_closet", { mode: "boolean" }).notNull().default(false),
  showLooks: integer("show_looks", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_handle_unique").on(table.handle),
]);

export const garments = sqliteTable("garments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull(),
  colorFamily: text("color_family").notNull(),
  tone: text("tone").notNull(),
  material: text("material").notNull(),
  finish: text("finish").notNull(),
  silhouette: text("silhouette").notNull(),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("ready"),
  sourceImageKey: text("source_image_key"),
  processingImageKey: text("processing_image_key"),
  generatedImageKey: text("generated_image_key"),
  generatedOpenImageKey: text("generated_open_image_key"),
  imageKey: text("image_key"),
  openImageKey: text("open_image_key"),
  quality: text("quality").notNull().default("low"),
  qaStatus: text("qa_status").notNull().default("pending"),
  qaNotes: text("qa_notes"),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("garments_owner_idx").on(table.ownerId),
  uniqueIndex("garments_owner_client_unique").on(table.ownerId, table.clientId),
  index("garments_owner_category_idx").on(table.ownerId, table.category),
  index("garments_owner_status_idx").on(table.ownerId, table.status),
]);

export const garmentTags = sqliteTable("garment_tags", {
  garmentId: text("garment_id").notNull().references(() => garments.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
}, (table) => [
  primaryKey({ columns: [table.garmentId, table.tag] }),
  index("garment_tags_tag_idx").on(table.tag),
]);

export const processingJobs = sqliteTable("processing_jobs", {
  id: text("id").primaryKey(),
  garmentId: text("garment_id").notNull().references(() => garments.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("ghost_mannequin"),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("openai+cloudflare"),
  attempt: integer("attempt").notNull().default(0),
  quality: text("quality").notNull().default("low"),
  presentation: text("presentation").notNull().default("auto"),
  outputVariant: text("output_variant").notNull().default("closed"),
  mode: text("mode").notNull().default("immediate"),
  batchId: text("batch_id"),
  openaiFileId: text("openai_file_id"),
  error: text("error"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("processing_jobs_owner_idx").on(table.ownerId),
  index("processing_jobs_garment_idx").on(table.garmentId),
  index("processing_jobs_status_idx").on(table.status),
  index("processing_jobs_batch_idx").on(table.batchId),
]);

export const outfits = sqliteTable("outfits", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  name: text("name").notNull().default("Look sin nombre"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("outfits_owner_idx").on(table.ownerId),
  uniqueIndex("outfits_owner_client_unique").on(table.ownerId, table.clientId),
]);

export const outfitItems = sqliteTable("outfit_items", {
  id: text("id").primaryKey(),
  outfitId: text("outfit_id").notNull().references(() => outfits.id, { onDelete: "cascade" }),
  garmentClientId: text("garment_client_id").notNull(),
  variant: text("variant").notNull().default("closed"),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  scale: integer("scale").notNull(),
  rotation: integer("rotation").notNull().default(0),
  z: integer("z").notNull(),
}, (table) => [
  index("outfit_items_outfit_idx").on(table.outfitId),
  index("outfit_items_garment_idx").on(table.garmentClientId),
]);

export const weeklyPlanEntries = sqliteTable("weekly_plan_entries", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planDate: text("plan_date").notNull(),
  outfitClientId: text("outfit_client_id").notNull(),
  occasion: text("occasion").notNull().default("daily"),
  worn: integer("worn", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("weekly_plan_owner_date_unique").on(table.ownerId, table.planDate),
  index("weekly_plan_owner_idx").on(table.ownerId),
  index("weekly_plan_outfit_idx").on(table.outfitClientId),
]);

export const styleProfiles = sqliteTable("style_profiles", {
  ownerId: text("owner_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  audience: text("audience").notNull().default("hombre"),
  exploration: integer("exploration").notNull().default(35),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const styleFamilyRatings = sqliteTable("style_family_ratings", {
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  family: text("family").notNull(),
  affinity: integer("affinity").notNull().default(50),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  reason: text("reason"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerId, table.family] }),
  index("style_family_ratings_owner_idx").on(table.ownerId),
  index("style_family_ratings_affinity_idx").on(table.ownerId, table.affinity),
]);
