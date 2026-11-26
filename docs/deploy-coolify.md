# Coolify 배포 가이드

셀프호스팅 Coolify(v4)에 이 프로젝트를 올리는 절차입니다.
**Dockerfile 빌드 + Coolify 관리형 PostgreSQL** 조합을 권장합니다.

```
GitHub(main) ──push──> Coolify 빌드(Dockerfile) ──> 컨테이너(:8080)
                                                     │
                                    Coolify PostgreSQL(내부 네트워크)
```

## 0. API로 자동 배포 (권장)

private 저장소이므로 먼저 **Coolify GitHub App 에 이 저장소 접근 권한**을 부여합니다.

1. GitHub → **Settings → Applications → Coolify(GitHub App) → Configure**
2. Repository access → `hohyun94/training-server` 추가 (또는 All repositories)
3. Coolify → **Sources → GitHub App → Refresh repositories**

그다음 로컬에서 실행합니다.

```bash
Copy-Item .env.coolify.example .env.coolify   # 값 입력 (git 에 커밋되지 않음)
npm run deploy:coolify -- --check   # 서버·프로젝트·GitHub App 목록 확인 (읽기 전용)
npm run deploy:coolify -- --plan    # 무엇을 만들지 미리보기
npm run deploy:coolify -- --apply   # 프로젝트·DB·앱·환경변수·볼륨·배포까지
```

`.env.coolify` 필수 값: `COOLIFY_URL`, `COOLIFY_TOKEN`, `ADMIN_PASSWORD`
권장: `JWT_SECRET`, `APP_DOMAIN`

스크립트가 처리하는 일:

- 프로젝트(`AX Training`)·환경(`production`) 확인 또는 생성
- PostgreSQL(`training-db`) 생성 후 **internal URL** 확보
- Dockerfile 앱(`training-server`) 생성 · 포트 `8080` · `/Dockerfile`
- 환경변수: `DATABASE_URL` `ADMIN_PASSWORD` `JWT_SECRET` `PUBLIC_BASE_URL`
  `COOKIE_SECURE` `UPLOAD_DIR` `PORT` `RUN_MIGRATIONS`
- 볼륨 `/data/uploads`, 헬스체크 `/api/public/health`
- 배포 실행 → 상태 폴링 → `https://도메인/api/public/health` 확인

> 일부 API 스키마가 인스턴스 버전과 다르면 **경고만 남기고 계속 진행**합니다.
> (예: 볼륨 자동 생성 실패 시 Coolify UI → Persistent Storage 에서 `/data/uploads` 만 추가)
> 아래 수동 절차는 그대로 유효합니다.

## 1. 사전 준비

- Coolify 서버(GitHub App 연결 권장)
- 도메인 또는 서브도메인 (예: `training.example.com`) → Coolify 서버 IP로 A 레코드
- 이 저장소를 GitHub에 push (아래 "GitHub 저장소" 절차)

## 2. PostgreSQL 리소스 만들기

1. Coolify → **Project** → Environment(`production`) → `+ New`
2. **Database → PostgreSQL 16** 선택, 이름 `training-db`, **Deploy**
3. 배포 후 상세 화면에서 **PostgreSQL URL (internal)** 복사
   - 예: `postgres://postgres:비밀번호@training-db-xxxx:5432/postgres`
   - 이 내부 주소는 **같은 Project/Environment** 안에서만 접속됩니다.
   - 외부 포트는 열지 않아도 됩니다.
4. (선택) Scheduled Backups → S3 로 일일 백업 설정

## 3. 애플리케이션 리소스 만들기

1. `+ New` → **Private Repository (GitHub App)** → 이 저장소 선택, Branch `main`
2. **Build Pack: Dockerfile**
   - Base Directory: `/`
   - Dockerfile Location: `/Dockerfile`
3. **Ports Exposes: `8080`**
4. **Domains: `https://training.example.com`** (Coolify가 TLS 자동 발급)
5. **Deploy**

## 4. 환경변수

Configuration → Environment Variables 에 추가 후 재배포합니다.

