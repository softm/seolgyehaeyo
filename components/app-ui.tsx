"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy, LoaderCircle, X } from "lucide-react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="external-link">{children}<ArrowUpRight size={14} aria-hidden="true" /></a>;
}
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function CopyButton({ text, label = "질문 복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <><button className="button button-small button-quiet" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setError(false); }
    catch { setError(true); }
  }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "복사했어요" : label}</button>{error ? <small role="alert">복사 권한이 없어요. 질문을 선택해 직접 복사해 주세요.</small> : null}</>;
}
export interface FieldSpec { name: string; label: string; type?: "text" | "textarea" | "number" | "date" | "url" | "select"; required?: boolean; hint?: string; placeholder?: string; options?: { value: string; label: string }[]; initial?: string | number | null; advanced?: boolean; min?: number; max?: number }
export type FormValues = Record<string, string>;
export interface FormSpec { title: string; description?: string; fields: FieldSpec[]; submitLabel?: string; danger?: boolean; onSubmit: (values: FormValues) => Promise<void> }
export function FormDialog({ spec, onClose }: { spec: FormSpec; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(spec.fields.map(field => [field.name, String(field.initial ?? "")])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftCopied, setDraftCopied] = useState(false);
  const advanced = useRef<HTMLDetailsElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => { opener.current?.focus(); };
  }, []);
  useEffect(() => {
    if (["done", "na", "agreed"].includes(values.status) || values.verification === "recorded") {
      if (advanced.current) advanced.current.open = true;
    }
  }, [values.status, values.verification]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try { await spec.onSubmit(values); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요."); }
    finally { setSaving(false); lock.current = false; }
  }
  function fieldView(field: FieldSpec) {
    const common = { id: `field-${field.name}`, name: field.name, value: values[field.name], required: field.required, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(v => ({ ...v, [field.name]: event.target.value })), "aria-describedby": field.hint ? `hint-${field.name}` : undefined };
    return <div className={`field ${field.type === "textarea" ? "field-wide" : ""}`} key={field.name}>
      <label htmlFor={common.id}>{field.label}{field.required ? <span className="required" aria-label="필수"> *</span> : <span className="optional">선택</span>}</label>
      {field.type === "select" ? <select {...common}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "textarea" ? <textarea {...common} rows={3} maxLength={6000} placeholder={field.placeholder} /> : <input {...common} type={field.type || "text"} min={field.min} max={field.max} step={field.type === "number" ? "1" : undefined} maxLength={field.type === "number" ? undefined : 500} placeholder={field.placeholder} />}
      {field.hint ? <small id={`hint-${field.name}`}>{field.hint}</small> : null}
    </div>;
  }
  return <dialog ref={dialog} className="form-dialog" aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={submit}>
      <div className="dialog-head"><div><span className="eyebrow">차근차근, 설계해요</span><h2 id="dialog-title">{spec.title}</h2>{spec.description ? <p>{spec.description}</p> : null}</div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="닫기"><X size={21} /></button></div>
      <div className="dialog-fields">{spec.fields.filter(f => !f.advanced).map(fieldView)}
        {spec.fields.some(f => f.advanced) ? <details ref={advanced} className="advanced-fields"><summary>추가 정보도 적을게요 <span>나중에 수정할 수 있어요</span></summary><div className="advanced-grid">{spec.fields.filter(f => f.advanced).map(fieldView)}</div></details> : null}
      </div>
      <div className="dialog-foot">{error ? <div className="form-error" role="alert">{error}<button type="button" className="button button-small button-quiet" style={{ marginTop: 9 }} onClick={async () => { try { await navigator.clipboard.writeText(spec.fields.map(field => `${field.label}: ${field.options?.find(o => o.value === values[field.name])?.label || values[field.name] || "미입력"}`).join("\n")); setDraftCopied(true); } catch { setError(`${error} 복사 권한이 없으므로 내용을 선택해 직접 복사해 주세요.`); } }}>{draftCopied ? "입력 내용을 복사했어요" : "입력 내용 복사"}</button></div> : null}<p className="save-note">저장에 실패하면 입력 내용은 이 창에 남아 있어요.</p><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={saving}>취소</button><button className={`button ${spec.danger ? "button-danger" : "button-primary"}`} disabled={saving}>{saving ? <LoaderCircle size={17} className="spin" /> : null}{saving ? "처리 중…" : spec.submitLabel || "기록 저장"}</button></div></div>
    </form>
  </dialog>;
}
