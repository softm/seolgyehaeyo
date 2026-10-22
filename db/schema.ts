import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ProjectData } from "../lib/types";

// Private project state. Only server routes may use ownerId and objectKey.
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  data: text("data", { mode: "json" }).$type<ProjectData>().notNull(),
  version: integer("version").notNull().default(1),
  lastMutationId: text("last_mutation_id").notNull(),
  lifecycle: text("lifecycle", { enum: ["active", "deleting"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt)]);

// Snapshot history is append-only while a project exists. A permanent, confirmed
// project deletion removes its snapshots and original files together.
export const projectRevisions = sqliteTable("project_revisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  version: integer("version").notNull(),
  data: text("data", { mode: "json" }).$type<ProjectData>().notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("project_revisions_project_version_idx").on(table.projectId, table.version),
  index("project_revisions_owner_project_idx").on(table.ownerId, table.projectId),
]);

export const projectFiles = sqliteTable("project_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  objectKey: text("object_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  category: text("category").notNull(),
  versionLabel: text("version_label").notNull().default(""),
  sha256: text("sha256").notNull(),
  status: text("status", { enum: ["uploading", "ready", "cleanup", "cancelled"] }).notNull().default("uploading"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("project_files_object_key_idx").on(table.objectKey),
  index("project_files_owner_project_idx").on(table.ownerId, table.projectId),
]);
