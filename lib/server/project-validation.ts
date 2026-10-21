import { z } from "zod";
import { FILE_CATEGORIES, KINDS, PHASES, type ProjectData } from "@/lib/types";

const kind = z.enum(KINDS.map((item) => item.id) as [typeof KINDS[number]["id"], ...typeof KINDS[number]["id"][]]);
const phase = z.enum(PHASES.map((item) => item.id) as [typeof PHASES[number]["id"], ...typeof PHASES[number]["id"][]]);
const shortText = z.string().max(500);
const longText = z.string().max(20_000);
const entryId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const money = z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
const signedMoney = z.number().finite().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable();
const date = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "날짜를 확인해 주세요.");
const timestamp = z.string().max(40).refine((value) => !value || !Number.isNaN(Date.parse(value)), "기록 시각을 확인해 주세요.");
const sourceUrl = z.string().max(2000).refine((value) => {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "http 또는 https 주소를 입력해 주세요.");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요.").max(120),
  kind, phase,
  location: z.string().max(500).optional(),
  budget: money.optional(),
  desiredDate: date.optional(),
}).strict();

const taskSchema = z.object({
  id: entryId, title: z.string().trim().min(1).max(300), phase,
  category: z.enum(["work", "administrative", "handover", "repair"]),
  status: z.enum(["todo", "waiting", "submitted", "supplement", "done", "na"]),
  assignee: shortText, dueDate: date, evidence: longText, note: longText,
}).strict().superRefine((task, ctx) => {
  if (task.status === "na" && !task.note.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "해당 없음으로 기록하는 이유를 남겨 주세요." });
  if (task.status === "done" && !task.evidence.trim() && !task.note.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"], message: "확인한 자료나 내용을 남겨 주세요." });
});

const officeSchema = z.object({
  id: entryId, name: z.string().trim().min(1).max(200), lead: shortText,
  contact: shortText, scope: longText, experience: longText, registrationRef: shortText,
  verification: z.enum(["unverified", "requested", "recorded"]),
  verificationNote: longText, sourceUrl, checkedAt: date,
  selected: z.boolean(), memo: longText,
}).strict().superRefine((office, ctx) => {
  if (office.verification === "recorded" && (!office.checkedAt || !office.verificationNote.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verificationNote"], message: "등록자료를 확인한 날짜와 확인 내용을 남겨 주세요." });
  }
});

const quoteLineSchema = z.object({
  id: entryId, name: z.string().max(300),
  status: z.enum(["included", "separate", "unknown", "excluded"]), amount: money,
}).strict();
const quoteSchema = z.object({
  id: entryId, officeId: z.string().max(100), label: shortText, amount: money,
  vat: z.enum(["included", "excluded", "unknown"]), lines: z.array(quoteLineSchema).max(200), memo: longText,
}).strict();

const contractSchema = z.object({
  status: z.enum(["draft", "received", "signed", "amended"]), party: shortText,
  scope: longText, deliverables: longText, paymentTerms: longText, changeTerms: longText, handoverTerms: longText,
  amount: money, signedDate: date, reviewed: z.array(z.string().max(300)).max(100),
}).strict();
const changeSchema = z.object({
  id: entryId, title: z.string().trim().min(1).max(300), before: longText, after: longText, reason: longText,
  costDelta: signedMoney, scheduleDays: z.number().finite().int().min(-100_000).max(100_000).nullable(),
  status: z.enum(["proposal", "requested", "agreed", "disputed", "cancelled"]),
  counterparty: shortText, agreedAt: date, evidence: longText, createdAt: timestamp,
}).strict().superRefine((change, ctx) => {
  if (change.status === "agreed" && !change.evidence.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"], message: "상대방과 합의한 근거를 남겨 주세요." });
  }
});
const noteSchema = z.object({
  id: entryId, type: z.enum(["question", "note", "answer"]), text: longText, answer: longText,
  contact: shortText, nextDate: date, status: z.enum(["open", "closed"]), createdAt: timestamp,
}).strict();
const paymentSchema = z.object({
  id: entryId, label: shortText, amount: money, dueDate: date,
  status: z.enum(["planned", "claimed", "reviewing", "paid", "disputed"]),
  paidDate: date, memo: longText,
}).strict();

export const projectDataSchema: z.ZodType<ProjectData> = z.object({
  name: z.string().trim().min(1).max(120), kind, location: shortText, goal: longText, phase,
  desiredDate: date, budget: money, archived: z.boolean(),
  offices: z.array(officeSchema).max(100), quotes: z.array(quoteSchema).max(200), contract: contractSchema,
  tasks: z.array(taskSchema).max(500), changes: z.array(changeSchema).max(1000),
  notes: z.array(noteSchema).max(1000), payments: z.array(paymentSchema).max(1000),
}).strict().superRefine((data, ctx) => {
  for (const field of ["offices", "quotes", "tasks", "changes", "notes", "payments"] as const) {
    const ids = data[field].map((item) => item.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "중복된 기록 식별자가 있습니다." });
  }
  const officeIds = new Set(data.offices.map((office) => office.id));
  data.quotes.forEach((quote, index) => {
    if (quote.officeId && !officeIds.has(quote.officeId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quotes", index, "officeId"], message: "견적과 연결된 사무소를 확인해 주세요." });
  });
});

export const updateProjectSchema = z.object({
  data: projectDataSchema,
  version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  summary: z.string().trim().min(1).max(300),
}).strict();
export const deleteProjectSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
}).strict();
export const fileMetadataSchema = z.object({
  category: z.string().refine((value) => FILE_CATEGORIES.includes(value), "자료 종류를 선택해 주세요."),
  versionLabel: z.string().trim().max(120),
});
