import { createProjectData, type ProjectDetail } from "./types";

export function createDemo(): ProjectDetail {
  const data = createProjectData({ name: "우리 가족의 작은 집", kind: "house", phase: "compare", location: "위치는 아직 검토 중", budget: 350000000 });
  data.goal = "채광이 좋은 2층 집. 처음 짓는 집이라 비용과 절차를 차근차근 확인하고 싶어요.";
  data.offices = [
    { id: "sample-a", name: "가온 건축사사무소 · 가상 예시", lead: "책임 담당자 A", contact: "주 1회 진행 내용 공유", scope: "기본·실시설계, 인허가 지원", experience: "비슷한 규모의 단독주택 사례 3건 설명받음", registrationRef: "아직 자료를 받기 전", verification: "requested", verificationNote: "자격등록증과 사무소개설 신고확인증을 요청한 상황", sourceUrl: "", checkedAt: "", selected: false, memo: "변경 설계 비용 기준을 다음 상담에서 물어보기" },
    { id: "sample-b", name: "느린집 건축사사무소 · 가상 예시", lead: "책임 담당자 B", contact: "도면 회의 때 설명", scope: "기본·실시설계, 인허가 지원", experience: "소규모 주택 사례를 확인할 예정", registrationRef: "미확인", verification: "unverified", verificationNote: "", sourceUrl: "", checkedAt: "", selected: false, memo: "공사 중 설계자 방문 범위 확인 필요" },
  ];
  data.quotes = [
    { id: "quote-a", officeId: "sample-a", label: "첫 상담 견적 · 가상 금액", amount: 22000000, vat: "included", lines: [{ id: "q1", name: "설계·인허가 지원", status: "included", amount: null }, { id: "q2", name: "측량", status: "separate", amount: null }, { id: "q3", name: "감리", status: "unknown", amount: null }], memo: "포함 범위를 확인하기 위한 예시입니다. 시장 가격 기준이 아닙니다." },
    { id: "quote-b", officeId: "sample-b", label: "첫 상담 견적 · 가상 금액", amount: 18000000, vat: "unknown", lines: [{ id: "q4", name: "설계·인허가 지원", status: "included", amount: null }, { id: "q5", name: "측량", status: "unknown", amount: null }, { id: "q6", name: "감리", status: "separate", amount: null }], memo: "부가세와 별도 비용이 미정이라 총비용을 직접 비교할 수 없어요." },
  ];
  data.tasks[0].status = "done"; data.tasks[0].evidence = "원하는 공간과 전체 예산을 가족과 정리한 가상 예시";
  data.tasks[1].status = "waiting"; data.tasks[1].assignee = "후보 사무소";
  data.notes = [{ id: "note-a", type: "question", text: "이 금액에 감리와 측량이 포함되나요? 별도라면 누가 맡고 얼마가 더 드나요?", answer: "", contact: "후보 사무소", nextDate: "", status: "open", createdAt: "2026-10-22T00:00:00.000Z" }];
  return { project: { id: "demo", data, version: 1, createdAt: "2026-10-22T00:00:00.000Z", updatedAt: "2026-10-22T00:00:00.000Z" }, files: [], activity: [{ id: "example", version: 1, summary: "화면을 둘러보기 위한 가상 프로젝트예요", createdAt: "2026-10-22T00:00:00.000Z" }] };
}
