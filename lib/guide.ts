export const REVIEWED_AT = '2026-10-22';

export const GUIDE_CARDS: {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  question: string;
  sources: { label: string; url: string }[];
}[] = [
  {
    id: 'start-with-your-plan',
    title: '하고 싶은 일부터 정리해요',
    summary: '주소나 지역, 하고 싶은 일, 현재 단계만 알아도 시작할 수 있어요.',
    steps: [
      '집을 짓기, 창고 만들기, 땅 정리하기처럼 원하는 일을 한 문장으로 적으세요. 면적이나 예산은 아직 몰라도 괜찮아요.',
      '이미 계약했거나 공사 중이라면 지금 단계부터 정리하세요. 지난 자료는 나중에 보완할 수 있어요.',
      '후보 사무소에는 같은 요구를 전달하고 비슷한 완료 사례에서 실제로 맡았던 일을 물어보세요.',
    ],
    question: '제가 하려는 일에 어떤 검토가 먼저 필요하고, 제가 준비할 자료는 무엇인가요?',
    sources: [
      {
        label: '대한건축사협회 · 건축설계 진행과정',
        url: 'https://www.kira.or.kr/jsp/main/06/new7.jsp',
      },
    ],
  },
  {
    id: 'check-responsible-office',
    title: '책임 담당자와 사무소를 확인해요',
    summary: '누가 최종 검토하고 책임지는지, 받은 자료와 함께 확인해요.',
    steps: [
      '책임 건축사의 이름과 유효한 자격등록증, 사무소개설 신고확인증을 요청하고 계약 상대방과 대조하세요.',
      '협회에서 건축사명·사무소명으로 찾아보세요. 검색되지 않으면 이름·등록번호와 관할기관을 다시 확인하세요. 미검색만으로 무자격을 뜻하지는 않아요.',
      '직원이 상담하거나 도면 작성을 돕는 경우도 있어요. 최종 검토자와 직접 설명을 들을 방법을 확인하세요.',
      '확인 기록에는 내가 본 자료와 날짜를 적으세요. 기록이나 파일 업로드만으로 기관의 진위확인이 끝난 것은 아니에요. 발급기관 확인 결과는 따로 남기세요.',
    ],
    question: '제 일을 최종 검토하고 책임지는 분은 누구이며, 등록자료와 담당 범위를 받을 수 있나요?',
    sources: [
      {
        label: '대한건축사협회 · 건축사·사무소 검색',
        url: 'https://www.kira.or.kr/index.do',
      },
      {
        label: '건축사등록원 · 증명서 발급번호 확인',
        url: 'https://kirakarb.kira.or.kr/issue/prfIsnCnfm.do',
      },
      {
        label: '건축사법 · 자격등록·사무소개설·업무',
        url: 'https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260918&lsiSeq=284461&urlMode=lsInfoP',
      },
    ],
  },
  {
    id: 'compare-total-scope',
    title: '견적은 포함·별도·미정으로 봐요',
    summary: '처음 받은 금액과 함께, 어떤 일을 어디까지 맡는지 비교해요.',
    steps: [
      '설계, 상세도면, 측량·토목, 감리, 공사 중 변경, 사용승인 지원이 각각 포함되는지 물어보세요.',
      '부가세·수수료·방문비·추가 수정비도 포함, 별도, 아직 미정으로 나누세요. 미정 금액은 0원으로 계산하지 않아요.',
      '같은 업무 범위로 다시 견적을 받고, 금액을 정하려면 어떤 조사나 결정이 더 필요한지 확인하세요.',
    ],
    question: '이 금액에 포함된 일, 별도로 내는 돈, 아직 금액을 정하지 못한 항목은 무엇인가요?',
    sources: [
      {
        label: '국토교통부 · 건축물의 설계표준계약서',
        url: 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000185000&chrClsCd=010201',
      },
    ],
  },
  {
    id: 'record-contract-promises',
    title: '계약에는 결과물과 약속을 남겨요',
    summary: '받을 자료, 담당자, 일정, 지급 조건을 구체적으로 정해요.',
    steps: [
      '납품할 도면·서류, 수정 범위, 공사 중 지원, 다른 업체가 맡을 일을 계약과 첨부자료에 적으세요.',
      '설계비·감리비·공사비의 지급 조건을 각각 확인하세요. 감리비는 사용승인 신청 때 계약에 따른 지급 여부를 확인하는 법정 절차가 있어요.',
      '변경할 때는 추가 금액과 일정, 중도 종료 때는 정산과 자료 인계 방법을 먼저 합의하세요.',
      '체크는 내가 확인했다는 기록이에요. 상대방의 동의가 필요한 내용은 계약서·서면 답변으로 남기고, 원본과 개인정보를 가린 공유용 사본을 구분하세요.',
    ],
    question: '제가 받을 최종 자료와 추가비 기준, 지급 시점, 중간에 그만둘 때의 인계 방법을 계약에 적어주실 수 있나요?',
    sources: [
      {
        label: '국토교통부 · 건축물의 설계표준계약서',
        url: 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000185000&chrClsCd=010201',
      },
      {
        label: '건축법 제25조 · 감리비용 지급·확인',
        url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032200459',
      },
    ],
  },
  {
    id: 'choose-survey-purpose',
    title: '측량은 필요한 목적부터 확인해요',
    summary: '땅의 경계 확인과 지형·건물 위치 조사는 목적과 결과물이 달라요.',
    steps: [
      '경계복원측량은 공부에 등록된 경계를 현장에 표시하고, 지적현황측량은 건물·시설의 위치 등을 경계와 비교해 도면에 표시해요.',
      '설계용 일반 현황측량과 지적측량을 구분하고, 필요한 종목과 실제 수행업체의 등록·업무 범위를 물어보세요.',
      '측량 목적·날짜·수행자와 성과도를 받으세요. 지도 앱의 선이나 일반 현황도만으로 공식 지적경계를 확인했다고 기록하지 마세요.',
      '분할 등 토지의 표시가 바뀌는 일은 측량 이후 토지이동 신청·처리도 필요한지 확인하세요.',
    ],
    question: '제 땅에는 어떤 측량이 필요하고, 누가 수행하며, 어떤 결과와 후속 절차가 남나요?',
    sources: [
      {
        label: 'LX · 지적측량 종목안내',
        url: 'https://www.lx.or.kr/kor/sub01_01_01_02.do',
      },
      {
        label: 'LX · 지적측량과 토지이동',
        url: 'https://baro.lx.or.kr/lgstrsurv/lgstrsurvInfo01.do',
      },
      {
        label: '공간정보관리법 제44조 · 측량업 등록',
        url: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031227345',
      },
    ],
  },
  {
    id: 'follow-permit-evidence',
    title: '접수와 처리 결과를 나눠 봐요',
    summary: '지금 누구의 어떤 일을 기다리는지 자료로 확인해요.',
    steps: [
      '접수번호·접수일·관할기관, 보완요청, 제출한 답변, 허가서·신고필증을 단계별로 받아 보관하세요. 접수됐다는 안내와 처리 완료는 달라요.',
      '업체가 약속한 작업일과 관청에서 안내한 처리예정일을 나누고, 기다리는 이유와 다음 확인일을 적으세요.',
      '허가와 착공신고는 별도 절차예요. 내 사업에 필요한 신고·계약·허가조건을 담당자에게 확인하세요.',
      '앱의 진행 체크는 내 기록이에요. 관청의 승인 여부는 해당 결과 자료로 확인하고, 부족한 자료는 다음 질문으로 남기세요.',
    ],
    question: '현재 접수·보완·검토·결과 수령 중 어느 단계이며, 제가 볼 수 있는 자료와 다음 확인일은 무엇인가요?',
    sources: [
      {
        label: '정부24 · 건축신고 안내',
        url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000071&HighCtgCD=A09005&tp_seq=',
      },
      {
        label: '정부24 · 건축물착공 신고 안내',
        url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000069',
      },
    ],
  },
  {
    id: 'agree-before-changes',
    title: '공사 중 변경은 먼저 설명받아요',
    summary: '도면·비용·일정이 어떻게 달라지는지 확인하고 기록해요.',
    steps: [
      '변경 전후 도면, 변경 이유, 설계비·공사비의 증감과 일정 영향을 한 번에 받아 보세요.',
      '책임 전문가에게 안전·다른 공종·변경허가나 신고에 미치는 영향을 확인받으세요. 필요한 행정절차와 처리 시점에는 예외가 있으니 개별 확인이 필요해요.',
      '설계자, 법정 감리자, 시공자는 맡는 일이 달라요. 감리 지정·방문·보고 방식과 현장 질문 창구를 확인하세요.',
      '내 동의와 담당자의 검토·시공 지시를 구분해 남기고, 이전 도면을 보관하면서 최신본을 표시하세요.',
    ],
    question: '이 변경으로 금액·기간·허가사항이 어떻게 달라지고, 누가 검토한 뒤 시공하나요?',
    sources: [
      {
        label: '건축법 제16조 · 허가와 신고사항의 변경',
        url: 'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0016&lsiSeq=273437&urlMode=lsScJoRltInfoR',
      },
      {
        label: '건축법 제25조 · 공사감리',
        url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1028914547',
      },
    ],
  },
  {
    id: 'finish-in-three-parts',
    title: '마무리는 세 가지로 확인해요',
    summary: '행정절차, 자료 인수, 남은 공사·보수를 각각 살펴봐요.',
    steps: [
      '행정절차: 내 사업에 필요한 사용승인·개발행위 준공 등의 결과를 받으세요. 함께 처리된 절차와 따로 남은 조건도 확인하세요.',
      '자료 인수: 변경이 반영된 최종도면, 약정 성과물, 설비 설명서, 보증자료와 담당자 연락처를 받고 다시 열어보세요.',
      '남은 공사·보수: 위치·사진·담당자·조치기한을 적고 완료된 항목부터 확인하세요. 정산은 계약과 승인된 변경·지급 기록을 대조하세요.',
      '사용승인을 받았어도 계약상 자료 인수나 보수가 남을 수 있어요. 세 항목의 완료일을 따로 남기고 감리비 등 지급 조건도 구분하세요.',
    ],
    question: '공식 완료 결과와 최종 자료를 받을 수 있나요? 남은 작업·보수는 누가 언제까지 처리하나요?',
    sources: [
      {
        label: '건축법 제22조 · 건축물의 사용승인',
        url: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1034173429',
      },
      {
        label: '국토계획법 제62조 · 개발행위 준공검사',
        url: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1019308945',
      },
    ],
  },
];

