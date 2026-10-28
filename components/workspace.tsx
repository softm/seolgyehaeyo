"use client";
import { newId } from "@/lib/id";
import { projectDataSchema } from "@/lib/server/project-validation";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Building2, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Clock3, FileText, FolderOpen, House, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sprout, Upload, Wallet, X } from "lucide-react";
import { PHASES, KINDS, TASK_LABELS, FILE_CATEGORIES, toSummary, type ProjectData, type ProjectSummary, type ProjectRecord, type ProjectDetail, type Task, type ProjectFile } from "@/lib/types";
import { createDemo } from "@/lib/demo";
import { GUIDE_CARDS, OFFICIAL_LINKS, QUESTIONS, REVIEWED_AT } from "@/lib/guide";
import { Badge, CopyButton, Empty, ExternalLink, FormDialog, type FormSpec } from "./app-ui";
import { changeForm, contractForm, noteForm, officeForm, paymentForm, projectForm, quoteForm, settingsForm, taskForm } from "./project-editors";

type Tab = "overview" | "offices" | "contract" | "progress" | "files" | "completion" | "guide" | "settings";
const NAV: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "overview", label: "한눈에 보기", icon: LayoutDashboard }, { id: "offices", label: "사무소·견적", icon: Building2 },
  { id: "contract", label: "계약·비용", icon: Wallet }, { id: "progress", label: "진행·변경", icon: ClipboardCheck },
  { id: "files", label: "자료함", icon: FolderOpen }, { id: "completion", label: "마무리", icon: CheckCircle2 },
];
const money = (value: number | null) => value === null ? "아직 미정" : `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const compactMoney = money;
const dateText = (value: string) => value ? value.slice(0, 10).replaceAll("-", ".") : "아직 정하지 않음";
const phaseLabel = (id: string) => PHASES.find(p => p.id === id)?.label || id;
const kindLabel = (id: string) => KINDS.find(k => k.id === id)?.label || id;
const questionCount = (data: ProjectData) => data.notes.filter(n => n.type === "question" && n.status === "open").length;
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers } });
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok && body.code === "VERSION_CONFLICT") throw new Error("다른 화면에서 기록이 바뀌었어요. 아래에서 입력 내용을 복사한 뒤 창을 닫고 ‘새로 불러오기’를 눌러 최신 내용과 대조해 주세요. 지금 입력은 이 창에 그대로 남아 있어요.");
  if (!response.ok) throw new Error(body.error || (response.status === 401 ? "로그인이 필요해요. 다시 로그인한 뒤 시도해 주세요." : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."));
  return body as T;
}

export default function Workspace({ user, demo = false }: { user: { displayName: string; email: string } | null; demo?: boolean }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(() => demo ? createDemo() : null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(!!user && !demo);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormSpec | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [taskFilter, setTaskFilter] = useState("current");
  const mutationLock = useRef(false);
  const sequence = useRef(0);
  const active = detail?.project;
  const data = active?.data;
  const signIn = `/signin-with-chatgpt?returnTo=${encodeURIComponent("/")}`;

  const openProject = useCallback(async (id: string) => {
    const request = ++sequence.current; setLoading(true); setLoadError(""); setMobileMenu(false);
    try {
      const result = await api<ProjectDetail>(`/api/projects/${id}`);
      if (request !== sequence.current) return;
      setDetail(result); setTab("overview");
      window.history.replaceState(null, "", `/?project=${encodeURIComponent(id)}`);
    } catch (error) { if (request === sequence.current) { setLoadError(error instanceof Error ? error.message : "프로젝트를 불러오지 못했어요."); setDetail(null); } }
    finally { if (request === sequence.current) setLoading(false); }
  }, []);
  const loadProjects = useCallback(async () => {
    if (!user || demo) return;
    setLoading(true); setLoadError("");
    try {
      const result = await api<{ projects: ProjectSummary[] }>("/api/projects"); setProjects(result.projects);
      const query = new URLSearchParams(window.location.search).get("project");
      const startingNew = new URLSearchParams(window.location.search).get("new") === "1";
      const first = startingNew ? undefined : query || result.projects.find(p => !p.archived && !p.deletionPending)?.id;
      if (first) await openProject(first); else setLoading(false);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "목록을 불러오지 못했어요."); setLoading(false); }
  }, [user, demo, openProject]);
  useEffect(() => { void loadProjects(); }, [loadProjects]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 6500); return () => window.clearTimeout(timer); }, [toast]);

  async function save(next: ProjectData, summary: string) {
    if (!active || demo) throw new Error("예시 화면은 읽기 전용이에요. 내 프로젝트를 만들어 기록해 주세요.");
    if (mutationLock.current) throw new Error("이전 기록을 저장하고 있어요. 잠시 뒤 다시 시도해 주세요.");
    mutationLock.current = true; setBusy(true);
    try {
      const result = await api<{ project: ProjectRecord }>(`/api/projects/${active.id}`, { method: "PUT", body: JSON.stringify({ data: next, version: active.version, summary }) });
      setDetail(current => current?.project.id === result.project.id ? { ...current, project: result.project, activity: [{ id: newId(), version: result.project.version, summary, createdAt: result.project.updatedAt }, ...current.activity].slice(0, 30) } : current);
      setProjects(list => list.map(p => p.id === result.project.id ? toSummary(result.project) : p)); setToast("서버에 기록을 저장했어요.");
    } finally { mutationLock.current = false; setBusy(false); }
  }
  function edit(spec: FormSpec) { if (demo) { setToast("가상 예시는 읽기 전용이에요. ‘내 프로젝트 시작’으로 직접 기록할 수 있어요."); return; } setForm(spec); }
  async function action(work: () => Promise<void>) { try { await work(); } catch (error) { setToast(error instanceof Error ? error.message : "처리하지 못했어요."); } }
  function newProject() {
    if (mutationLock.current) { setToast("저장 중인 기록을 마친 뒤 새 프로젝트를 만들 수 있어요."); return; }
    if (!user) { window.location.assign(signIn); return; }
    if (demo) { window.location.assign("/?new=1"); return; }
    setForm(projectForm(async input => {
      const result = await api<{ project: ProjectRecord }>("/api/projects", { method: "POST", body: JSON.stringify(input) });
      sequence.current += 1; setLoading(false); setProjects(list => [toSummary(result.project), ...list]);
      setDetail({ project: result.project, files: [], activity: [] }); setTab("overview"); setLoadError("");
      window.history.replaceState(null, "", `/?project=${result.project.id}`); setToast("프로젝트를 만들었어요. 지금 필요한 일부터 시작해요.");
    }));
  }
  useEffect(() => {
    if (user && !demo && !loading && new URLSearchParams(window.location.search).get("new") === "1") {
      window.history.replaceState(null, "", "/");
      setForm(projectForm(async input => { const result = await api<{ project: ProjectRecord }>("/api/projects", { method: "POST", body: JSON.stringify(input) }); sequence.current += 1; setLoading(false); setProjects(list => [toSummary(result.project), ...list]); setDetail({ project: result.project, files: [], activity: [] }); setTab("overview"); window.history.replaceState(null, "", `/?project=${result.project.id}`); }));
    }
  }, [user, demo, loading]);
  // Common account snapshots are explicit copies. Existing D1 ownership stays unchanged.
  useEffect(() => {
    const bridgeWindow = window as typeof window & { SoftmSiteState?: unknown };
    const bridge = {
      siteId: "seolgyehaeyo",
      scope: () => active?.id || "no-project",
      read() {
        if (!active || !user || demo || loading || mutationLock.current) throw new Error("내 프로젝트를 먼저 열고 저장 중인 작업을 마쳐 주세요.");
        return projectDataSchema.parse(structuredClone(active.data));
      },
      validate: (value: unknown) => projectDataSchema.parse(value),
      async write(value: unknown) {
        if (!user || demo) throw new Error("설계해요 작업실에 로그인한 뒤 새 프로젝트 사본으로 복원해 주세요.");
        if (form || mutationLock.current) throw new Error("작성 중인 내용을 먼저 저장하거나 복사해 주세요.");
        const next = projectDataSchema.parse(value);
        mutationLock.current = true; setBusy(true);
        let created: ProjectRecord | null = null;
        try {
          const result = await api<{ project: ProjectRecord }>("/api/projects", {
            method: "POST",
            body: JSON.stringify({ name: (next.name + " · 복원본").slice(0, 120), kind: next.kind, phase: next.phase, location: next.location }),
          });
          created = result.project;
          setProjects(list => [toSummary(result.project), ...list]);
          const saved = await api<{ project: ProjectRecord }>(`/api/projects/${result.project.id}`, {
            method: "PUT",
            body: JSON.stringify({ data: { ...next, name: result.project.data.name }, version: result.project.version, summary: "공통 암호화 보관소에서 새 사본 복원" }),
          });
          setDetail({ project: saved.project, files: [], activity: [] });
          setProjects(list => list.map(item => item.id === saved.project.id ? toSummary(saved.project) : item));
          setTab("overview"); window.history.replaceState(null, "", "?project=" + encodeURIComponent(saved.project.id));
          setToast("프로젝트 기록을 새 사본으로 복원했습니다. 원본 첨부파일은 기존 프로젝트에서 별도로 보관해 주세요.");
        } catch (error) {
          if (created) {
            await openProject(created.id);
            throw new Error("복원 사본을 만들었지만 저장 완료를 확인하지 못했습니다. 열린 사본을 확인한 뒤 다시 시도해 주세요.");
          }
          throw error;
        } finally { mutationLock.current = false; setBusy(false); }
      },
    };
    bridgeWindow.SoftmSiteState = bridge;
    return () => { if (bridgeWindow.SoftmSiteState === bridge) delete bridgeWindow.SoftmSiteState; };
  }, [active, user, demo, loading, form, openProject]);

  function changeTab(next: Tab) { setTab(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function deleteProject(project: ProjectSummary) {
    setForm({ title: "프로젝트를 영구 삭제할까요?", description: "기록, 변경 이력, 업로드한 원본 파일이 함께 삭제됩니다. 필요한 기록과 원본을 먼저 내려받아 주세요. 삭제한 자료는 앱에서 복구할 수 없어요.", danger: true, submitLabel: "기록과 원본 영구 삭제", fields: [{ name: "name", label: `‘${project.name}’을 그대로 입력해 주세요`, required: true }], onSubmit: async values => {
      if (values.name !== project.name) throw new Error("프로젝트 이름이 일치하지 않아요.");
      await api(`/api/projects/${project.id}`, { method: "DELETE", body: JSON.stringify({ name: values.name, version: project.version }) });
      setProjects(list => list.filter(p => p.id !== project.id)); setDetail(null); window.history.replaceState(null, "", "/"); setToast("프로젝트 기록과 원본 파일을 삭제했어요.");
    } });
  }

  const currentTasks = data?.tasks.filter(t => t.phase === data.phase && !["done", "na"].includes(t.status)) || [];
  const nextTasks = currentTasks.slice(0, 3);
  const visibleProjects = projects.filter(p => showArchived ? p.archived : !p.archived);
  const title = tab === "guide" ? "의뢰자를 위한 쉬운 안내" : tab === "settings" ? "프로젝트 설정" : NAV.find(n => n.id === tab)?.label || "한눈에 보기";

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    {mobileMenu ? <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} /> : null}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`} aria-label="주 메뉴">
      <a href="/" className="brand"><span className="brand-mark"><House size={25} strokeWidth={1.7} /></span><span>설계해요<small>seolgyehaeyo</small></span></a>
      <div className="workspace-label"><span>나의 설계 작업실</span><LockKeyhole size={13} /><span className="sr-only">개인 전용</span></div>
      {user ? <button className="new-project-button" onClick={newProject}><Plus size={17} />새 프로젝트</button> : <a className="new-project-button" href={signIn} target="_top"><Plus size={17} />새 프로젝트</a>}
      {demo ? <div className="sidebar-demo"><Sprout size={15} />가상 예시 둘러보는 중</div> : null}
      {visibleProjects.length ? <div className="project-list">{visibleProjects.map(project => <div key={project.id} className="project-list-entry"><button className={active?.id === project.id ? "selected" : ""} onClick={() => void openProject(project.id)} disabled={busy}><span className="project-dot" />{project.name}{project.deletionPending ? <small>삭제 재시도 필요</small> : null}</button>{project.deletionPending ? <button className="text-button" onClick={() => deleteProject(project)}>삭제 재시도</button> : null}</div>)}</div> : <p className="sidebar-hint">{user ? "첫 프로젝트를 만들고\n필요한 일을 차근차근 기록해요." : "로그인하면 내 프로젝트와\n자료를 이어서 볼 수 있어요."}</p>}
      <div className="sidebar-divider" />
      <nav>{NAV.map(item => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => changeTab(item.id)}><item.icon size={18} strokeWidth={1.7} /><span>{item.label}</span>{item.id === "files" && detail?.files.length ? <small>{detail.files.length}</small> : null}{item.id === "progress" && data && questionCount(data) ? <span className="nav-dot" /> : null}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`nav-item ${tab === "guide" ? "active" : ""}`} onClick={() => changeTab("guide")}><BookOpen size={18} />처음이라면 읽어보세요<ArrowUpRight size={13} /></button>{user && !demo ? <button className="nav-item muted" onClick={() => setShowArchived(v => !v)}><FolderOpen size={17} />{showArchived ? "진행 중 프로젝트" : "보관한 프로젝트"}</button> : null}<div className="profile"><div className="avatar">{user?.displayName?.slice(0, 1) || "해"}</div><div><strong>{user?.displayName || "처음 오셨나요?"}</strong>{user ? <a href="/signout-with-chatgpt?returnTo=/" target="_top">로그아웃</a> : <a href={signIn} target="_top">ChatGPT로 로그인</a>}</div><LockKeyhole size={14} /></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Menu size={21} /></button><span>나의 작업실</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-right"><span data-suite-vault-anchor="" aria-label="공통 회원가입·로그인" /><span className="privacy-label"><LockKeyhole size={13} />내 기록은 개인 전용</span><button className="icon-button" aria-label="이용 안내" onClick={() => changeTab("guide")}><CircleHelp size={20} /></button></div></header>
      {demo ? <div className="demo-banner"><span><Sprout size={17} /><strong>가상 예시 · 읽기 전용</strong><span className="demo-long">업체·금액은 화면 설명을 위한 예시입니다.</span></span>{user ? <button onClick={newProject}>내 프로젝트 시작<ArrowRight size={15} /></button> : <a href={signIn} target="_top">내 프로젝트 시작<ArrowRight size={15} /></a>}</div> : null}
      <main id="main-content" className="main-content">
        {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" size={27} /><p>내 기록을 불러오고 있어요.</p></div> : loadError && tab !== "guide" ? <div className="error-panel" role="alert"><CircleHelp size={25} /><h1>기록을 불러오지 못했어요</h1><p>{loadError}</p><button className="button button-primary" onClick={() => void loadProjects()}>다시 불러오기</button><button className="button button-quiet" onClick={() => changeTab("guide")}>안내 먼저 보기</button></div> : tab === "guide" ? <GuideView /> : !data || !active || !detail ? <Welcome onNew={newProject} signedIn={!!user} onGuide={() => changeTab("guide")} /> : <>
          <div className="project-heading"><div><div className="heading-kicker"><span>{kindLabel(data.kind)}</span><span>·</span><span>{data.location || "위치는 나중에 정해도 괜찮아요"}</span></div><h1>{data.name}<span className="heading-period">.</span></h1><p>{tab === "overview" ? "어디서부터 시작할지 막막할 때, 오늘 할 일부터 함께해요." : tab === "offices" ? "같은 질문, 같은 범위로 비교하면 선택이 한결 쉬워져요." : tab === "contract" ? "서로 약속한 일과 실제 지급한 내용을 나란히 남겨요." : tab === "progress" ? "기다리는 답변과 바뀐 내용을 놓치지 않게 기록해요." : tab === "files" ? "계약서부터 최종 도면까지, 받은 원본을 한곳에 모아요." : tab === "completion" ? "행정 결과, 자료 인수, 남은 보수를 각각 확인해요." : "상황이 바뀌면 프로젝트 정보도 함께 바꿔 주세요."}</p></div><button className="button button-quiet settings-button" onClick={() => changeTab("settings")}><Settings2 size={17} />설정</button></div>
          {data.archived ? <div className="notice"><FolderOpen size={18} />보관한 프로젝트예요. 설정에서 다시 진행 중으로 옮길 수 있어요.</div> : null}
          <div className="save-line"><span><span className={`status-dot ${busy ? "pending" : ""}`} />{demo ? "예시 데이터 · 실제 기록 아님" : busy ? "서버에 저장 중…" : `최근 저장 ${dateText(active.updatedAt)} · 기록 ${active.version}번째`}</span>{!demo ? <button onClick={() => void openProject(active.id)} disabled={busy} className="text-button">새로 불러오기</button> : null}</div>
          {tab === "overview" ? <>
            <section className="journey-panel" aria-label="프로젝트 단계"><div className="panel-eyebrow"><span>함께 가는 과정</span><button className="text-button" onClick={() => edit(settingsForm(data, save))}>현재 단계 바꾸기<ChevronRight size={13} /></button></div><ol className="journey">{PHASES.map((phase, index) => { const current = phase.id === data.phase; return <li key={phase.id} className={current ? "current" : ""}><span className="journey-number">{String(index + 1).padStart(2, "0")}</span><strong>{phase.label}</strong>{current ? <span className="journey-current">지금 여기</span> : <span className="journey-caption">{phase.hint}</span>}</li>; })}</ol><p className="journey-footnote">현재 단계는 내가 선택한 진행 위치예요. 관청의 승인·처리 결과는 별도로 기록해요.</p></section>
            <div className="overview-grid"><div className="main-column"><section className="panel next-panel"><SectionTitle icon={<Sprout size={21} />} title="지금, 이것부터 해요" sub={`${phaseLabel(data.phase)} 단계에서 확인할 일`} aside={<Badge tone="green">{currentTasks.length}개 남음</Badge>} />{nextTasks.length ? <div className="task-list">{nextTasks.map((task, index) => <button className="next-task" key={task.id} onClick={() => edit(taskForm(data, save, task))}><span className="task-count">0{index + 1}</span><span className="task-main"><strong>{task.title}</strong><span>{task.assignee ? `${task.assignee} · ` : ""}{TASK_LABELS[task.status]}{task.dueDate ? ` · ${dateText(task.dueDate)}` : ""}</span></span><ChevronRight size={17} /></button>)}</div> : <div className="small-empty"><CheckCircle2 size={25} /><strong>이 단계에 남은 확인 항목이 없어요.</strong><p>다음 단계로 옮길지는 실제 상황을 보고 직접 선택해 주세요.</p></div>}<button className="panel-footer-link" onClick={() => changeTab("progress")}>전체 할 일과 진행 기록<ArrowRight size={16} /></button></section>
            <section className="panel"><SectionTitle title="같은 기준으로 사무소를 살펴봐요" sub="가격과 함께, 책임자·경험·포함 범위를 확인해요." aside={<button className="text-button" onClick={() => changeTab("offices")}>비교하기<ArrowRight size={14} /></button>} />{data.offices.length ? <div className="office-preview-list">{data.offices.slice(0, 3).map(office => <button key={office.id} className="office-preview" onClick={() => changeTab("offices")}><span className="office-avatar"><Building2 size={21} /></span><span><strong>{office.name}</strong><small>{office.lead || "책임 담당자 확인 전"}</small></span><Badge tone={office.verification === "recorded" ? "green" : "amber"}>{office.verification === "recorded" ? "내 확인 기록 있음" : "자료 확인 남음"}</Badge></button>)}</div> : <Empty icon={<Building2 size={26} />} title="마음에 둔 사무소가 있나요?" action={<button className="button button-quiet" onClick={() => edit(officeForm(data, save))}><Plus size={15} />첫 사무소 추가</button>}>이름만 먼저 적고, 상담하면서 비교 항목을 채워도 좋아요.</Empty>}</section>
            <section className="question-feature"><span className="question-icon"><MessageCircle size={25} /></span><div><span className="eyebrow">이렇게 물어보세요</span><h3>{(QUESTIONS.find(q => q.phase === data.phase) || QUESTIONS[0]).text}</h3><div className="inline-actions"><CopyButton text={(QUESTIONS.find(q => q.phase === data.phase) || QUESTIONS[0]).text} /><button className="text-button" onClick={() => edit(noteForm(data, save, undefined, (QUESTIONS.find(q => q.phase === data.phase) || QUESTIONS[0]).text))}>질문·답변 남기기<ArrowRight size={14} /></button></div></div></section>
            </div><aside className="context-column"><section className="panel summary-panel"><span className="eyebrow">나의 프로젝트 메모</span><p className="project-goal">{data.goal || "원하는 공간과 꼭 지키고 싶은 조건을 한 문장으로 남겨보세요."}</p><dl className="summary-list"><div><dt>전체 예산</dt><dd>{compactMoney(data.budget)}</dd></div><div><dt>희망 마무리</dt><dd>{dateText(data.desiredDate)}</dd></div><div><dt>기다리는 질문</dt><dd>{questionCount(data)}개</dd></div><div><dt>보관한 자료</dt><dd>{detail.files.length}개</dd></div></dl><button className="button button-outline full-width" onClick={() => edit(settingsForm(data, save))}>내 상황 정리하기</button></section><section className="tip-card"><span className="tip-label"><ShieldCheck size={17} />선택 전에 한 번 더</span><h3>등록자료는<br />이름과 날짜까지 맞춰요.</h3><p>책임 담당자의 등록자료와 실제 계약 상대를 확인해 보세요.</p><ExternalLink href="https://www.kira.or.kr/index.do">건축사·사무소 찾아보기</ExternalLink><small>검색·업로드만으로 자격 확인이 완료되지는 않아요.</small></section><section className="activity-panel"><h3><Clock3 size={16} />최근 기록</h3>{detail.activity.length ? <ol>{detail.activity.slice(0, 5).map(item => <li key={item.id}><span /><div><strong>{item.summary}</strong><small>{dateText(item.createdAt)} · {item.version}번째 기록</small></div></li>)}</ol> : <p>앞으로 남기는 기록이 여기에 쌓여요.</p>}</section></aside></div>
          </> : null}
          {tab === "offices" ? <><div className="section-actions"><div><h2>사무소 비교 <span>{data.offices.length}</span></h2><p>확인이 남은 자료는 업체 평가와 구분해서 살펴보세요.</p></div><button className="button button-primary" onClick={() => edit(officeForm(data, save))}><Plus size={17} />사무소 추가</button></div><div className="notice"><ShieldCheck size={19} /><span>업체를 확인할 때는 <strong>책임 담당자 → 등록자료 → 비슷한 업무 경험 → 포함 범위</strong> 순서로 질문해 보세요.</span></div>{data.offices.length ? <div className="office-grid">{data.offices.map(office => <article className={`panel office-card ${office.selected ? "office-selected" : ""}`} key={office.id}><div className="office-card-top"><span className="office-avatar"><Building2 size={25} /></span>{office.selected ? <Badge tone="green"><Check size={12} />내가 선택한 후보</Badge> : <Badge>검토하는 후보</Badge>}</div><h3>{office.name}</h3><p className="office-lead">{office.lead || "책임 담당자 확인 전"}</p><dl className="office-facts"><div><dt>비슷한 경험</dt><dd>{office.experience || "아직 물어보기 전"}</dd></div><div><dt>맡는 범위</dt><dd>{office.scope || "아직 정하지 않음"}</dd></div><div><dt>연락 방식</dt><dd>{office.contact || "아직 정하지 않음"}</dd></div></dl><div className="verification-box"><Badge tone={office.verification === "recorded" ? "green" : "amber"}>{office.verification === "recorded" ? "내 확인 기록 있음" : office.verification === "requested" ? "자료 요청한 상태" : "자료 확인 전"}</Badge><p>{office.verificationNote || "등록자료·담당자 확인 기록을 남겨 주세요."}</p>{office.checkedAt ? <small>사용자가 기록한 확인일 {dateText(office.checkedAt)}</small> : null}{office.sourceUrl && /^https?:\/\//.test(office.sourceUrl) ? <ExternalLink href={office.sourceUrl}>기록한 확인 경로</ExternalLink> : null}</div>{office.memo ? <p className="office-memo">{office.memo}</p> : null}<div className="card-actions"><button className="button button-quiet" onClick={() => edit(officeForm(data, save, office))}>비교 내용 수정</button><button className="text-button" disabled={busy} onClick={() => void action(() => save({ ...data, offices: data.offices.map(o => ({ ...o, selected: o.id === office.id ? !o.selected : false })) }, office.selected ? "선택한 후보 표시 해제" : "검토 후보 선택 기록"))}>{office.selected ? "선택 해제" : "이 후보 선택"}</button></div></article>)}</div> : <section className="panel"><Empty icon={<Building2 size={30} />} title="이름만 알아도 비교를 시작할 수 있어요" action={<button className="button button-primary" onClick={() => edit(officeForm(data, save))}>첫 후보 추가</button>}>담당자, 경험, 연락 방식은 상담한 뒤 채워 주세요.</Empty></section>}
            <div className="section-actions section-space"><div><h2>견적, 같은 범위로 비교해요</h2><p>별도 비용과 부가세가 미정이면 제시 금액만으로 총비용을 비교하기 어려워요.</p></div><button className="button button-outline" onClick={() => edit(quoteForm(data, save))}><Plus size={16} />견적 추가</button></div>{data.quotes.length ? <div className="quote-grid">{data.quotes.map(quote => <article className="panel quote-card" key={quote.id}><p className="eyebrow">{data.offices.find(o => o.id === quote.officeId)?.name || "사무소 미연결"}</p><h3>{quote.label}</h3><div className="quote-amount">{money(quote.amount)}</div><Badge tone={quote.vat === "unknown" ? "amber" : "neutral"}>부가세 {quote.vat === "included" ? "포함" : quote.vat === "excluded" ? "별도" : "미정"}</Badge><ul className="quote-lines">{quote.lines.map(line => <li key={line.id}><span>{line.name}</span><span className={line.status === "unknown" ? "amber-text" : ""}>{({ included: "포함", separate: "별도", unknown: "아직 미정", excluded: "제외" })[line.status]}{line.status === "separate" ? ` · ${money(line.amount)}` : ""}</span></li>)}</ul>{quote.memo ? <p className="muted-copy">{quote.memo}</p> : null}<button className="button button-quiet full-width" onClick={() => edit(quoteForm(data, save, quote))}>견적 내용 수정</button></article>)}</div> : <section className="panel"><Empty icon={<FileText size={25} />} title="받은 견적을 항목별로 남겨요">금액을 몰라도 ‘아직 미정’으로 저장할 수 있어요.</Empty></section>}
            <div className="official-strip"><strong>공식 확인 경로</strong><ExternalLink href="https://www.kira.or.kr/index.do">건축사·사무소 검색</ExternalLink><ExternalLink href="https://kirakarb.kira.or.kr/issue/prfIsnCnfm.do">증명서 발급번호 확인</ExternalLink></div></> : null}
          {tab === "contract" ? <><div className="two-columns"><section className="panel contract-card"><SectionTitle title="계약에서 약속한 일" aside={<button className="text-button" onClick={() => edit(contractForm(data, save))}>내용 정리<ArrowRight size={14} /></button>} /><div className="contract-summary"><Badge tone={data.contract.status === "signed" ? "green" : "amber"}>{({ draft: "초안·미정", received: "계약서 받음", signed: "서명본 받은 기록", amended: "변경계약 기록" })[data.contract.status]}</Badge><h3>{data.contract.party || "계약 상대를 확인해 주세요"}</h3><strong className="contract-amount">{money(data.contract.amount)}</strong></div><dl className="definition-list">{[["맡긴 일", data.contract.scope], ["받을 결과물", data.contract.deliverables], ["지급 조건", data.contract.paymentTerms], ["변경·추가비", data.contract.changeTerms], ["중단·자료 인계", data.contract.handoverTerms]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="unfilled">아직 정리하지 않았어요</span>}</dd></div>)}</dl><button className="panel-footer-link" onClick={() => changeTab("files")}><FolderOpen size={16} />계약서 원본 보관하기<ArrowRight size={16} /></button></section><section className="contract-help"><span className="eyebrow">계약 전에 꼭 물어봐요</span><h2>“준공까지”에<br />어떤 일이 포함되나요?</h2><p>설계, 측량, 감리, 시공, 사용승인 지원은 담당과 계약이 다를 수 있어요. 누가 어떤 결과물까지 맡는지 구체적으로 적어 주세요.</p><CopyButton text="설계·측량·감리·시공·사용승인 지원 중 이번 계약에 포함되는 업무와 제가 별도로 맡겨야 할 일을 구분해 주실 수 있나요?" /><div className="fine-rule" /><p>설계·감리·공사비의 약정 지급 조건은 각각 확인해요. 감리비는 사용승인 신청 시 계약에 따른 지급 확인 절차가 있어요.</p><ExternalLink href="https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000185000">국토교통부 설계표준계약서</ExternalLink><ExternalLink href="https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032200459">건축법 제25조 감리비 확인</ExternalLink></section></div>
            <div className="section-actions section-space"><div><h2>대금과 지급 기록</h2><p>지급 예정과 실제 지급을 구분해요. 여기서 송금되지는 않아요.</p></div><button className="button button-primary" onClick={() => edit(paymentForm(data, save))}><Plus size={16} />지급 기록 추가</button></div><div className="budget-strip"><div><span>전체 예산</span><strong>{money(data.budget)}</strong></div><div><span>금액을 적은 지급 합계</span><strong>{data.payments.some(p => p.status === "paid" && p.amount !== null) ? money(data.payments.filter(p => p.status === "paid" && p.amount !== null).reduce((sum, p) => sum + (p.amount || 0), 0)) : "확인한 금액 없음"}</strong></div><div><span>금액 미정 지급 기록</span><strong>{data.payments.filter(p => p.status === "paid" && p.amount === null).length}개</strong></div></div><section className="panel">{data.payments.length ? <div className="record-list">{data.payments.map(payment => <button className="record-row" key={payment.id} onClick={() => edit(paymentForm(data, save, payment))}><span className="row-icon"><Wallet size={19} /></span><span className="record-main"><strong>{payment.label}</strong><small>{payment.status === "paid" ? `지급일 ${dateText(payment.paidDate)}` : `약정일 ${dateText(payment.dueDate)}`}</small></span><span className="record-right"><strong>{money(payment.amount)}</strong><Badge tone={payment.status === "paid" ? "green" : "amber"}>{({ planned: "예정", claimed: "청구 받음", reviewing: "자료 확인 중", paid: "지급 사실 기록", disputed: "이견 있음" })[payment.status]}</Badge></span><ChevronRight size={15} /></button>)}</div> : <Empty icon={<Wallet size={25} />} title="계약금부터 정산까지 남겨요">지급 조건과 이체 내역을 함께 적어 두면 대조하기 쉬워요.</Empty>}</section></> : null}
          {tab === "progress" ? <><div className="section-actions"><div><h2>단계별로 확인해요</h2><p>해당하지 않는 항목은 이유를 남기고 넘어갈 수 있어요.</p></div><button className="button button-primary" onClick={() => edit(taskForm(data, save))}><Plus size={16} />할 일 추가</button></div><div className="filter-chips" aria-label="단계 필터"><button className={taskFilter === "current" ? "active" : ""} onClick={() => setTaskFilter("current")}>현재 단계</button><button className={taskFilter === "all" ? "active" : ""} onClick={() => setTaskFilter("all")}>전체</button>{PHASES.map(phase => <button key={phase.id} className={taskFilter === phase.id ? "active" : ""} onClick={() => setTaskFilter(phase.id)}>{phase.label}</button>)}</div><section className="panel"><div className="record-list">{data.tasks.filter(task => taskFilter === "all" || task.phase === (taskFilter === "current" ? data.phase : taskFilter)).map(task => <TaskRow key={task.id} task={task} onClick={() => edit(taskForm(data, save, task))} />)}</div></section>
            <div className="section-actions section-space"><div><h2>질문과 답변 <span>{questionCount(data)}개 기다리는 중</span></h2><p>복사한 질문은 직접 전달한 뒤 질문 상태를 남겨 주세요.</p></div><button className="button button-outline" onClick={() => edit(noteForm(data, save))}><Plus size={16} />기록 추가</button></div>{data.notes.length ? <div className="notes-grid">{data.notes.map(note => <article className="panel note-card" key={note.id}><div className="card-topline"><Badge tone={note.status === "closed" ? "green" : "amber"}>{note.status === "closed" ? "내 확인 기록" : note.type === "question" ? "답변 확인 전" : "남긴 메모"}</Badge><button className="icon-button" onClick={() => edit(noteForm(data, save, note))} aria-label="질문과 메모 수정"><MoreHorizontal size={19} /></button></div><h3>{note.text}</h3>{note.answer ? <p className="answer-text">{note.answer}</p> : <p className="muted-copy">답변을 받으면 여기에 남겨 주세요.</p>}<div className="note-foot"><span>{note.contact || "담당자 미정"}{note.nextDate ? ` · 다음 확인 ${dateText(note.nextDate)}` : ""}</span><CopyButton text={note.text} label="복사" /></div></article>)}</div> : <section className="panel"><Empty icon={<MessageCircle size={25} />} title="물어볼 일을 모아두세요">통화할 때마다 빠뜨리지 않고 하나씩 확인할 수 있어요.</Empty></section>}
            <div className="section-actions section-space"><div><h2>바뀐 내용과 합의 자료</h2><p>비용·일정이 미정이면 그대로 미정으로 남겨요.</p></div><button className="button button-outline" onClick={() => edit(changeForm(data, save))}><Plus size={16} />변경 기록</button></div><section className="panel">{data.changes.length ? <div className="record-list">{data.changes.map(change => <button className="record-row" key={change.id} onClick={() => edit(changeForm(data, save, change))}><span className="row-icon"><FileText size={19} /></span><span className="record-main"><strong>{change.title}</strong><small>{change.reason || "변경 이유 확인 전"}</small></span><span className="record-right"><strong>{change.costDelta === null ? "비용 영향 미정" : `${change.costDelta > 0 ? "+" : ""}${money(change.costDelta)}`}</strong><Badge tone={change.status === "agreed" ? "green" : "amber"}>{({ proposal: "제안·검토", requested: "답변 요청", agreed: "합의 자료 기록", disputed: "이견 있음", cancelled: "철회 기록" })[change.status]}</Badge></span><ChevronRight size={15} /></button>)}</div> : <Empty icon={<FileText size={25} />} title="변경 전후와 근거를 함께 남겨요">내 확인과 상대방의 합의 자료는 구분해서 기록해요.</Empty>}</section></> : null}
          {tab === "files" ? <FilesView key={active.id} projectId={active.id} files={detail.files} demo={demo} onFile={file => setDetail(current => current?.project.id === file.projectId ? { ...current, files: [file, ...current.files] } : current)} onToast={setToast} /> : null}
          {tab === "completion" ? <><div className="notice"><ClipboardCheck size={20} /><span><strong>마무리는 세 가지로 나눠 살펴봐요.</strong> 승인서를 받은 것과 자료 인수, 남은 보수를 확인한 것은 각각 다른 기록이에요.</span></div><div className="completion-grid">{([{ id: "administrative", title: "행정 결과", label: "승인·처리 결과를 받았나요?", icon: Building2 }, { id: "handover", title: "자료 인수·정산", label: "약속한 자료를 모두 받았나요?", icon: FolderOpen }, { id: "repair", title: "남은 작업·보수", label: "남은 일의 담당과 기한이 있나요?", icon: ClipboardCheck }] as const).map((group, index) => { const items = data.tasks.filter(t => t.phase === "completion" && t.category === group.id); return <section className="panel completion-card" key={group.id}><div className="completion-number">0{index + 1}<group.icon size={23} /></div><h2>{group.title}</h2><p>{group.label}</p><Badge tone="green">{items.filter(t => ["done", "na"].includes(t.status)).length} / {items.length}개 내 확인</Badge><div className="completion-tasks">{items.map(task => <button key={task.id} onClick={() => edit(taskForm(data, save, task))}><span className={task.status === "done" || task.status === "na" ? "check-circle complete" : "check-circle"}>{["done", "na"].includes(task.status) ? <Check size={13} /> : null}</span><span><strong>{task.title}</strong><small>{TASK_LABELS[task.status]}</small></span></button>)}</div></section>; })}</div>{data.tasks.some(t => t.phase === "completion" && t.category === "work") ? <section className="panel section-space"><SectionTitle title="추가로 남긴 마무리 확인" /><div className="record-list">{data.tasks.filter(t => t.phase === "completion" && t.category === "work").map(task => <TaskRow key={task.id} task={task} onClick={() => edit(taskForm(data, save, task))} />)}</div></section> : null}<div className="completion-bottom"><div><h3>남은 인수·보수 항목도 추가할 수 있어요</h3><p>위치, 내용, 담당자와 다음 확인일을 적어 주세요.</p></div><button className="button button-primary" onClick={() => edit(taskForm(data, save, { id: newId(), title: "", phase: "completion", category: "repair", status: "todo", assignee: "", dueDate: "", evidence: "", note: "" }))}>항목 추가<Plus size={15} /></button></div><button className="button button-quiet" onClick={() => changeTab("files")}><FolderOpen size={16} />최종 자료 열어보기</button></> : null}
          {tab === "settings" ? <section className="panel settings-panel"><SectionTitle title="내 상황에 맞게 바꿔요" sub="현재 단계 변경은 행정절차의 완료를 뜻하지 않아요." /><dl className="definition-list"><div><dt>프로젝트</dt><dd>{data.name}</dd></div><div><dt>현재 단계</dt><dd>{phaseLabel(data.phase)}</dd></div><div><dt>원하는 일</dt><dd>{data.goal || "아직 정하지 않음"}</dd></div><div><dt>예산</dt><dd>{money(data.budget)}</dd></div></dl><button className="button button-primary" onClick={() => edit(settingsForm(data, save))}>프로젝트 정보 수정</button><div className="settings-group"><h3>기록을 가져가고 보관해요</h3><p>JSON에는 입력 기록과 변경 이력, 파일 목록이 들어가요. 원본 파일은 자료함에서 각각 내려받아 주세요.</p>{demo ? <button className="button button-outline" onClick={newProject}>내 프로젝트 시작</button> : <a className="button button-outline" href={`/api/projects/${active.id}/export`}><ArrowDownToLine size={16} />입력 기록 JSON 내려받기</a>}<button className="button button-quiet" disabled={busy || demo} onClick={() => void action(() => save({ ...data, archived: !data.archived }, data.archived ? "프로젝트 보관 해제" : "프로젝트 보관"))}><FolderOpen size={16} />{data.archived ? "다시 진행 중으로" : "프로젝트 보관"}</button></div><div className="settings-group"><h3>내 자료 보관과 삭제</h3><p>이 프로젝트는 내 계정으로만 열 수 있어요. 입력 기록과 업로드 원본은 서버에 저장되며, 파일을 외부 AI 분석 서비스로 보내는 기능은 없어요. 보관은 삭제가 아닙니다.</p><p>프로젝트 삭제 시 입력 기록·이력·업로드 원본을 함께 삭제합니다. 서비스 운영 로그 등 플랫폼에서 관리하는 정보는 플랫폼 정책을 따릅니다.</p><button className="button button-danger-outline" disabled={demo} onClick={() => deleteProject(toSummary(active))}>프로젝트 영구 삭제</button></div></section> : null}
        </>}
        <footer className="app-footer"><span>설계해요 <span className="footer-dot">·</span> 좋은 선택부터, 마지막 확인까지.</span><span>내 기록을 돕는 서비스 <span className="footer-dot">·</span> 공식 확인은 해당 기관에서</span></footer>
      </main>
    </div>
    <nav className="mobile-bottom" aria-label="빠른 메뉴">{NAV.filter(n => ["overview", "offices", "progress", "files"].includes(n.id)).map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => changeTab(item.id)}><item.icon size={19} /><span>{({ overview: "홈", offices: "사무소", progress: "진행", files: "자료" } as Record<string, string>)[item.id]}</span></button>)}</nav>
    {form ? <FormDialog key={form.title} spec={form} onClose={() => setForm(null)} /> : null}
    {toast ? <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => setToast("")}><X size={16} /></button></div> : null}
  </div>;
}

