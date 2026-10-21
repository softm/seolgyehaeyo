# 설계해요 개발·배포 안내

갱신일: 2026-10-22

이 문서는 현재 저장소의 실행과 공식 Sites 배포 절차를 정리합니다. 명령을 소개하는 문서이며, 배포 성공이나 종합 검증을 완료했다는 기록은 아닙니다.

## 1. 구성과 접근 범위

- Vinext·React·TypeScript 앱을 Cloudflare Workers에서 실행합니다.
- 프로젝트·수정 이력·파일 메타데이터는 D1의 `DB`, 업로드 바이트는 R2의 `BUCKET` 바인딩을 사용합니다.
- `.openai/hosting.json`의 기존 `project_id`, `d1`, `r2`를 보존합니다. 생성된 `dist/server/wrangler.json`을 원본 설정처럼 수정하지 않습니다.
- 기본 Site 공개 범위는 owner-private입니다. 공개 범위를 바꾸어도 앱의 사용자별 소유권 검사를 제거하지 않습니다.
- Sign in with ChatGPT의 사이트별 안정적인 사용자 ID를 소유자로 사용합니다. 이메일과 이름은 표시용입니다.

Sites 공식 스킬의 현재 버전을 우선합니다. 아래의 `<plugin-root>`는 설치된 Sites 플러그인의 실제 경로로 바꿉니다. helper는 해당 체크아웃을 작업 디렉터리로 하여 절대 경로로 실행합니다.

## 2. 의존성과 로컬 개발

`package.json`은 Node.js `>=22.13.0`, pnpm `11.25.0`을 선언합니다. 현재 `install:ci`는 관리형 Linux의 Bash·flock·GNU timeout을 사용합니다. 다른 운영체제 지원을 확인한 상태로 표시하지 않습니다.

일반 프로젝트 명령은 다음과 같습니다.

```sh
pnpm install:ci
pnpm dev
pnpm build
```

`pnpm-lock.yaml`을 기준으로 설치하며, 설치기를 겹쳐 실행하거나 설치 중 의존성 입력을 변경하지 않습니다. Sites 환경의 초기 설치·중단 복구는 공식 helper를 우선합니다.

```sh
node <plugin-root>/scripts/install-dependencies.mjs
```

기존 프로젝트에 starter 초기화 명령을 다시 실행하지 않습니다. 실행 환경 선택이 불명확할 때만 공식 실행 프로필 절차를 확인합니다. 권한·네트워크·하위 프로세스 오류는 실제 오류를 확인해 환경에 맞게 처리하며, 잠금·권한 검사를 제거하여 우회하지 않습니다.

개발 서버 URL은 실행 결과에 나온 주소를 사용합니다. 관리형 환경의 브라우저 QA는 Sites가 제공하는 preview supervisor 절차를 따릅니다. 내부 미리보기 주소는 사용자에게 배포 주소로 안내하지 않습니다.

## 3. DB 마이그레이션

스키마는 `db/schema.ts`, 적용 이력은 `drizzle/`에 있습니다. 최초 마이그레이션은 `drizzle/0000_magenta_clint_barton.sql`입니다.

스키마 변경이 있을 때 생성하고 SQL·스냅샷·저널을 함께 검토합니다.

```sh
pnpm db:generate
pnpm build
```

로컬 preview에는 아직 적용하지 않은 SQL만 순서대로 적용합니다. 예를 들어 빈 로컬 DB의 최초 적용은 다음과 같습니다.

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_magenta_clint_barton.sql
```

같은 마이그레이션을 무조건 재실행하지 않습니다. 로컬 DB와 운영 DB는 별도입니다. 운영 마이그레이션은 Sites 배포 절차가 처리하며, 적용된 SQL·스냅샷·저널은 수정하지 않고 다음 마이그레이션을 추가합니다. 배포가 실패해도 마이그레이션은 이미 적용되었을 수 있으므로 상태를 먼저 확인합니다.

## 4. 인증과 파일 확인

로그인·로그아웃은 Sites가 소유한 `/signin-with-chatgpt`, `/signout-with-chatgpt` 경로로 최상위 화면 이동을 사용합니다. 앱이 OAuth 콜백이나 인증 헤더 주입을 구현하지 않습니다. 사용자 식별은 `app/chatgpt-auth.ts`의 서버 helper에서 읽습니다.

관리형 환경의 미리보기는 실제 호스팅 인증과 같다고 가정하지 않습니다. 로컬 환경의 모의 인증이나 API 테스트의 모의 사용자는 운영 ChatGPT 인증을 검증한 결과가 아닙니다.

D1 기록 확인과 함께 R2 파일도 다시 내려받아 내용이 같은지 확인합니다. 업로드는 파일당 20MiB, 서버 허용 형식과 내용 검사를 적용합니다. 버전 메모가 같아도 새 파일은 별도 객체로 저장합니다. JSON export의 파일 목록·다운로드 주소는 원본 바이트를 포함하지 않습니다.

## 5. 검증

현재 소스에 맞는 최소 검증부터 실행합니다.

```sh
pnpm exec tsc --noEmit
pnpm build
```

로컬 preview가 실행 중이면 API 검사를 실행합니다. 기본 주소는 `http://127.0.0.1:4173`이며, 다른 로컬 포트는 `SEOLGYE_TEST_URL`로 지정합니다.

