/**
 * Integration checks against the local preview only.
 * The test identities are HTTP fixtures, never an application authentication bypass.
 * Requests and redirects to hosted or non-loopback servers are prohibited here.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

const base = new URL(process.env.SEOLGYE_TEST_URL || "http://127.0.0.1:4173");
function requireLocal(url) {
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password) {
    throw new Error("API fixtures may only be sent to an HTTP localhost or 127.0.0.1 preview.");
  }
}
requireLocal(base);
if (base.pathname !== "/" || base.search || base.hash) throw new Error("The local test URL must be an origin without a path, query, or fragment.");
const runId = randomUUID();
const users = { a: `local-api-fixture-a-${runId}`, b: `local-api-fixture-b-${runId}` };
const fixtures = new Map();
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions++; };

async function request(path, { user = "a", method = "GET", body, headers = {} } = {}) {
  const url = new URL(path, base);
  requireLocal(url);
  if (url.origin !== base.origin) throw new Error("A test request attempted to leave the selected local origin.");
  const requestHeaders = new Headers(headers);
  if (user) {
    requestHeaders.set("oai-authenticated-user-id", users[user]);
    requestHeaders.set("oai-authenticated-user-email", `${users[user]}@example.invalid`);
  }
  if (method !== "GET" && !requestHeaders.has("Origin")) requestHeaders.set("Origin", base.origin);
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    requestHeaders.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  return fetch(url, { method, headers: requestHeaders, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
}

async function status(response, expected, label) {
  if (response.status !== expected) {
    const detail = (await response.clone().text()).slice(0, 500);
    throw new Error(`${label}: expected HTTP ${expected}, received ${response.status}: ${detail}`);
  }
  assertions++;
  // The local preview gateway can reject a cross-origin write before it reaches
  // the route. Its plain-text 403 has no private project data or app headers.
  if (expected !== 403 || response.headers.get("Content-Type")?.includes("application/json")) {
    check(response.headers.get("Cache-Control")?.includes("no-store"), `${label}: private response must not be cached`);
  }
  return response;
}

async function json(path, options, expected = 200, label = path) {
  return (await status(await request(path, options), expected, label)).json();
}

function upload(bytes, filename, versionLabel = "1차") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/octet-stream" }), filename);
  form.append("category", "설계도서");
  form.append("versionLabel", versionLabel);
  return form;
}

async function removeFixture(id, user) {
  const list = await json("/api/projects", { user });
  const entry = list.projects.find((project) => project.id === id);
  if (!entry) return;
  if (!entry.name.startsWith(`__API검증_${runId}`)) throw new Error("Refusing to remove a project without this run's fixture prefix.");
  await json(`/api/projects/${id}`, { user, method: "DELETE", body: { name: entry.name, version: entry.version } }, 200, "fixture cleanup");
}

try {
  await status(await request("/api/projects", { user: null }), 401, "anonymous read");
  await status(await request("/api/projects", { method: "POST", headers: { Origin: "https://external.example.invalid" }, body: { name: "blocked", kind: "house", phase: "prepare" } }), 403, "cross-origin write");

  const created = await json("/api/projects", { method: "POST", body: { name: `__API검증_${runId}_A`, kind: "house", phase: "prepare", budget: null } }, 201, "create project");
  let project = created.project;
  fixtures.set(project.id, "a");
  check(project.version === 1 && project.data.budget === null, "new project starts at version 1 and preserves unknown budget");
  const path = `/api/projects/${project.id}`;
  const loaded = await json(path);
  assert.deepEqual(loaded.project, project); assertions++;
  check(loaded.activity.length === 1 && loaded.files.length === 0, "new project restores its initial revision without fake files");
  const ownList = await json("/api/projects");
  check(ownList.projects.some((item) => item.id === project.id), "created project appears in its owner's list");
  const otherList = await json("/api/projects", { user: "b" });
  check(!otherList.projects.some((item) => item.id === project.id), "another owner cannot list the project");
  await status(await request(path, { user: "b" }), 404, "another owner detail");
  await status(await request(path, { user: "b", method: "PUT", body: { data: project.data, version: 1, summary: "blocked ownership change" } }), 404, "another owner update");
  await status(await request(path, { user: "b", method: "DELETE", body: { name: project.data.name, version: 1 } }), 404, "another owner delete");

  const second = await json("/api/projects", { user: "b", method: "POST", body: { name: `__API검증_${runId}_B`, kind: "survey", phase: "compare" } }, 201, "second owner's project");
  fixtures.set(second.project.id, "b");
  await status(await request(`/api/projects/${second.project.id}`), 404, "first owner cannot read second owner's project");

  const originalVersion = project.version;
  project = (await json(path, { method: "PUT", body: { data: { ...project.data, goal: "다시 접속해도 기록이 남는지 확인" }, version: project.version, summary: "목표를 기록했어요" } }, 200, "save project")).project;
  check(project.version === originalVersion + 1, "a saved update advances the version");
  await status(await request(path, { method: "PUT", body: { data: { ...project.data, goal: "stale overwrite" }, version: originalVersion, summary: "stale write" } }), 409, "stale update conflict");
  const refreshed = await json(path);
  check(refreshed.project.data.goal === project.data.goal && refreshed.activity.length === 2, "conflicting writes neither overwrite the project nor append a revision");
  check(!JSON.stringify(refreshed).includes("owner_id") && !JSON.stringify(refreshed).includes("object_key"), "private storage internals are not returned");

  const firstTask = project.data.tasks[0];
  await status(await request(path, { method: "PUT", body: { data: { ...project.data, tasks: [{ ...firstTask, status: "done", evidence: "", note: "" }] }, version: project.version, summary: "invalid completion" } }), 400, "completion requires evidence");
  await status(await request(path, { method: "PUT", body: { data: { ...project.data, tasks: [{ ...firstTask, status: "na", evidence: "자료만 있음", note: "" }] }, version: project.version, summary: "invalid not-applicable" } }), 400, "not-applicable requires a reason");
  await status(await request("/api/projects", { method: "POST", body: { name: "bad amount", kind: "house", phase: "prepare", budget: -1 } }), 400, "negative budget rejected");
  await status(await request("/api/projects", { method: "POST", body: { name: "owner injection", kind: "house", phase: "prepare", ownerId: users.b } }), 400, "owner injection rejected");
  await status(await request("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "x".repeat(1024 * 1024 + 100), kind: "house", phase: "prepare" }) }), 413, "JSON request size limited");

  const filename = "설계도면 확인 기록.txt";
  const original = Buffer.from("설계해요 원본 확인\n변경 전 도면 검토 메모\n", "utf8");
  const newer = Buffer.from("설계해요 원본 확인\n변경 후 도면 검토 메모\n", "utf8");
  const uploaded = await json(`${path}/files`, { method: "POST", body: upload(original, filename) }, 201, "upload original");
  const fileId = uploaded.file.id;
  check(uploaded.file.originalName === filename && uploaded.file.size === original.length, "file metadata preserves Korean name and byte length");
  const downloaded = await status(await request(`${path}/files/${fileId}`), 200, "download original");
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  assert.deepEqual(downloadedBytes, original); assertions++;
  check(createHash("sha256").update(downloadedBytes).digest("hex") === createHash("sha256").update(original).digest("hex"), "original hash survives server storage");
  check(downloaded.headers.get("Content-Disposition")?.startsWith("attachment;"), "untrusted original is returned as an attachment");
  check(decodeURIComponent(downloaded.headers.get("Content-Disposition").split("filename*=UTF-8''")[1]) === filename, "download preserves Korean filename");
  check(downloaded.headers.get("X-Content-Type-Options") === "nosniff", "download disables MIME sniffing");
  const uploadedAgain = await json(`${path}/files`, { method: "POST", body: upload(newer, filename, "2차") }, 201, "upload separate revision");
  check(uploadedAgain.file.id !== fileId, "new file version gets a distinct immutable identity");
  const oldAgain = Buffer.from(await (await status(await request(`${path}/files/${fileId}`), 200, "old version remains")).arrayBuffer());
  assert.deepEqual(oldAgain, original); assertions++;
  const newAgain = Buffer.from(await (await status(await request(`${path}/files/${uploadedAgain.file.id}`), 200, "new version download")).arrayBuffer());
  assert.deepEqual(newAgain, newer); assertions++;
  await status(await request(`${path}/files/${fileId}`, { user: "b" }), 404, "another owner download");
  await status(await request(`${path}/files`, { user: "b", method: "POST", body: upload(original, filename) }), 404, "another owner upload");
  await status(await request(`${path}/files`, { method: "POST", body: upload(Buffer.from("<html>active</html>"), "active.html") }), 415, "active HTML rejected");
  await status(await request(`${path}/files`, { method: "POST", body: upload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "fake.png") }), 415, "disguised SVG rejected");
  const restoredFiles = await json(path);
  check(restoredFiles.files.length === 2, "both original versions restore after a fresh request");

  const exported = await json(`${path}/export`);
  check(exported.project.id === project.id && exported.revisions.length === 2 && exported.files.length === 2, "export contains the current project, complete revision history, and file manifest");
  check(exported.files.find((item) => item.id === fileId)?.sha256 === createHash("sha256").update(original).digest("hex"), "export manifest contains the original checksum");
  check(exported.fileNote.includes("별도로"), "JSON export explains separate original file downloads");
  await status(await request(`${path}/export`, { user: "b" }), 404, "another owner export");

  project = (await json(path, { method: "PUT", body: { data: { ...project.data, archived: true }, version: project.version, summary: "프로젝트 보관" } }, 200, "archive project")).project;
  check((await json("/api/projects")).projects.find((item) => item.id === project.id)?.archived === true, "archive persists in project list");
  project = (await json(path, { method: "PUT", body: { data: { ...project.data, archived: false }, version: project.version, summary: "프로젝트 다시 진행" } }, 200, "restore project")).project;
  check((await json(path)).project.data.archived === false, "archived project restores");
  await status(await request(path, { method: "DELETE", body: { name: "wrong confirmation", version: project.version } }), 400, "delete requires exact name");
  await status(await request(path, { method: "DELETE", body: { name: project.data.name, version: 1 } }), 409, "delete requires current version");
  await json(path, { method: "DELETE", body: { name: project.data.name, version: project.version } }, 200, "permanent delete");
  fixtures.delete(project.id);
  await status(await request(path), 404, "deleted project missing");
  await status(await request(`${path}/files/${fileId}`), 404, "deleted originals cannot be downloaded");
  check(!(await json("/api/projects")).projects.some((item) => item.id === project.id), "deleted project is absent from list");
  console.log(JSON.stringify({ result: "passed", assertions, scope: "local authenticated HTTP, D1 records, R2 originals, two-owner isolation, concurrency, export, archive, permanent deletion" }));
} finally {
  const failures = [];
  for (const [id, user] of fixtures) {
    try { await removeFixture(id, user); }
    catch (error) { failures.push({ id, error: error.message }); }
  }
  if (failures.length) {
    console.error(JSON.stringify({ fixtureCleanupFailed: failures }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ fixtureCleanup: "complete" }));
  }
}