function SectionTitle({ title, sub, aside, icon }: { title: string; sub?: string; aside?: ReactNode; icon?: ReactNode }) {
  return <div className="section-title"><div><h2>{icon}{title}</h2>{sub ? <p>{sub}</p> : null}</div>{aside}</div>;
}
function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  return <button className="record-row task-record" onClick={onClick}><span className={`check-circle ${task.status === "done" || task.status === "na" ? "complete" : ""}`}>{["done", "na"].includes(task.status) ? <Check size={14} /> : null}</span><span className="record-main"><strong>{task.title}</strong><small>{phaseLabel(task.phase)}{task.assignee ? ` · ${task.assignee}` : ""}{task.dueDate ? ` · ${dateText(task.dueDate)}` : ""}</small></span><Badge tone={task.status === "done" || task.status === "na" ? "green" : task.status === "todo" ? "neutral" : "amber"}>{TASK_LABELS[task.status]}</Badge><ChevronRight size={15} /></button>;
}
function Welcome({ onNew, signedIn, onGuide }: { onNew: () => void; signedIn: boolean; onGuide: () => void }) {
  return <div className="welcome"><div className="welcome-hero"><div className="welcome-copy"><Badge tone="green"><Sprout size={14} />처음 맡기는 설계도, 차근차근</Badge><h1>좋은 사무소를 고르고,<br />끝까지 함께 <span>설계해요.</span></h1><p>비교할 때의 질문부터 계약의 약속, 마지막에 받을 자료까지.<br className="desktop-only" />의뢰자의 입장에서 다음 할 일을 알려드려요.</p><div className="welcome-actions">{signedIn ? <button className="button button-primary button-large" onClick={onNew}>내 프로젝트 시작<ArrowRight size={18} /></button> : <a className="button button-primary button-large" href="/signin-with-chatgpt?returnTo=%2F" target="_top">로그인하고 시작<ArrowRight size={18} /></a>}<a className="button button-outline button-large" href="/demo">예시 둘러보기</a></div><small><LockKeyhole size={13} />내 프로젝트와 자료는 개인 전용으로 보관돼요.</small></div><div className="welcome-illustration" aria-hidden="true"><div className="paper-sheet paper-back" /><div className="paper-sheet"><span className="plan-caption">MY FIRST PROJECT</span><svg viewBox="0 0 260 215" fill="none"><path d="M35 35H225V180H35V35Z M35 110H145 M145 35V180 M145 100H225 M80 110V180" stroke="#335c48" strokeWidth="3" /><path d="M35 72V92 M35 135V157 M184 35H208 M178 180H207 M75 35H103" stroke="#d3e6bd" strokeWidth="6" /><path d="M80 150A30 30 0 0 1 110 180 M145 70A30 30 0 0 0 175 100" stroke="#8aa486" strokeWidth="1" strokeDasharray="3 3" /><rect x="54" y="48" width="64" height="38" rx="3" fill="#e6eddc" /><rect x="167" y="119" width="37" height="43" rx="3" fill="#e6eddc" /><path d="M17 35V180M11 35H23M11 180H23M35 198H225M35 192V204M225 192V204" stroke="#b5c6b1" /><circle cx="112" cy="145" r="16" fill="#d4e1c6" /><path d="M105 145l5 5 9-10" stroke="#335c48" strokeWidth="2" /></svg><span className="plan-foot">원하는 공간, 하나씩 그려가요.</span></div><div className="floating-note"><CheckCircle2 size={21} /><div><strong>다음 할 일이 보여요</strong><span>막막함을 작은 질문으로</span></div></div></div></div>
    <div className="welcome-steps">{[{ n: "01", title: "내 상황부터", text: "주소와 예산을 아직 몰라도 괜찮아요.", icon: House }, { n: "02", title: "같은 기준으로", text: "책임자, 경험, 포함 범위를 비교해요.", icon: Building2 }, { n: "03", title: "약속과 자료를", text: "변경된 내용과 받은 원본을 기록해요.", icon: FolderOpen }, { n: "04", title: "마지막 확인까지", text: "승인, 자료 인수, 남은 보수를 살펴요.", icon: CheckCircle2 }].map(step => <article key={step.n}><span>{step.n}<step.icon size={23} strokeWidth={1.6} /></span><h2>{step.title}</h2><p>{step.text}</p></article>)}</div><div className="welcome-guide"><BookOpen size={23} /><div><h3>설계사무소에 무엇부터 물어봐야 할까요?</h3><p>누구나 확인할 수 있는 공식 경로와 질문을 모았어요.</p></div><button className="button button-quiet" onClick={onGuide}>쉬운 안내 읽기<ArrowRight size={15} /></button></div></div>;
}
function GuideView() {
  const [search, setSearch] = useState("");
  const filtered = GUIDE_CARDS.filter(card => `${card.title} ${card.summary} ${card.steps.join(" ")}`.includes(search.trim()));
  return <div className="guide-view"><div className="guide-heading"><span className="eyebrow">의뢰자를 위한 작은 안내서</span><h1>처음이라도,<br />물어볼 수 있어요<span className="heading-period">.</span></h1><p>전문용어를 외우는 대신, 지금 필요한 질문부터 확인해 보세요.</p></div><label className="search-field"><Search size={18} /><span className="sr-only">안내 검색</span><input type="search" placeholder="계약, 등록, 측량, 준공… 궁금한 내용 찾기" value={search} onChange={event => setSearch(event.target.value)} /></label><div className="guide-grid">{filtered.map((card, index) => <article className="panel guide-card" key={card.id}><span className="guide-index">GUIDE {String(index + 1).padStart(2, "0")}</span><h2>{card.title}</h2><p>{card.summary}</p><details><summary>무엇을 하면 되나요?<ChevronRight size={16} /></summary><ol>{card.steps.map(step => <li key={step}>{step}</li>)}</ol><div className="guide-question"><MessageCircle size={17} /><p>{card.question}</p><CopyButton text={card.question} /></div><div className="guide-sources">{card.sources.map(source => <ExternalLink key={source.url} href={source.url}>{source.label}</ExternalLink>)}</div></details></article>)}</div>{!filtered.length ? <Empty icon={<Search size={25} />} title="찾은 안내가 없어요">다른 단어나 더 짧은 단어로 찾아보세요.</Empty> : null}<section className="official-links"><SectionTitle title="직접 확인할 수 있는 공식 창구" sub={`안내 검토일 ${dateText(REVIEWED_AT)} · 개별 사업에 필요한 절차는 관할기관과 확인해 주세요.`} /><div>{OFFICIAL_LINKS.map(link => <a href={link.url} key={link.url} target="_blank" rel="noopener noreferrer"><span><strong>{link.label}</strong><small>{link.description}</small></span><ArrowUpRight size={19} /></a>)}</div></section><p className="guide-disclosure">안내는 공식 자료를 바탕으로 작성한 일반 정보입니다. 기획·UX·디자인·설계·법률·지적행정·의뢰자 관점의 AI 검토를 반영했으며, 실제 전문가의 개별 자문이나 업체 인증을 뜻하지 않습니다.</p></div>;
}
function FilesView({ projectId, files, demo, onFile, onToast }: { projectId: string; files: ProjectFile[]; demo: boolean; onFile: (file: ProjectFile) => void; onToast: (text: string) => void }) {
  const [category, setCategory] = useState("all"); const [search, setSearch] = useState(""); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  const uploadRef = useRef<HTMLFormElement>(null); const uploadLock = useRef(false);
  const filtered = files.filter(file => (category === "all" || file.category === category) && file.originalName.toLowerCase().includes(search.toLowerCase()));
  return <><form ref={uploadRef} className="upload-panel" onSubmit={async event => {
    event.preventDefault(); if (demo) { onToast("예시에는 파일을 올릴 수 없어요. 내 프로젝트에서 원본을 보관해 주세요."); return; } if (uploadLock.current) return;
    const body = new FormData(event.currentTarget); const file = body.get("file");
    if (!(file instanceof File) || !file.size) { setError("보관할 파일을 먼저 선택해 주세요."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("파일은 하나당 20MB까지 올릴 수 있어요."); return; }
    uploadLock.current = true; setUploading(true); setError("");
    try { const result = await api<{ file: ProjectFile }>(`/api/projects/${projectId}/files`, { method: "POST", body }); onFile(result.file); uploadRef.current?.reset(); onToast("원본 파일을 서버에 보관했어요."); }
    catch (e) { setError(e instanceof Error ? e.message : "파일을 저장하지 못했어요."); }
    finally { setUploading(false); uploadLock.current = false; }
  }}><div className="upload-intro"><span className="upload-icon"><Upload size={25} /></span><div><h2>받은 자료를 보관해요</h2><p>PDF, 사진, DOCX, XLSX, DWG, DXF, TXT · 파일당 20MB</p><small>새 버전도 별도 파일로 보관돼요. 불필요한 주민등록번호·신분증 정보는 가린 사본을 올려 주세요.</small></div></div><div className="upload-fields"><label><span>원본 또는 가린 사본</span><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.avif,.heic,.heif,.docx,.xlsx,.dwg,.dxf,.txt" disabled={uploading || demo} /></label><label><span>자료 종류</span><select name="category" disabled={uploading || demo}>{FILE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label><span>버전·메모 <small>선택</small></span><input name="versionLabel" maxLength={100} placeholder="예: 2차 수정 · 개인정보 가린 사본" disabled={uploading || demo} /></label><button className="button button-primary" type="submit" disabled={uploading || demo}>{uploading ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{uploading ? "업로드 중…" : "파일 보관"}</button></div>{error ? <p className="form-error" role="alert">{error}</p> : null}</form><div className="section-actions section-space"><h2>보관한 자료 <span>{files.length}</span></h2><label className="search-field compact-search"><Search size={16} /><span className="sr-only">파일 이름 검색</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="파일 이름으로 찾기" /></label></div><div className="filter-chips"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>전체</button>{FILE_CATEGORIES.map(c => <button className={category === c ? "active" : ""} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><section className="panel">{filtered.length ? <div className="file-list">{filtered.map(file => <div className="file-row" key={file.id}><span className="file-icon"><FileText size={24} /></span><div><strong>{file.originalName}</strong><small>{file.category} · {file.versionLabel || "버전 메모 없음"} · {file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.ceil(file.size / 1024))}KB`} · {dateText(file.createdAt)}</small></div><a className="button button-small button-quiet" href={`/api/projects/${projectId}/files/${file.id}`} aria-label={`${file.originalName} 원본 내려받기`}><ArrowDownToLine size={17} /><span>원본 받기</span></a></div>)}</div> : <Empty icon={<FolderOpen size={29} />} title={files.length ? "해당하는 파일이 없어요" : "아직 보관한 자료가 없어요"}>{files.length ? "검색어와 자료 종류를 바꿔서 찾아보세요." : "파일을 보관하면 다시 접속해도 같은 원본을 내려받을 수 있어요."}</Empty>}</section><p className="footnote">자료를 올리는 것은 보관 기록입니다. 파일 내용의 진위나 행정 승인 여부를 자동 확인하지 않아요. 업로드한 자료를 외부 AI 분석 서비스에 보내지 않습니다.</p></>;
}
