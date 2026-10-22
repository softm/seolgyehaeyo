import { newId } from "@/lib/id";
import type { FieldSpec, FormSpec, FormValues } from "@/components/app-ui";
import {
  KINDS,
  PHASES,
  TASK_LABELS,
  type Change,
  type Contract,
  type CreateProjectInput,
  type Office,
  type Payment,
  type ProjectData,
  type ProjectNote,
  type Quote,
  type QuoteLine,
  type Task,
  type TaskCategory,
  type TaskStatus,
} from "@/lib/types";

export type SaveProject = (data: ProjectData, summary: string) => Promise<void>;

type Option<T extends string = string> = { value: T; label: string };

const KIND_OPTIONS = KINDS.map(({ id, label }) => ({ value: id, label }));
const PHASE_OPTIONS = PHASES.map(({ id, label }) => ({ value: id, label }));
const VERIFICATION_OPTIONS: Option<Office["verification"]>[] = [
  { value: "unverified", label: "아직 확인 전" },
  { value: "requested", label: "자료를 요청한 기록" },
  { value: "recorded", label: "내가 확인한 자료 기록" },
];
const SCOPE_OPTIONS: Option<QuoteLine["status"]>[] = [
  { value: "unknown", label: "아직 미정" },
  { value: "included", label: "포함" },
  { value: "separate", label: "별도" },
  { value: "excluded", label: "제외" },
];
const VAT_OPTIONS: Option<Quote["vat"]>[] = [
  { value: "unknown", label: "아직 확인 전" },
  { value: "included", label: "부가세 포함" },
  { value: "excluded", label: "부가세 별도" },
];
const QUOTE_SCOPES = [
  { key: "design", name: "설계" },
  { key: "permit", name: "인허가" },
  { key: "survey", name: "측량" },
  { key: "supervision", name: "감리" },
  { key: "visit", name: "현장방문" },
  { key: "changes", name: "추가변경" },
] as const;
const CONTRACT_OPTIONS: Option<Contract["status"]>[] = [
  { value: "draft", label: "계약 내용을 정리 중" },
  { value: "received", label: "계약서를 받은 기록" },
  { value: "signed", label: "서명본을 받은 기록" },
  { value: "amended", label: "변경 계약을 받은 기록" },
];
const PAYMENT_OPTIONS: Option<Payment["status"]>[] = [
  { value: "planned", label: "지급 예정 기록" },
  { value: "claimed", label: "청구를 받은 기록" },
  { value: "reviewing", label: "자료 확인 중" },
  { value: "paid", label: "내가 지급한 사실 기록" },
  { value: "disputed", label: "금액·조건에 이견 있음" },
];
const TASK_OPTIONS = (Object.entries(TASK_LABELS) as [TaskStatus, string][])
  .map(([value, label]) => ({ value, label }));
const CATEGORY_OPTIONS: Option<TaskCategory>[] = [
  { value: "work", label: "일반 업무·확인" },
  { value: "administrative", label: "행정절차" },
  { value: "handover", label: "자료 인수·정산" },
  { value: "repair", label: "남은 작업·보수" },
];
const CHANGE_OPTIONS: Option<Change["status"]>[] = [
  { value: "proposal", label: "변경 내용을 정리 중" },
  { value: "requested", label: "변경을 요청한 기록" },
  { value: "agreed", label: "합의 자료를 확인한 기록" },
  { value: "disputed", label: "의견이 다른 부분 있음" },
  { value: "cancelled", label: "변경 요청을 철회한 기록" },
];
const NOTE_TYPE_OPTIONS: Option<ProjectNote["type"]>[] = [
  { value: "question", label: "물어볼 질문" },
  { value: "note", label: "메모" },
  { value: "answer", label: "받은 답변 기록" },
];
const NOTE_STATUS_OPTIONS: Option<ProjectNote["status"]>[] = [
  { value: "open", label: "추가 확인할 내용 있음" },
  { value: "closed", label: "내가 확인을 마친 기록" },
];

function text(values: FormValues, name: string): string {
  return (values[name] ?? "").trim();
}

function requiredText(values: FormValues, name: string, label: string): string {
  const value = text(values, name);
  if (!value) throw new Error(`${label}을 적어주세요.`);
  return value;
}

