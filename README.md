# 설계해요 · seolgyehaeyo

**좋은 설계사무소를 고르고, 맡긴 일이 끝까지 잘 진행되도록.** 의뢰자의 선택·확인·소통·진행·준공 자료 인수를 돕는 해요(haeyo) 계열 웹앱입니다.

## 공식 등록명부 확인

`public/registry.html`에서 공개 원문을 수집한 범위 안에서 사무소를 찾고 등록증과 대조합니다. 이름·주소·대표자 부분검색, 등록번호 정확검색, 지역/업종 필터, 근거와 확인 질문 복사를 지원합니다.

[구현·범위·운영 안내](docs/REGISTRY-IMPLEMENTATION.md) · [수집 출처 설정](config/registry-sources.json) · [자동수집 실행](https://github.com/softm/seolgyehaeyo/actions/workflows/registry.yml)

| 항목 | 내용 |
|---|---|
| 수집 방식 | 공식 원문에서 다운로드 주소 확인 → CSV/XLSX → 검증 → 정규화 JSON |
| 예약 | 매일 08:17 KST, 지연 가능 · 수동 실행도 제공 |
| 화면 | `public/registry.html`, `public/data-status.html` |
| 상태 | 기준일·시도·성공·실패·반영 건수를 구분 |
| 범위 | 성공한 파일만 검색. 전국 전체 명부 아님 |
| 협회 | 공간정보산업협회 측량업체 검색과 건축사협회 공식 경로 연결. 전국 일괄 수집 아님 |
| 판정 | 공개명부 수록/정보 일치만 설명. 무등록·사기·정상영업으로 자동 판정하지 않음 |

```sh
python -m unittest discover -s tests -p test_registry.py -v
node --test tests/registry.test.mjs
python scripts/collect_registry.py
python -m http.server 8000 --directory public
```

수집된 개인정보성 입력·의뢰 계약서·등록증 사본은 공개 저장소나 자동수집으로 보내지 않습니다. 대조 입력은 브라우저 메모리에만 남으며 닫으면 지워집니다. 결과를 남기려면 복사 후 자신의 기록에 붙여 넣습니다.

## 기존 의뢰자 작업실

이전 구현 커밋의 화면·API·D1/R2·파일 보관 코드를 main에 합치되 후속 등록 검증 문서와 스크립트를 보존했습니다. 사무소/견적, 계약/지급, 단계별 확인·질문, 변경, 자료함, 마무리와 내보내기 기능이 포함됩니다. 기존 프로젝트 데이터와 API를 수정·삭제하지 않았습니다.

기술은 Vinext/React/TypeScript, Cloudflare Workers/D1/R2, Sites ChatGPT 로그인입니다. 현재 저장소 코드는 복구·확장했지만 **운영 사이트 재배포·전체 인증 통합검증과 별도**입니다. 이번 변경에서 기존 앱 전체 테스트를 새로 통과했다고 주장하지 않습니다.

```sh
pnpm install:ci
pnpm dev
pnpm build
```

[기존 개발·배포 안내](docs/DEPLOYMENT.md) · [기존 검증 기록](docs/TESTING.md) · [제품 기획](docs/PRODUCT.md) · [로드맵](docs/ROADMAP.md) · [이름 기준](docs/BRAND.md) · [사용자 가이드](docs/user-guide.md) · [8개 AI 역할 관점 검토](docs/ROLE-REVIEW.md)

역할 검토 문서는 AI 관점 검토이며 실제 전문가 회의나 개별 법률자문이 아닙니다. 파일 원본은 R2, 의뢰 기록은 D1에서 소유자별로 보관하는 기존 설계를 유지합니다. 별도 공표·이용조건 확인이 필요한 새로운 출처는 수집 설정에 임의로 추가하지 않습니다.