export const OFFICIAL_LINKS: {
  label: string;
  description: string;
  url: string;
}[] = [
  {
    label: '건축사·사무소 찾아보기',
    description: '대한건축사협회에서 이름으로 검색해요. 미검색 항목은 등록자료·관할기관으로 추가 확인하세요.',
    url: 'https://www.kira.or.kr/index.do',
  },
  {
    label: '자격등록증 발급번호 확인',
    description: '건축사등록원에서 받은 증명서의 발급번호를 확인해요. 현재 업무 상태는 별도로 살펴보세요.',
    url: 'https://kirakarb.kira.or.kr/issue/prfIsnCnfm.do',
  },
  {
    label: '처분·실적 증명서 알아보기',
    description: '후보 건축사에게 요청할 수 있는 행정처분 조회서·설계 및 감리 실적증명서 안내예요.',
    url: 'https://cert.kira.or.kr/certificate_type.do',
  },
  {
    label: '필요한 지적측량 찾아보기',
    description: 'LX에서 경계복원·지적현황·분할 등 목적별 측량을 알아봐요.',
    url: 'https://www.lx.or.kr/kor/sub01_01_01_02.do',
  },
  {
    label: '설계가 진행되는 과정',
    description: '기획, 계획·중간·실시설계에서 무엇을 정하고 어떤 도면을 만드는지 살펴봐요.',
    url: 'https://www.kira.or.kr/jsp/main/06/new7.jsp',
  },
  {
    label: '설계 표준계약서 참고하기',
    description: '업무 범위·대가·기간을 정할 때 참고해요. 실제 사업에 맞는 계약 내용은 상대방과 합의하세요.',
    url: 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000185000&chrClsCd=010201',
  },
  {
    label: '착공신고 절차 알아보기',
    description: '정부24의 신청·제출자료 안내예요. 내 사업에 필요한 내용은 관할기관에 확인하세요.',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000069',
  },
  {
    label: '사용승인 기준 확인하기',
    description: '건축법의 사용승인 절차와 관계 절차를 확인해요. 자료 인수·잔여 보수도 함께 챙기세요.',
    url: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1034173429',
  },
];

