/** Public registry lookup; personal project data is never sent to this page. */
export default function RegistryShortcut() {
  return <a href="/registry.html" target="_blank" rel="noopener noreferrer" aria-label="공식 등록업체 확인, 새 창" style={{ position: "fixed", right: 20, bottom: 86, zIndex: 25, background: "#235c49", color: "#fff", borderRadius: 24, padding: "11px 18px", boxShadow: "0 4px 16px #203e3526", fontSize: 14, fontWeight: 650, textDecoration: "none" }}>등록업체 확인 ↗</a>;
}