```sh
node scripts/test-api.mjs
```

이 스크립트는 localhost 또는 127.0.0.1의 HTTP 주소에만 테스트 식별자를 전송하고 운영·외부 주소와 리다이렉트를 거부합니다. 실제 호스팅 사용자나 OAuth 인증 검사가 아닙니다. 2026-10-22 로컬 실행에서 검사항목 105개가 통과했고, 중단 업로드 복구는 별도로 확인했습니다. 운영 검증 결과와 분리해 기록합니다.

업로드가 중단된 채 15분 이상 지난 경우 프로젝트 재조회 또는 삭제 재시도에서 보관 상태를 확인합니다. R2에 원본이 정상 저장되었으면 목록에 복구하고, 원본이 없으면 중단된 예약을 정리합니다. 15분마다 실행되는 예약 작업이나 모든 실패의 자동 재업로드 기능은 아닙니다.

출시 검증은 [ROADMAP](ROADMAP.md)의 범위를 사용합니다. 핵심은 프로젝트 저장·재조회, 다른 소유자의 접근 차단, 원본 파일 다운로드, 버전 충돌, 입력 근거 검사, 업로드 실패, 내보내기와 삭제·재시도입니다. UI에서는 중간 단계 진입, 가상 예시 구분, 모바일, 키보드, 금액 미정 표시를 확인합니다.

빌드한 Worker를 로컬에서 확인할 때는 다음 명령을 사용합니다. 이 명령은 배포가 아닙니다.

```sh
pnpm start
```

## 6. 공식 Sites 배포 절차

등록된 Site의 ID와 공개 범위를 유지합니다. 기존 Site를 수정하는 경우 먼저 해당 Site를 조회하고 같은 Site의 source credential과 source helper를 사용해 체크아웃 상태를 확인합니다.

1. 변경·마이그레이션·호스팅 설정을 확정합니다.
2. Sites의 source helper에 남은 검사·빌드 명령을 순서대로 전달합니다. 프레임워크 빌드에는 공식 `build-site.mjs`를 사용합니다.
3. helper가 반환한 `project_id`, `commit_sha`, `archive`를 그대로 사용해 버전을 저장·배포합니다.
4. owner-private이 확인되었으면 `save_version_and_deploy_private`를 사용합니다. 해당 호출이 없으면 `save_site_version` 다음 `deploy_private_site_version` 절차를 사용합니다.
5. 배포 상태가 pending·building·publishing일 때만 상태를 이어 확인합니다. 최종 성공 결과의 URL을 README에 반영합니다. 실패나 미확정 상태를 서비스 공개로 표시하지 않습니다.

helper 실행 형식은 다음과 같습니다.

```text
node <plugin-root>/scripts/site-workflow.mjs --project-id <existing-project-id>
```

helper의 입력 대기 안내 후, source credential과 기존 source 결과, 남은 명령 배열, 절대 archive 경로를 **표준입력 JSON**으로 전달합니다. credential은 명령행·소스 파일·출력에 남기지 않습니다.

프레임워크 빌드 명령 배열 예:

```json
["node", "<plugin-root>/scripts/build-site.mjs"]
```

소스 묶음에는 작성한 코드·문서·manifest·마이그레이션을 포함하고, 로컬 환경 파일·개인 데이터·실행 상태·의존성·비밀정보는 포함하지 않습니다. 생성 archive는 소스 체크아웃 밖 또는 제외된 outputs 디렉터리에 두며, 저장 성공까지 바꾸지 않습니다.

Sites의 source 저장소 동기화와 `softm/seolgyehaeyo` GitHub 저장소 반영은 서로 다른 작업입니다. GitHub 반영 여부는 별도로 확인하고 기록합니다.

## 7. 배포 후 문서 갱신

### 이 실행 환경에서의 소스 전송

2026-10-22 실행에서는 공식 source helper의 일반 실행이 네트워크 프록시에 연결하지 못했다. `/root/.codex` 아래 helper를 권한 상승으로 실행하는 방식은 자동 승인 검토가 거부했으므로 사용하지 않았다. 별도로 승인된 표준 Git 명령만 네트워크 권한을 사용해 대상 저장소의 HEAD를 읽고, 일반 push와 원격 HEAD 대조를 수행한다. 토큰은 숨김 stdin과 해당 프로세스 환경에서만 취급하며 파일·인자·로그에 남기지 않는다. 로컬 검사·빌드·공식 패키징 helper는 일반 권한으로 실행한다. 원격 HEAD와 빌드 소스가 일치해야 버전 저장으로 이어간다.

배포 완료 후 사용할 주소는 https://seolgyehaeyo.softm.chatgpt.site 입니다. 실제 성공 결과를 확인한 담당자가 다음을 갱신합니다.

- README의 배포 상태와 실제 접속 URL.
- ROADMAP의 실행한 검사, 확인 환경, 아직 확인하지 못한 항목.
- 운영상 보관·백업·복구·문의 정책이 확정되면 실제 제공 내용.

프로젝트 영구 삭제는 앱의 DB 기록·이력·R2 원본을 대상으로 합니다. 플랫폼 로그·백업 보존과 앱 내 복구 기능을 같은 것으로 약속하지 않습니다.