export const QUESTIONS: {
  id: string;
  title: string;
  text: string;
  phase: string;
}[] = [
  {
    id: 'question-first-step',
    title: '무엇부터 준비할까요?',
    text: '제가 하려는 일에 어떤 검토가 먼저 필요하고, 제가 준비할 자료는 무엇인가요?',
    phase: 'prepare',
  },
  {
    id: 'question-similar-work',
    title: '비슷한 일을 해봤나요?',
    text: '저와 비슷한 용도·규모의 일을 끝까지 맡아본 사례가 있나요? 그 사례에서 실제로 맡은 부분도 알려주세요.',
    phase: 'compare',
  },
  {
    id: 'question-responsible-person',
    title: '누가 어디까지 맡나요?',
    text: '제 일을 최종 검토하고 책임지는 분과 직접 연락할 담당자는 누구인가요? 등록자료, 맡는 범위와 협력업체도 알려주세요.',
    phase: 'contract',
  },
  {
    id: 'question-extra-cost',
    title: '추가로 드는 돈은요?',
    text: '이 견적에서 포함된 비용, 별도로 내는 비용, 아직 미정인 비용을 나눠주세요. 수정·방문·측량·감리·사용승인 지원과 부가세도 확인하고 싶어요.',
    phase: 'contract',
  },
  {
    id: 'question-drawing-survey',
    title: '다음 도면은 언제 받나요?',
    text: '설계에 필요한 측량·현장확인은 무엇이며 어떤 결과를 받나요? 다음 도면을 받을 날짜와 제가 결정할 내용도 알려주세요.',
    phase: 'design',
  },
  {
    id: 'question-permit-status',
    title: '지금 어느 단계인가요?',
    text: '현재 접수·보완·검토·결과 수령 중 어느 단계인가요? 접수번호와 관련 자료, 누구의 어떤 일을 기다리는지, 다음 확인일을 알려주세요.',
    phase: 'permit',
  },
  {
    id: 'question-change-impact',
    title: '바꾸기 전에 무엇을 확인하나요?',
    text: '이 변경으로 도면·금액·기간·허가사항이 어떻게 달라지나요? 누가 전문 검토하고, 제가 동의한 뒤 누가 시공을 지시하는지도 알려주세요.',
    phase: 'construction',
  },
  {
    id: 'question-final-handover',
    title: '마무리까지 무엇이 남았나요?',
    text: '필요한 사용승인·준공 결과, 제가 받을 최종 자료, 남은 공사·보수를 각각 알려주세요. 담당자와 완료 예정일도 함께 확인하고 싶어요.',
    phase: 'completion',
  },
];
