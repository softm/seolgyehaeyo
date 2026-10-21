import { env } from "cloudflare:workers";
import { ZodError } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createProjectData, type Activity, type ProjectData, type ProjectFile, type ProjectRecord, type ProjectSummary } from "@/lib/types";
import { createProjectSchema, deleteProjectSchema, fileMetadataSchema, updateProjectSchema } from "./project-validation";

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const UPLOAD_RECOVERY_AFTER_MS = 15 * 60 * 1000;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };

type ProjectRow = { id: string; owner_id: string; data: string; version: number; last_mutation_id: string; lifecycle: "active" | "deleting"; created_at: string; updated_at: string };
type FileRow = { id: string; project_id: string; owner_id: string; object_key: string; original_name: string; mime_type: string; size: number; category: string; version_label: string; sha256: string; status: string; created_at: string };
type RevisionRow = { id: string; version: number; summary: string; created_at: string; data?: string };

export class ProjectApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}

export async function projectRoute(action: () => Promise<Response>): Promise<Response> {
  try { return await action(); }
  catch (error) {
    if (error instanceof ProjectApiError) return jsonResponse({ error: error.message, code: error.code, ...error.extra }, error.status);
    if (error instanceof ZodError) return jsonResponse({ error: error.issues[0]?.message || "입력 내용을 확인해 주세요.", code: "INVALID_INPUT", fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400);
    // Do not return SQL, object keys, identity headers, or project contents.
    console.error("[seolgyehaeyo-api]", error instanceof Error ? error.name : "UnexpectedError");
    return jsonResponse({ error: "저장소 처리에 실패했습니다. 입력 내용을 유지한 채 다시 시도해 주세요.", code: "STORAGE_ERROR" }, 503);
  }
}

export async function authorize(request: Request, mutation = false): Promise<string> {
  if (mutation) assertSameOrigin(request);
  const user = await getChatGPTUser();
  if (!user) throw new ProjectApiError(401, "SIGN_IN_REQUIRED", "프로젝트를 보관하거나 열려면 로그인해 주세요.");
  return user.userId;
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new ProjectApiError(403, "ORIGIN_NOT_ALLOWED", "이 사이트에서 다시 요청해 주세요.");
  if (origin) {
    let valid = false;
    try { valid = new URL(origin).origin === new URL(request.url).origin; } catch { /* invalid origin */ }
    if (!valid) throw new ProjectApiError(403, "ORIGIN_NOT_ALLOWED", "이 사이트에서 다시 요청해 주세요.");
  }
}

function database(): D1Database {
  if (!env.DB) throw new ProjectApiError(503, "DATABASE_UNAVAILABLE", "프로젝트 저장소를 연결하는 중입니다. 잠시 후 다시 시도해 주세요.");
  return env.DB;
}
function bucket(): R2Bucket {
  if (!env.BUCKET) throw new ProjectApiError(503, "FILES_UNAVAILABLE", "파일 보관함을 연결하는 중입니다. 잠시 후 다시 시도해 주세요.");
  return env.BUCKET;
}

function validId(value: string): void {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new ProjectApiError(404, "NOT_FOUND", "프로젝트 또는 자료를 찾을 수 없습니다.");
}

async function ownedProject(db: D1Database, ownerId: string, id: string, allowDeleting = false): Promise<ProjectRow> {
  validId(id);
  const row = await db.prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ?").bind(id, ownerId).first<ProjectRow>();
  if (!row) throw new ProjectApiError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  if (!allowDeleting && row.lifecycle === "deleting") throw new ProjectApiError(423, "PROJECT_DELETING", "삭제가 진행 중인 프로젝트입니다. 목록에서 영구삭제를 다시 시도해 주세요.");
  return row;
}

function projectRecord(row: ProjectRow): ProjectRecord {
  return { id: row.id, data: JSON.parse(row.data) as ProjectData, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicFile(row: FileRow): ProjectFile {
  return { id: row.id, projectId: row.project_id, originalName: row.original_name, mimeType: row.mime_type, size: row.size, category: row.category, versionLabel: row.version_label, createdAt: row.created_at };
}
function publicActivity(row: RevisionRow): Activity {
  return { id: row.id, version: row.version, summary: row.summary, createdAt: row.created_at };
}

// A terminated Worker can leave a reservation behind. Reconcile the committed
// object or fence off a late conditional put before releasing that reservation.
// The empty cancellation marker contains no original bytes, name, owner or hash.
// Retaining it prevents a very late uploader from recreating a deleted original.
async function recoverExpiredUploads(db: D1Database, ownerId: string, id: string): Promise<void> {
  const cutoff = new Date(Date.now() - UPLOAD_RECOVERY_AFTER_MS).toISOString();
  const pending = await db.prepare("SELECT * FROM project_files WHERE project_id = ? AND owner_id = ? AND status = 'uploading' AND created_at <= ?")
    .bind(id, ownerId, cutoff).all<FileRow>();
  if (!pending.results.length) return;
  const storage = bucket();
  for (const file of pending.results) {
    let object = await storage.head(file.object_key);
    if (!object) {
      await storage.put(file.object_key, new Uint8Array(0), {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: "application/octet-stream" },
        customMetadata: { uploadCancelled: "true" },
      });
      object = await storage.head(file.object_key);
    }
    if (object?.size === 0 && object.customMetadata?.uploadCancelled === "true") {
      await db.prepare("UPDATE project_files SET status = 'cancelled' WHERE id = ? AND project_id = ? AND owner_id = ? AND status = 'uploading'")
        .bind(file.id, id, ownerId).run();
    } else if (object?.size === file.size && object.customMetadata?.sha256 === file.sha256) {
      await db.prepare("UPDATE project_files SET status = 'ready' WHERE id = ? AND project_id = ? AND owner_id = ? AND status = 'uploading'")
        .bind(file.id, id, ownerId).run();
    } else {
      throw new ProjectApiError(503, "UPLOAD_RECOVERY_PENDING", "이전에 중단된 파일의 보관 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
}

async function readLimitedBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) throw new ProjectApiError(413, "REQUEST_TOO_LARGE", "한 번에 보낼 수 있는 크기를 초과했습니다.");
  if (!request.body) throw new ProjectApiError(400, "EMPTY_BODY", "입력 내용을 보내 주세요.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new ProjectApiError(413, "REQUEST_TOO_LARGE", "한 번에 보낼 수 있는 크기를 초과했습니다."); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ProjectApiError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
  const bytes = await readLimitedBytes(request, MAX_JSON_BYTES);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ProjectApiError(400, "INVALID_JSON", "입력 형식을 확인해 주세요."); }
}

export async function listProjects(request: Request): Promise<Response> {
  const ownerId = await authorize(request);
  const rows = await database().prepare(`SELECT id, json_extract(data, '$.name') AS name,
    json_extract(data, '$.kind') AS kind, json_extract(data, '$.phase') AS phase,
    json_extract(data, '$.archived') AS archived, version, lifecycle, updated_at
    FROM projects WHERE owner_id = ? ORDER BY updated_at DESC, id DESC`).bind(ownerId).all<{
      id: string; name: string; kind: ProjectSummary["kind"]; phase: ProjectSummary["phase"]; archived: number; version: number; lifecycle: string; updated_at: string;
    }>();
  return jsonResponse({ projects: rows.results.map((row) => ({ id: row.id, name: row.name, kind: row.kind, phase: row.phase, archived: Boolean(row.archived), version: row.version, updatedAt: row.updated_at, deletionPending: row.lifecycle === "deleting" })) });
}

export async function createProject(request: Request): Promise<Response> {
  const ownerId = await authorize(request, true);
  const input = createProjectSchema.parse(await readJson(request));
  const data = createProjectData(input);
  const id = crypto.randomUUID();
  const mutationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const serialized = JSON.stringify(data);
  const db = database();
  await db.batch([
    db.prepare("INSERT INTO projects (id, owner_id, data, version, last_mutation_id, lifecycle, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 'active', ?, ?)").bind(id, ownerId, serialized, mutationId, now, now),
    db.prepare("INSERT INTO project_revisions (id, project_id, owner_id, version, data, summary, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)").bind(mutationId, id, ownerId, serialized, "프로젝트를 만들었어요", now),
  ]);
  return jsonResponse({ project: { id, data, version: 1, createdAt: now, updatedAt: now } satisfies ProjectRecord }, 201);
}

export async function getProject(request: Request, id: string): Promise<Response> {
  const ownerId = await authorize(request);
  const db = database();
  const row = await ownedProject(db, ownerId, id);
  await recoverExpiredUploads(db, ownerId, id);
  const [files, revisions] = await Promise.all([
    db.prepare("SELECT * FROM project_files WHERE project_id = ? AND owner_id = ? AND status = 'ready' ORDER BY created_at DESC, id DESC").bind(id, ownerId).all<FileRow>(),
    db.prepare("SELECT id, version, summary, created_at FROM project_revisions WHERE project_id = ? AND owner_id = ? AND version <= ? ORDER BY version DESC LIMIT 30").bind(id, ownerId, row.version).all<RevisionRow>(),
  ]);
  return jsonResponse({ project: projectRecord(row), files: files.results.map(publicFile), activity: revisions.results.map(publicActivity) });
}

export async function updateProject(request: Request, id: string): Promise<Response> {
  const ownerId = await authorize(request, true);
  const input = updateProjectSchema.parse(await readJson(request));
  const db = database();
  const previous = await ownedProject(db, ownerId, id);
  if (previous.version !== input.version) throw new ProjectApiError(409, "VERSION_CONFLICT", "다른 화면에서 수정된 내용이 있습니다. 최신 내용을 다시 불러온 후 확인해 주세요.", { currentVersion: previous.version });
  const mutationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const serialized = JSON.stringify(input.data);
  const result = await db.batch([
    db.prepare("UPDATE projects SET data = ?, version = version + 1, last_mutation_id = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ? AND lifecycle = 'active'").bind(serialized, mutationId, now, id, ownerId, input.version),
    db.prepare(`INSERT INTO project_revisions (id, project_id, owner_id, version, data, summary, created_at)
      SELECT ?, id, owner_id, version, data, ?, ? FROM projects
      WHERE id = ? AND owner_id = ? AND last_mutation_id = ? AND version = ? AND lifecycle = 'active'`).bind(mutationId, input.summary, now, id, ownerId, mutationId, input.version + 1),
  ]);
  if (result[0].meta.changes !== 1) {
    const latest = await ownedProject(db, ownerId, id);
    throw new ProjectApiError(409, "VERSION_CONFLICT", "다른 화면에서 수정된 내용이 있습니다. 최신 내용을 다시 불러온 후 확인해 주세요.", { currentVersion: latest.version });
  }
  return jsonResponse({ project: { id, data: input.data, version: input.version + 1, createdAt: previous.created_at, updatedAt: now } satisfies ProjectRecord });
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", avif: "image/avif", heic: "image/heic", heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  dwg: "image/vnd.dwg", dxf: "application/dxf", txt: "text/plain; charset=utf-8",
};

function safeFilename(name: string): string {
  const normalized = name.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim();
  if (!normalized || normalized.length > 240) throw new ProjectApiError(400, "INVALID_FILENAME", "파일 이름은 240자 이내로 입력해 주세요.");
  return normalized;
}

function inspectFile(name: string, bytes: Uint8Array): string {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) throw new ProjectApiError(415, "UNSUPPORTED_FILE", "PDF, 이미지(SVG 제외), DOCX, XLSX, DWG, DXF, TXT 파일을 올릴 수 있어요.");
  const prefix = bytes.subarray(0, 1024);
  // Binary header offsets must stay byte-aligned (a RIFF length can contain
  // arbitrary bytes that a UTF-8 decoder would otherwise combine).
  const text = String.fromCharCode(...prefix);
  if (/<\s*(?:!doctype\s+html|html\b|svg\b|script\b)/i.test(text)) throw new ProjectApiError(415, "ACTIVE_CONTENT_NOT_ALLOWED", "HTML·SVG 등 실행 가능한 문서는 보관할 수 없어요.");
  const starts = (sequence: number[]) => sequence.every((value, index) => bytes[index] === value);
  let valid = false;
  switch (extension) {
    case "pdf": valid = text.startsWith("%PDF-"); break;
    case "jpg": case "jpeg": valid = starts([0xff, 0xd8, 0xff]); break;
    case "png": valid = starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case "gif": valid = /^GIF8[79]a/.test(text); break;
    case "webp": valid = text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"; break;
    case "bmp": valid = text.startsWith("BM"); break;
    case "tif": case "tiff": valid = starts([0x49, 0x49, 0x2a, 0]) || starts([0x4d, 0x4d, 0, 0x2a]); break;
    case "avif": valid = text.slice(4, 8) === "ftyp" && /avif|avis/.test(text.slice(8, 40)); break;
    case "heic": case "heif": valid = text.slice(4, 8) === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8, 40)); break;
    case "docx": case "xlsx": valid = starts([0x50, 0x4b, 0x03, 0x04]); break;
    case "dwg": valid = /^AC10\d{2}/.test(text); break;
    case "dxf": valid = /SECTION/.test(text) || text.startsWith("AutoCAD Binary DXF"); break;
    case "txt": {
      try { const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes); valid = !value.includes("\u0000") && !/<\s*(?:!doctype\s+html|html\b|svg\b|script\b)/i.test(value); } catch { valid = false; }
      break;
    }
  }
  if (!valid) throw new ProjectApiError(415, "FILE_TYPE_MISMATCH", "파일 내용과 확장자가 맞는지 확인해 주세요. TXT는 UTF-8 파일을 지원해요.");
  return mime;
}

function downloadDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") || "download";
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function uploadFile(request: Request, id: string): Promise<Response> {
  const ownerId = await authorize(request, true);
  const db = database();
  await ownedProject(db, ownerId, id);
  const storage = bucket();
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new ProjectApiError(415, "MULTIPART_REQUIRED", "파일 업로드 형식으로 요청해 주세요.");
  // Limit the whole request even when Content-Length is missing or inaccurate.
  const body = await readLimitedBytes(request, MAX_FILE_BYTES + 64 * 1024);
  let form: FormData;
  try { form = await new Response(body, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ProjectApiError(400, "INVALID_UPLOAD", "올릴 파일을 다시 선택해 주세요."); }
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new ProjectApiError(400, "FILE_REQUIRED", "올릴 파일을 선택해 주세요.");
  if (form.getAll("file").length !== 1) throw new ProjectApiError(400, "ONE_FILE_REQUIRED", "파일은 한 번에 하나씩 올려 주세요.");
  if (!file.size || file.size > MAX_FILE_BYTES) throw new ProjectApiError(413, "FILE_TOO_LARGE", "파일은 0바이트보다 크고 20MB 이하여야 해요.");
  const metadata = fileMetadataSchema.parse({ category: form.get("category") || "기타", versionLabel: form.get("versionLabel") || "" });
  const originalName = safeFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = inspectFile(originalName, bytes);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  const fileId = crypto.randomUUID();
  const objectKey = `projects/${id}/originals/${fileId}`;
  const now = new Date().toISOString();
  const reserved = await db.prepare(`INSERT INTO project_files (id, project_id, owner_id, object_key, original_name, mime_type, size, category, version_label, sha256, status, created_at)
    SELECT ?, id, owner_id, ?, ?, ?, ?, ?, ?, ?, 'uploading', ? FROM projects WHERE id = ? AND owner_id = ? AND lifecycle = 'active'`)
    .bind(fileId, objectKey, originalName, mimeType, bytes.byteLength, metadata.category, metadata.versionLabel, sha256, now, id, ownerId).run();
  if (reserved.meta.changes !== 1) { await ownedProject(db, ownerId, id); throw new ProjectApiError(409, "UPLOAD_RETRY", "프로젝트 상태를 확인한 후 다시 올려 주세요."); }
  let existingObject = false;
  try {
    const result = await storage.put(objectKey, bytes, { onlyIf: { etagDoesNotMatch: "*" }, sha256: digest, httpMetadata: { contentType: mimeType, contentDisposition: downloadDisposition(originalName) }, customMetadata: { sha256 } });
    if (!result) { existingObject = true; throw new ProjectApiError(409, "UPLOAD_EXPIRED", "중단된 업로드가 정리되었습니다. 파일을 다시 선택해 올려 주세요."); }
    const finalized = await db.prepare("UPDATE project_files SET status = 'ready' WHERE id = ? AND project_id = ? AND owner_id = ? AND status IN ('uploading', 'ready')").bind(fileId, id, ownerId).run();
    if (finalized.meta.changes !== 1) throw new ProjectApiError(503, "UPLOAD_INCOMPLETE", "파일 보관 확인에 실패했습니다.");
  } catch (error) {
    try {
      if (!existingObject) await storage.delete(objectKey);
      await db.prepare("DELETE FROM project_files WHERE id = ? AND project_id = ? AND owner_id = ?").bind(fileId, id, ownerId).run();
    } catch {
      // Preserve the object key so confirmed project deletion can retry cleanup.
      await db.prepare("UPDATE project_files SET status = CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE 'cleanup' END WHERE id = ? AND project_id = ? AND owner_id = ?").bind(fileId, id, ownerId).run();
    }
    throw error;
  }
  return jsonResponse({ file: { id: fileId, projectId: id, originalName, mimeType, size: bytes.byteLength, category: metadata.category, versionLabel: metadata.versionLabel, createdAt: now } satisfies ProjectFile }, 201);
}

export async function downloadFile(request: Request, id: string, fileId: string): Promise<Response> {
  const ownerId = await authorize(request);
  validId(fileId);
  const db = database();
  await ownedProject(db, ownerId, id);
  const row = await db.prepare("SELECT * FROM project_files WHERE id = ? AND project_id = ? AND owner_id = ? AND status = 'ready'").bind(fileId, id, ownerId).first<FileRow>();
  if (!row) throw new ProjectApiError(404, "FILE_NOT_FOUND", "자료를 찾을 수 없습니다.");
  const object = await bucket().get(row.object_key);
  if (!object) throw new ProjectApiError(404, "ORIGINAL_NOT_FOUND", "원본 파일을 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.");
  return new Response(object.body, { headers: { ...PRIVATE_HEADERS, "Content-Type": row.mime_type, "Content-Length": String(object.size), "Content-Disposition": downloadDisposition(row.original_name), "Content-Security-Policy": "sandbox; default-src 'none'", "ETag": object.httpEtag } });
}

export async function exportProject(request: Request, id: string): Promise<Response> {
  const ownerId = await authorize(request);
  const db = database();
  const row = await ownedProject(db, ownerId, id);
  const files = await db.prepare("SELECT * FROM project_files WHERE project_id = ? AND owner_id = ? AND status = 'ready' ORDER BY created_at, id").bind(id, ownerId).all<FileRow>();
  const exportedAt = new Date().toISOString();
  const project = projectRecord(row);
  async function* chunks(): AsyncGenerator<string> {
    yield JSON.stringify({ format: "seolgyehaeyo.project.v1", exportedAt, project, files: files.results.map((file) => ({ ...publicFile(file), sha256: file.sha256, downloadUrl: new URL(`/api/projects/${id}/files/${file.id}`, request.url).href })), fileNote: "이 파일은 프로젝트 기록과 원본 파일 목록을 담습니다. 원본 파일은 로그인 후 downloadUrl에서 별도로 내려받으세요." }).slice(0, -1) + ',"revisions":[';
    let after = 0;
    let first = true;
    while (true) {
      const page = await db.prepare("SELECT id, version, data, summary, created_at FROM project_revisions WHERE project_id = ? AND owner_id = ? AND version > ? AND version <= ? ORDER BY version LIMIT 10").bind(id, ownerId, after, row.version).all<RevisionRow>();
      if (!page.results.length) break;
      for (const revision of page.results) {
        yield `${first ? "" : ","}${JSON.stringify({ ...publicActivity(revision), data: JSON.parse(revision.data || "{}") })}`;
        first = false;
        after = revision.version;
      }
    }
    yield "]}";
  }
  const iterator = chunks();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }
      catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  });
  return new Response(body, { headers: { ...PRIVATE_HEADERS, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": downloadDisposition(`${project.data.name}-프로젝트기록-${exportedAt.slice(0, 10)}.json`) } });
}

export async function deleteProject(request: Request, id: string): Promise<Response> {
  const ownerId = await authorize(request, true);
  const input = deleteProjectSchema.parse(await readJson(request));
  const db = database();
  const previous = await ownedProject(db, ownerId, id, true);
  if (input.name !== projectRecord(previous).data.name) throw new ProjectApiError(400, "CONFIRMATION_MISMATCH", "영구삭제할 프로젝트 이름을 정확히 입력해 주세요.");
  if (input.version !== previous.version) throw new ProjectApiError(409, "VERSION_CONFLICT", "프로젝트 내용이 변경되었습니다. 최신 목록에서 다시 확인해 주세요.", { currentVersion: previous.version });
  const storage = bucket();
  if (previous.lifecycle === "active") {
    await recoverExpiredUploads(db, ownerId, id);
    const locked = await db.prepare(`UPDATE projects SET lifecycle = 'deleting', updated_at = ?
      WHERE id = ? AND owner_id = ? AND version = ? AND lifecycle = 'active'
      AND NOT EXISTS (SELECT 1 FROM project_files WHERE project_id = ? AND owner_id = ? AND status = 'uploading')`)
      .bind(new Date().toISOString(), id, ownerId, input.version, id, ownerId).run();
    if (locked.meta.changes !== 1) {
      const current = await ownedProject(db, ownerId, id, true);
      if (current.version !== input.version) throw new ProjectApiError(409, "VERSION_CONFLICT", "프로젝트 내용이 변경되었습니다. 최신 목록에서 다시 확인해 주세요.", { currentVersion: current.version });
      if (current.lifecycle !== "deleting") throw new ProjectApiError(409, "FILE_UPLOAD_IN_PROGRESS", "파일을 보관하는 중입니다. 업로드가 끝난 후 영구삭제를 다시 시도해 주세요.");
    }
  }
  try {
    const files = await db.prepare("SELECT object_key FROM project_files WHERE project_id = ? AND owner_id = ? AND status <> 'cancelled'").bind(id, ownerId).all<{ object_key: string }>();
    for (let offset = 0; offset < files.results.length; offset += 100) await storage.delete(files.results.slice(offset, offset + 100).map((file) => file.object_key));
    await db.batch([
      db.prepare("DELETE FROM project_files WHERE project_id = ? AND owner_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND lifecycle = 'deleting')").bind(id, ownerId, id, ownerId),
      db.prepare("DELETE FROM project_revisions WHERE project_id = ? AND owner_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND lifecycle = 'deleting')").bind(id, ownerId, id, ownerId),
      db.prepare("DELETE FROM projects WHERE id = ? AND owner_id = ? AND lifecycle = 'deleting'").bind(id, ownerId),
    ]);
  } catch {
    throw new ProjectApiError(503, "DELETE_INCOMPLETE", "삭제가 끝나지 않았습니다. 프로젝트는 잠금 상태로 유지되며 목록에서 영구삭제를 다시 시도할 수 있습니다.");
  }
  return jsonResponse({ deleted: true, id });
}
