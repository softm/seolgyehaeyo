import { newId } from "@/lib/id";
export const PHASES = [
  { id: "prepare", label: "준비", hint: "원하는 일과 예산을 정리해요" },
  { id: "compare", label: "사무소 선정", hint: "같은 기준으로 비교해요" },
  { id: "contract", label: "계약", hint: "범위와 지급 조건을 맞춰요" },
  { id: "design", label: "설계", hint: "도면과 결정을 기록해요" },
  { id: "permit", label: "인허가", hint: "접수와 결과를 구분해요" },
  { id: "construction", label: "공사·변경", hint: "바뀐 내용과 근거를 남겨요" },
  { id: "completion", label: "마무리", hint: "승인·인수·보수를 확인해요" },
] as const;
export type Phase = (typeof PHASES)[number]["id"];
export const KINDS = [
  { id: "house", label: "주택 설계" },
  { id: "commercial", label: "상가·업무시설 설계" },
  { id: "land", label: "토지·토목" },
  { id: "survey", label: "측량" },
  { id: "mixed", label: "여러 업무" },
  { id: "unknown", label: "아직 모르겠어요" },
] as const;
export type ProjectKind = (typeof KINDS)[number]["id"];
export type TaskStatus = "todo" | "waiting" | "submitted" | "supplement" | "done" | "na";
export type TaskCategory = "work" | "administrative" | "handover" | "repair";
export interface Task {
  id: string; title: string; phase: Phase; category: TaskCategory; status: TaskStatus;
  assignee: string; dueDate: string; evidence: string; note: string;
}
export interface Office {
  id: string; name: string; lead: string; contact: string; scope: string; experience: string;
  registrationRef: string; verification: "unverified" | "requested" | "recorded";
  verificationNote: string; sourceUrl: string; checkedAt: string; selected: boolean; memo: string;
}
export interface QuoteLine {
  id: string; name: string; status: "included" | "separate" | "unknown" | "excluded"; amount: number | null;
}
export interface Quote {
  id: string; officeId: string; label: string; amount: number | null;
  vat: "included" | "excluded" | "unknown"; lines: QuoteLine[]; memo: string;
}
export interface Contract {
  status: "draft" | "received" | "signed" | "amended"; party: string;
  scope: string; deliverables: string; paymentTerms: string; changeTerms: string; handoverTerms: string;
  amount: number | null; signedDate: string; reviewed: string[];
}
export interface Change {
  id: string; title: string; before: string; after: string; reason: string;
  costDelta: number | null; scheduleDays: number | null;
  status: "proposal" | "requested" | "agreed" | "disputed" | "cancelled";
  counterparty: string; agreedAt: string; evidence: string; createdAt: string;
}
export interface ProjectNote {
  id: string; type: "question" | "note" | "answer"; text: string; answer: string;
  contact: string; nextDate: string; status: "open" | "closed"; createdAt: string;
}
export interface Payment {
  id: string; label: string; amount: number | null; dueDate: string;
  status: "planned" | "claimed" | "reviewing" | "paid" | "disputed";
  paidDate: string; memo: string;
}
export interface ProjectData {
  name: string; kind: ProjectKind; location: string; goal: string; phase: Phase;
  desiredDate: string; budget: number | null; archived: boolean;
  offices: Office[]; quotes: Quote[]; contract: Contract; tasks: Task[];
  changes: Change[]; notes: ProjectNote[]; payments: Payment[];
}
export interface ProjectRecord { id: string; data: ProjectData; version: number; createdAt: string; updatedAt: string }
export interface ProjectSummary { id: string; name: string; kind: ProjectKind; phase: Phase; archived: boolean; version: number; updatedAt: string; deletionPending?: boolean }
export interface ProjectFile {
  id: string; projectId: string; originalName: string; mimeType: string; size: number;
  category: string; versionLabel: string; createdAt: string;
}
export interface Activity { id: string; version: number; summary: string; createdAt: string }
export interface ProjectDetail { project: ProjectRecord; files: ProjectFile[]; activity: Activity[] }
export interface CreateProjectInput {
  name: string; kind: ProjectKind; phase: Phase; location?: string;
  budget?: number | null; desiredDate?: string;
}
export const TASK_LABELS: Record<TaskStatus, string> = {
  todo: "확인 전", waiting: "답변 기다리는 중", submitted: "접수·제출 기록", supplement: "보완 중", done: "자료·내용 확인 기록", na: "해당 없음",
};
export const FILE_CATEGORIES = ["계약·견적", "등록·자격", "설계도서", "행정 결과", "현장·보수", "기타"];
export function createProjectData(input: CreateProjectInput): ProjectData {
  const task = (title: string, phase: Phase, category: TaskCategory = "work"): Task => ({
    id: newId(), title, phase, category, status: "todo", assignee: "", dueDate: "", evidence: "", note: "",
  });
  const building = ["house", "commercial", "mixed", "unknown"].includes(input.kind);
  return {
    name: input.name, kind: input.kind, phase: input.phase, location: input.location || "", goal: "",
    budget: input.budget ?? null, desiredDate: input.desiredDate || "", archived: false,
    offices: [], quotes: [], changes: [], notes: [], payments: [],
    contract: { status: "draft", party: "", scope: "", deliverables: "", paymentTerms: "", changeTerms: "", handoverTerms: "", amount: null, signedDate: "", reviewed: [] },
    tasks: [
      task("어떤 일을 누구에게 맡길지 정리해요", "prepare"),
      task("책임 담당자와 등록자료를 확인해요", "compare"),
      task("같은 업무 범위로 견적을 비교해요", "compare"),
      task("포함 업무와 받을 자료를 계약서에 남겨요", "contract"),
      task("지급 조건과 변경 비용 협의 방법을 확인해요", "contract"),
      task("받은 도면의 날짜·버전과 결정 내용을 기록해요", "design"),
      ...(input.kind === "land" || input.kind === "survey" || input.kind === "mixed" ? [task("측량 목적·종목과 받을 성과물을 확인해요", "prepare")] : []),
      task("필요한 허가·신고와 담당 기관을 확인해요", "permit", "administrative"),
      task("접수번호·보완 요청·처리 결과를 따로 받아요", "permit", "administrative"),
      ...(building ? [task("설계·감리·시공 담당과 계약 범위를 확인해요", "construction"), task("변경 비용·일정과 합의 자료를 기록해요", "construction")] : []),
      task(building ? "사용승인 등 해당 행정 결과문서를 받아요" : "필요한 행정절차의 처리 결과를 확인해요", "completion", "administrative"),
      task("최종 도면·보고서 등 약정 자료를 인수해요", "completion", "handover"),
      task("남은 작업·보수와 담당자·기한을 확인해요", "completion", "repair"),
      task("약정 대금과 실제 지급·정산 내용을 대조해요", "completion", "handover"),
    ],
  };
}
export function toSummary(project: ProjectRecord): ProjectSummary {
  return { id: project.id, name: project.data.name, kind: project.data.kind, phase: project.data.phase,
    archived: project.data.archived, version: project.version, updatedAt: project.updatedAt };
}