function selected<T extends string>(
  values: FormValues,
  name: string,
  options: readonly Option<T>[],
  fallback: T,
  label: string,
): T {
  const value = text(values, name) || fallback;
  const option = options.find(item => item.value === value);
  if (!option) throw new Error(`${label}을 목록에서 다시 선택해 주세요.`);
  return option.value;
}

function optionalNumber(
  values: FormValues,
  name: string,
  label: string,
  allowNegative = false,
): number | null {
  const raw = text(values, name);
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label}은 소수점 없이 정확한 숫자로 적어주세요.`);
  }
  if (!allowNegative && value < 0) throw new Error(`${label}은 0 이상으로 적어주세요.`);
  return value;
}

function date(values: FormValues, name: string, label: string): string {
  const raw = text(values, name);
  if (!raw) return "";
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new Error(`${label}을 올바른 날짜로 적어주세요.`);
  }
  return raw;
}

function sourceUrl(values: FormValues): string {
  const raw = text(values, "sourceUrl");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
      throw new Error("invalid");
    }
    return raw;
  } catch {
    throw new Error("자료 출처는 http 또는 https로 시작하는 웹 주소로 적어주세요.");
  }
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some(existing => existing.id === item.id)
    ? items.map(existing => existing.id === item.id ? item : existing)
    : [...items, item];
}

function moneyField(name: string, label: string, initial: number | null, advanced = false): FieldSpec {
  return {
    name, label, type: "number", initial, min: 0, advanced,
    placeholder: "미정이면 비워두세요",
    hint: "빈칸은 미정, 0은 비용이 0원이라는 기록이에요.",
  };
}

export function projectForm(onCreate: (input: CreateProjectInput) => Promise<void>): FormSpec {
  return {
    title: "내 프로젝트 시작하기",
    description: "세 가지만 정하면 시작할 수 있어요. 자세한 내용은 나중에 채워도 괜찮아요.",
    submitLabel: "프로젝트 만들기",
    fields: [
      { name: "name", label: "프로젝트 이름", required: true, placeholder: "예: 우리집 설계 준비" },
      { name: "kind", label: "맡길 일", type: "select", required: true, options: KIND_OPTIONS, initial: "unknown" },
      { name: "phase", label: "지금 단계", type: "select", required: true, options: PHASE_OPTIONS, initial: "prepare", hint: "현재 상황을 고르는 항목이에요. 공식 절차의 완료 여부는 자료로 따로 확인해요." },
      { name: "location", label: "주소 또는 지역", advanced: true, placeholder: "지번을 아직 몰라도 지역부터 적을 수 있어요" },
      moneyField("budget", "예상 총예산 (원)", null, true),
      { name: "desiredDate", label: "희망 마무리 날짜", type: "date", advanced: true },
    ],
    async onSubmit(values) {
      await onCreate({
        name: requiredText(values, "name", "프로젝트 이름"),
        kind: selected(values, "kind", KIND_OPTIONS, "unknown", "맡길 일"),
        phase: selected(values, "phase", PHASE_OPTIONS, "prepare", "지금 단계"),
        location: text(values, "location"),
        budget: optionalNumber(values, "budget", "예상 총예산"),
        desiredDate: date(values, "desiredDate", "희망 마무리 날짜"),
      });
    },
  };
}

export function settingsForm(data: ProjectData, save: SaveProject): FormSpec {
  return {
    title: "프로젝트 정보 수정",
    description: "상황이 달라지면 단계와 계획도 함께 수정해요. 기존 자료와 할 일은 유지돼요. 맡길 일을 바꾸면 진행 화면에서 필요한 할 일을 추가하거나 해당 없음으로 정리해 주세요.",
    fields: [
      { name: "name", label: "프로젝트 이름", required: true, initial: data.name },
      { name: "kind", label: "맡길 일", type: "select", options: KIND_OPTIONS, initial: data.kind },
      { name: "phase", label: "지금 단계", type: "select", options: PHASE_OPTIONS, initial: data.phase, hint: "단계를 바꿔도 체크리스트나 공식 절차가 자동으로 완료되지는 않아요." },
      { name: "location", label: "주소 또는 지역", initial: data.location, advanced: true },
      { name: "goal", label: "하고 싶은 일과 중요한 조건", type: "textarea", initial: data.goal, advanced: true },
      moneyField("budget", "예상 총예산 (원)", data.budget, true),
      { name: "desiredDate", label: "희망 마무리 날짜", type: "date", initial: data.desiredDate, advanced: true },
      { name: "archived", label: "프로젝트 보관 상태", type: "select", initial: String(data.archived), advanced: true, options: [{ value: "false", label: "진행 목록에 두기" }, { value: "true", label: "보관 목록에 두기" }], hint: "보관은 삭제나 공식 절차의 완료를 뜻하지 않아요." },
    ],
    async onSubmit(values) {
      await save({
        ...data,
        name: requiredText(values, "name", "프로젝트 이름"),
        kind: selected(values, "kind", KIND_OPTIONS, data.kind, "맡길 일"),
        phase: selected(values, "phase", PHASE_OPTIONS, data.phase, "지금 단계"),
        location: text(values, "location"), goal: text(values, "goal"),
        budget: optionalNumber(values, "budget", "예상 총예산"),
        desiredDate: date(values, "desiredDate", "희망 마무리 날짜"),
        archived: selected(values, "archived", [{ value: "false", label: "진행" }, { value: "true", label: "보관" }], String(data.archived) as "true" | "false", "보관 상태") === "true",
      }, "프로젝트 정보 수정");
    },
  };
}

export function officeForm(data: ProjectData, save: SaveProject, office?: Office): FormSpec {
  const id = office?.id ?? newId();
  return {
    title: office ? "사무소 기록 수정" : "비교할 사무소 추가",
    description: "직접 받은 자료와 확인한 내용을 남겨요. 이 기록이 기관의 자격 확인을 대신하지는 않아요.",
    fields: [
      { name: "name", label: "사무소 이름", required: true, initial: office?.name },
      { name: "lead", label: "책임 담당자", initial: office?.lead, placeholder: "아직 모르면 비워두세요" },
      { name: "contact", label: "연락처·연락 방법", initial: office?.contact },
      { name: "verification", label: "내 확인 상태", type: "select", options: VERIFICATION_OPTIONS, initial: office?.verification ?? "unverified" },
      { name: "scope", label: "맡길 업무 범위", type: "textarea", initial: office?.scope, advanced: true },
      { name: "experience", label: "비슷한 일을 맡았던 경험", type: "textarea", initial: office?.experience, advanced: true, hint: "완료 사례와 이 사무소가 실제로 맡은 범위를 적어주세요." },
      { name: "registrationRef", label: "등록번호·받은 자료 이름", initial: office?.registrationRef, advanced: true },
      { name: "checkedAt", label: "자료를 확인한 날짜", type: "date", initial: office?.checkedAt, advanced: true },
      { name: "verificationNote", label: "확인한 자료·내용과 남은 질문", type: "textarea", initial: office?.verificationNote, advanced: true, hint: "확인 기록 상태로 저장하려면 이 메모와 확인 날짜가 필요해요. 기관에서 확인받았다면 그 결과도 구분해서 적어주세요." },
      { name: "sourceUrl", label: "자료 출처 주소", type: "url", initial: office?.sourceUrl, advanced: true, placeholder: "https://" },
      { name: "selected", label: "의뢰 후보 표시", type: "select", initial: String(office?.selected ?? false), advanced: true, options: [{ value: "false", label: "비교 중" }, { value: "true", label: "내가 선택한 사무소로 표시" }], hint: "계약 체결이나 상대방 동의를 뜻하는 표시는 아니에요." },
      { name: "memo", label: "상담·소통 메모", type: "textarea", initial: office?.memo, advanced: true },
    ],
    async onSubmit(values) {
      const verification = selected(values, "verification", VERIFICATION_OPTIONS, office?.verification ?? "unverified", "내 확인 상태");
      const checkedAt = date(values, "checkedAt", "자료 확인 날짜");
      const verificationNote = text(values, "verificationNote");
      if (verification === "recorded" && (!checkedAt || !verificationNote)) {
        throw new Error("추가 정보를 열어 확인 날짜와 확인한 자료·내용을 함께 적어주세요.");
      }
      const entry: Office = {
        id, name: requiredText(values, "name", "사무소 이름"), lead: text(values, "lead"),
        contact: text(values, "contact"), scope: text(values, "scope"), experience: text(values, "experience"),
        registrationRef: text(values, "registrationRef"), verification, verificationNote, checkedAt,
        sourceUrl: sourceUrl(values),
        selected: selected(values, "selected", [{ value: "false", label: "비교" }, { value: "true", label: "선택" }], String(office?.selected ?? false) as "true" | "false", "의뢰 후보 표시") === "true",
        memo: text(values, "memo"),
      };
      await save({ ...data, offices: upsert(data.offices, entry) }, office ? "사무소 기록 수정" : "비교할 사무소 추가");
    },
  };
}

export function quoteForm(data: ProjectData, save: SaveProject, quote?: Quote): FormSpec {
  const id = quote?.id ?? newId();
  const officeOptions: Option[] = [
    { value: "", label: "사무소는 나중에 연결할게요" },
    ...data.offices.map(office => ({ value: office.id, label: office.name })),
  ];
  if (quote?.officeId && !data.offices.some(office => office.id === quote.officeId)) {
    officeOptions.push({ value: quote.officeId, label: "기존 사무소 (현재 목록에 없음)" });
  }
  const matchedIds = new Set<string>();
  const scopes = QUOTE_SCOPES.map(scope => {
    const original = quote?.lines.find(line => line.name.trim() === scope.name && !matchedIds.has(line.id));
    if (original) matchedIds.add(original.id);
    return { ...scope, id: original?.id ?? newId(), original };
  });
  const customLines = (quote?.lines ?? []).filter(line => !matchedIds.has(line.id)).map(line => ({ ...line }));
  const scopeFields: FieldSpec[] = scopes.map(scope => ({
    name: `scope_${scope.key}`, label: `${scope.name} 범위`, type: "select",
    options: SCOPE_OPTIONS, initial: scope.original?.status ?? "unknown",
  }));
  const amountFields = scopes.map(scope => ({
    ...moneyField(`scopeAmount_${scope.key}`, `${scope.name}의 별도 금액 (원)`, scope.original?.amount ?? null, true),
    hint: "별도 비용이 정해졌다면 적어주세요. 견적 총액에는 자동 합산하지 않아요.",
  }));
  return {
    title: quote ? "견적 기록 수정" : "견적 기록 추가",
    description: "같은 여섯 가지 범위로 비교해요. 아직 모르는 금액은 비워두고, 받은 원본은 자료함에 따로 보관해요.",
    fields: [
      { name: "label", label: "견적 이름", required: true, initial: quote?.label, placeholder: "예: 1차 설계 견적" },
      { name: "officeId", label: "견적을 준 사무소", type: "select", options: officeOptions, initial: quote?.officeId ?? "" },
      moneyField("amount", "받은 견적 총액 (원)", quote?.amount ?? null),
      { name: "vat", label: "부가세", type: "select", options: VAT_OPTIONS, initial: quote?.vat ?? "unknown" },
      ...scopeFields, ...amountFields,
      { name: "memo", label: "원본 이름·날짜·추가 확인할 내용", type: "textarea", initial: quote?.memo, advanced: true, hint: customLines.length ? `기존에 기록한 기타 범위 ${customLines.length}개는 그대로 보관해요.` : "받은 견적의 파일명·날짜와 빠진 범위, 추가비 조건을 적어주세요." },
    ],
    async onSubmit(values) {
      const entry: Quote = {
        id, label: requiredText(values, "label", "견적 이름"),
        officeId: selected(values, "officeId", officeOptions, "", "견적 사무소"),
        amount: optionalNumber(values, "amount", "견적 총액"),
        vat: selected(values, "vat", VAT_OPTIONS, quote?.vat ?? "unknown", "부가세"),
        lines: [
          ...scopes.map(scope => ({
            id: scope.id, name: scope.name,
            status: selected(values, `scope_${scope.key}`, SCOPE_OPTIONS, scope.original?.status ?? "unknown", `${scope.name} 범위`),
            amount: optionalNumber(values, `scopeAmount_${scope.key}`, `${scope.name}의 별도 금액`),
          })),
          ...customLines,
        ],
        memo: text(values, "memo"),
      };
      await save({ ...data, quotes: upsert(data.quotes, entry) }, quote ? "견적 기록 수정" : "견적 기록 추가");
    },
  };
}

export function contractForm(data: ProjectData, save: SaveProject): FormSpec {
  const contract = data.contract;
  return {
    title: "계약 내용 정리",
    description: "받은 계약서와 약속한 범위를 옮겨 적어요. 모르는 내용은 비워두고 나중에 확인할 수 있어요.",
    fields: [
      { name: "party", label: "계약 상대방", initial: contract.party, placeholder: "사무소·개인·법인 이름" },
      { name: "status", label: "내가 받은 계약 자료", type: "select", options: CONTRACT_OPTIONS, initial: contract.status },
      moneyField("amount", "계약서에 적힌 금액 (원)", contract.amount),
      { name: "signedDate", label: "계약서의 서명 날짜", type: "date", initial: contract.signedDate, advanced: true },
      { name: "scope", label: "포함·별도·제외 업무", type: "textarea", initial: contract.scope, advanced: true, hint: "담당자, 별도 업체, 부가세·수수료가 포함되는지도 적어주세요." },
      { name: "deliverables", label: "받을 도면·서류·파일", type: "textarea", initial: contract.deliverables, advanced: true, hint: "자료 이름·형식·버전·인도 날짜와 계약서의 관련 항목을 적어주세요." },
      { name: "paymentTerms", label: "지급 시점과 확인할 결과물", type: "textarea", initial: contract.paymentTerms, advanced: true, hint: "설계·감리·공사대금 조건을 나눠 적어요. 감리비는 사용승인 신청 때 계약에 따른 지급 여부를 확인하는 절차가 있어요." },
      { name: "changeTerms", label: "변경·추가비를 정하는 방법", type: "textarea", initial: contract.changeTerms, advanced: true },
      { name: "handoverTerms", label: "마무리·중단 시 정산과 자료 인계", type: "textarea", initial: contract.handoverTerms, advanced: true, hint: "완료·중단 때 받을 자료와 이용 범위, 진행분 정산 방법을 적어주세요. 원본 계약서 파일은 자료함에 보관해요." },
    ],
    async onSubmit(values) {
      await save({
        ...data,
        contract: {
          ...contract,
          party: text(values, "party"),
          status: selected(values, "status", CONTRACT_OPTIONS, contract.status, "계약 자료 상태"),
          amount: optionalNumber(values, "amount", "계약 금액"),
          signedDate: date(values, "signedDate", "서명 날짜"),
          scope: text(values, "scope"), deliverables: text(values, "deliverables"),
          paymentTerms: text(values, "paymentTerms"), changeTerms: text(values, "changeTerms"),
          handoverTerms: text(values, "handoverTerms"), reviewed: [...contract.reviewed],
        },
      }, "계약 내용 수정");
    },
  };
}

export function paymentForm(data: ProjectData, save: SaveProject, payment?: Payment): FormSpec {
  const id = payment?.id ?? newId();
  return {
    title: payment ? "지급 기록 수정" : "지급 기록 추가",
    description: "약정한 지급 조건과 실제 지급한 사실을 구분해 남겨요. 여기에서 송금이 실행되지는 않아요.",
    fields: [
      { name: "label", label: "지급 항목 이름", required: true, initial: payment?.label, placeholder: "예: 설계 계약금 / 감리비" },
      moneyField("amount", "금액 (원)", payment?.amount ?? null),
      { name: "status", label: "내 지급 기록 상태", type: "select", options: PAYMENT_OPTIONS, initial: payment?.status ?? "planned" },
      { name: "dueDate", label: "약정 지급일", type: "date", initial: payment?.dueDate, advanced: true },
      { name: "paidDate", label: "실제로 지급한 날짜", type: "date", initial: payment?.paidDate, advanced: true },
      { name: "memo", label: "지급 조건·이체 증빙·확인 메모", type: "textarea", initial: payment?.memo, advanced: true, hint: "청구서·이체확인증 파일명, 받은 결과물, 이견이 있는 내용을 적어주세요. 파일은 자료함에 따로 보관해요." },
    ],
    async onSubmit(values) {
      const entry: Payment = {
        id, label: requiredText(values, "label", "지급 항목 이름"),
        amount: optionalNumber(values, "amount", "지급 금액"),
        status: selected(values, "status", PAYMENT_OPTIONS, payment?.status ?? "planned", "지급 기록 상태"),
        dueDate: date(values, "dueDate", "약정 지급일"),
        paidDate: date(values, "paidDate", "실제 지급일"), memo: text(values, "memo"),
      };
      await save({ ...data, payments: upsert(data.payments, entry) }, payment ? "지급 기록 수정" : "지급 기록 추가");
    },
  };
}

export function taskForm(data: ProjectData, save: SaveProject, task?: Task): FormSpec {
  const id = task?.id ?? newId();
  return {
    title: task ? "할 일·확인 기록 수정" : "할 일 추가",
    description: "내가 확인한 내용과 다음 행동을 기록해요. 행정절차는 접수와 결과문서를 구분해요.",
    fields: [
      { name: "title", label: "할 일 이름", required: true, initial: task?.title },
      { name: "phase", label: "관련 단계", type: "select", options: PHASE_OPTIONS, initial: task?.phase ?? data.phase },
      { name: "status", label: "내 확인 상태", type: "select", options: TASK_OPTIONS, initial: task?.status ?? "todo" },
      { name: "category", label: "확인 영역", type: "select", options: CATEGORY_OPTIONS, initial: task?.category ?? "work", advanced: true },
      { name: "assignee", label: "담당자·확인할 곳", initial: task?.assignee, advanced: true },
      { name: "dueDate", label: "다음 확인일·약속한 날짜", type: "date", initial: task?.dueDate, advanced: true },
      { name: "evidence", label: "확인한 자료·파일·접수번호", type: "textarea", initial: task?.evidence, advanced: true, hint: "실제로 확인한 원본 이름·버전·날짜 또는 공식 결과문서를 적어주세요." },
      { name: "note", label: "확인 내용·해당 없음 이유", type: "textarea", initial: task?.note, advanced: true, hint: "확인 기록에는 자료나 메모가, 해당 없음에는 이유가 필요해요." },
    ],
    async onSubmit(values) {
      const status = selected(values, "status", TASK_OPTIONS, task?.status ?? "todo", "확인 상태");
      const evidence = text(values, "evidence");
      const note = text(values, "note");
      if (status === "done" && !evidence && !note) {
        throw new Error("추가 정보를 열어 확인한 자료나 확인 내용을 하나 이상 적어주세요.");
      }
      if (status === "na" && !note) {
        throw new Error("추가 정보의 메모에 이 항목이 해당하지 않는 이유를 적어주세요.");
      }
      const entry: Task = {
        id, title: requiredText(values, "title", "할 일 이름"),
        phase: selected(values, "phase", PHASE_OPTIONS, task?.phase ?? data.phase, "관련 단계"),
        category: selected(values, "category", CATEGORY_OPTIONS, task?.category ?? "work", "확인 영역"),
        status, assignee: text(values, "assignee"), dueDate: date(values, "dueDate", "다음 확인일"), evidence, note,
      };
      await save({ ...data, tasks: upsert(data.tasks, entry) }, task ? "할 일·확인 기록 수정" : "할 일 추가");
    },
  };
}

export function changeForm(data: ProjectData, save: SaveProject, change?: Change): FormSpec {
  const id = change?.id ?? newId();
  const createdAt = change?.createdAt ?? new Date().toISOString();
  return {
    title: change ? "변경 기록 수정" : "변경 기록 추가",
    description: "달라지는 내용과 비용·기간, 받은 합의 자료를 함께 남겨요. 앱 기록이 상대방의 동의를 대신하지는 않아요.",
    fields: [
      { name: "title", label: "변경 이름", required: true, initial: change?.title, placeholder: "예: 출입구 위치 변경" },
      { name: "status", label: "내 변경 기록 상태", type: "select", options: CHANGE_OPTIONS, initial: change?.status ?? "proposal" },
      { name: "costDelta", label: "비용 증감 (원)", type: "number", initial: change?.costDelta, placeholder: "미정이면 비워두세요", hint: "추가 비용은 양수, 줄어드는 비용은 음수로 적어요. 0과 미정은 구분해요." },
      { name: "before", label: "변경 전 내용·도면 버전", type: "textarea", initial: change?.before, advanced: true },
      { name: "after", label: "변경 후 내용·도면 버전", type: "textarea", initial: change?.after, advanced: true },
      { name: "reason", label: "변경 이유·검토할 절차", type: "textarea", initial: change?.reason, advanced: true, hint: "변경 요청 이유와 구조·설비·인허가 영향, 전문가에게 확인할 내용을 적어주세요." },
      { name: "scheduleDays", label: "일정 증감 (일)", type: "number", initial: change?.scheduleDays, advanced: true, hint: "늘어나는 기간은 양수, 줄어드는 기간은 음수예요. 미정이면 비워두세요." },
      { name: "counterparty", label: "논의한 상대·검토 담당자", initial: change?.counterparty, advanced: true },
      { name: "agreedAt", label: "합의 자료에 적힌 날짜", type: "date", initial: change?.agreedAt, advanced: true },
      { name: "evidence", label: "합의·회신 자료와 확인 내용", type: "textarea", initial: change?.evidence, advanced: true, hint: "합의 자료를 확인한 기록으로 저장하려면 근거를 적어주세요. 원본 파일명·날짜·관련 내용을 남기고 자료함에 파일을 보관해요." },
    ],
    async onSubmit(values) {
      const status = selected(values, "status", CHANGE_OPTIONS, change?.status ?? "proposal", "변경 기록 상태");
      const evidence = text(values, "evidence");
      if (status === "agreed" && !evidence) {
        throw new Error("추가 정보를 열어 합의 내용을 확인한 자료와 근거를 적어주세요.");
      }
      const entry: Change = {
        id, title: requiredText(values, "title", "변경 이름"),
        before: text(values, "before"), after: text(values, "after"), reason: text(values, "reason"),
        costDelta: optionalNumber(values, "costDelta", "비용 증감", true),
        scheduleDays: optionalNumber(values, "scheduleDays", "일정 증감", true),
        status, counterparty: text(values, "counterparty"),
        agreedAt: date(values, "agreedAt", "합의 자료 날짜"), evidence, createdAt,
      };
      await save({ ...data, changes: upsert(data.changes, entry) }, change ? "변경 기록 수정" : "변경 기록 추가");
    },
  };
}

export function noteForm(data: ProjectData, save: SaveProject, note?: ProjectNote, questionText?: string): FormSpec {
  const id = note?.id ?? newId();
  const createdAt = note?.createdAt ?? new Date().toISOString();
  const defaultType = note?.type ?? (questionText ? "question" : "note");
  return {
    title: note ? "질문·메모 수정" : questionText ? "이 질문을 기록하기" : "질문·메모 추가",
    description: "물어볼 내용과 받은 답변, 다음 확인일을 한곳에 남겨요.",
    fields: [
      { name: "type", label: "기록 종류", type: "select", options: NOTE_TYPE_OPTIONS, initial: defaultType },
      { name: "text", label: "질문·메모 내용", type: "textarea", required: true, initial: note?.text ?? questionText },
      { name: "status", label: "내 확인 상태", type: "select", options: NOTE_STATUS_OPTIONS, initial: note?.status ?? "open" },
      { name: "answer", label: "받은 답변·후속 확인 내용", type: "textarea", initial: note?.answer, advanced: true, hint: "누가 언제 답했는지와 관련 자료 이름을 함께 적어주세요." },
      { name: "contact", label: "질문할 사람·연락 방법", initial: note?.contact, advanced: true },
      { name: "nextDate", label: "다음 확인일", type: "date", initial: note?.nextDate, advanced: true },
    ],
    async onSubmit(values) {
      const entry: ProjectNote = {
        id, type: selected(values, "type", NOTE_TYPE_OPTIONS, defaultType, "기록 종류"),
        text: requiredText(values, "text", "질문·메모 내용"), answer: text(values, "answer"),
        contact: text(values, "contact"), nextDate: date(values, "nextDate", "다음 확인일"),
        status: selected(values, "status", NOTE_STATUS_OPTIONS, note?.status ?? "open", "확인 상태"), createdAt,
      };
      await save({ ...data, notes: upsert(data.notes, entry) }, note ? "질문·메모 수정" : "질문·메모 추가");
    },
  };
}