| Key | 값 | 필수 | 설명 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 2단계에서 복사한 internal URL | ✅ | 예: `postgres://postgres:pw@training-db-xxxx:5432/postgres` |
| `ADMIN_PASSWORD` | 강한 비밀번호 | ✅ | `/admin` 로그인 비밀번호 |
| `JWT_SECRET` | 32자 이상 랜덤 | ✅ | `openssl rand -hex 32` 결과 사용 |
| `PUBLIC_BASE_URL` | `https://training.example.com` | ✅ | QR/참여 링크 생성에 사용 |
| `COOKIE_SECURE` | `true` | ✅ | HTTPS 환경 필수 |
| `UPLOAD_DIR` | `/data/uploads` | ✅ | 5단계 볼륨 경로와 일치 |
| `PORT` | `8080` | - | 기본값과 동일 |
| `RUN_MIGRATIONS` | `true` | - | 부팅 시 마이그레이션 자동 적용 |

## 5. 영구 볼륨 (첨부파일)

**Persistent Storage → Volume Mount**

- Name: `uploads`
- Destination Path: `/data/uploads`

> 설정하지 않으면 재배포 때 교육생이 올린 파일이 사라집니다.

## 6. 헬스체크

Dockerfile 에 `HEALTHCHECK`(`/api/public/health`)가 정의되어 있어 Coolify가
비정상 컨테이너를 자동 재시작합니다. 별도 설정을 원하면
**Health Check Path** 에 `/api/public/health` 를 넣어도 됩니다.

## 7. 자동 배포

- GitHub App 연결 시: `main` push → 자동 빌드/배포
- Webhook 방식: GitHub 저장소 → Settings → Webhooks 에 Coolify Webhook URL + Secret 등록
- PR 미리보기 배포는 DB를 공유하므로 끄는 것을 권장

## 8. 배포 후 확인 체크리스트

1. `https://도메인/api/public/health` → `{"ok":true}`
2. `https://도메인/` 랜딩 → `/admin` 로그인 성공
3. 새 교육 만들기 → 입장 코드 확인 → `메인화면 열기` → QR 표시
4. 휴대폰으로 QR 스캔 → 조 선택 → 미션 제출
5. 프로젝터 화면에 제출물 표시 → 리뷰/피드백 → 엑셀 다운로드

## 9. 업데이트 / 롤백

- push 하면 자동 재배포되며, 부팅 시 `drizzle/` 마이그레이션이 자동 적용됩니다.
- 마이그레이션은 **되돌리지 않습니다.** 컬럼 삭제/타입 변경은
  `추가 → 코드 전환 → 정리` 3단계 배포로 진행하세요.
- 긴급 롤백: Coolify에서 이전 배포(Redeploy)를 선택. DB 스키마는 최신 상태로 유지됩니다.

## 10. 자주 막히는 지점

| 증상 | 원인 / 해결 |
| --- | --- |
| 502 Bad Gateway | 컨테이너 unhealthy 또는 포트 불일치 → `Ports Exposes=8080`, 로그 확인 |
| 로그인 직후 풀림 | `COOKIE_SECURE=true` 인데 http 접속 / 도메인 미설정. HTTPS 도메인으로 접속 |
| QR에 `localhost` 표시 | `PUBLIC_BASE_URL` 미설정 |
| 첨부파일 404·유실 | 볼륨 미설정 또는 `UPLOAD_DIR` 불일치 |
| DB 연결 실패 | DB와 앱이 다른 Environment / internal URL 대신 public URL 사용 |
| 재배포마다 로그아웃 | 정상 동작(JWT_SECRET 유지 시 세션 유지, 변경 시 만료) |
| 강사 비밀번호 변경 | `ADMIN_PASSWORD` 수정 후 재배포 |

## 11. 리소스 가이드

- 앱: 0.25~0.5 vCPU / 256~512MB (교육생 40명 규모 충분)
- DB: 0.25 vCPU / 256MB
- 업로드 제한: 파일당 20MB (`src/routes/play.ts` 에서 조정)

## 12. Docker Compose 로 올리는 경우(대안)

`docker-compose.yml` 에 DB까지 포함되어 있으므로 Build Pack을
**Docker Compose** 로 지정해도 배포됩니다. 다만 이 경우 도메인 라우팅을 위해
Coolify의 "Service FQDN" 설정이 필요하고 DB 백업 관리가 별도이므로,
위의 **Dockerfile + 관리형 PostgreSQL** 방식을 권장합니다.
