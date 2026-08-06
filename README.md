# CPC 관리 대시보드

CPC(Cost Per Container 등) 데이터를 팀원들이 웹에서 함께 입력하고,
"일 근무자 수 기준" / "실근무시간(스케줄+연장근무) 기준" 두 가지 계산 방식으로
바로 전환해서 볼 수 있는 내부용 웹앱입니다.

- 프론트엔드/백엔드: Next.js 14 (App Router, API Routes)
- DB: PostgreSQL (Vercel Postgres, Neon, Supabase 등 아무거나 가능) + Prisma ORM
- 인증: 사내 공용 비밀번호 1개로 로그인하는 간단한 쿠키 게이트 (개별 계정 없음)
- 차트: 외부 라이브러리 없이 순수 SVG로 직접 그림 (네트워크 차단 환경에서도 항상 렌더링)

---

## 1. 로컬에서 먼저 실행해보기 (권장)

Vercel에 올리기 전에 로컬에서 한 번 돌려보고 문제가 없는지 확인하는 것을 권장합니다.
(이 프로젝트는 코드 생성 환경의 네트워크 제한 때문에 `npm install` / `npm run build` 로
직접 빌드 검증을 하지 못했습니다 — 로컬 또는 Vercel 빌드 시 사소한 오류가 나올 수 있으니
에러 메시지를 캡처해서 알려주시면 바로 고쳐드리겠습니다.)

```bash
cd cpc-dashboard-app
npm install

# .env 파일 생성 후 값 채우기
cp .env.example .env
# DATABASE_URL, APP_PASSWORD, SESSION_SECRET 값을 입력

# DB 테이블 생성
npx prisma migrate dev --name init

# 초기 워크센터(P1/P2/P3) 시드 데이터 입력
node prisma/seed.js

npm run dev
# http://localhost:3000 접속 → 로그인 (APP_PASSWORD로 설정한 값)
```

---

## 2. GitHub에 올리기

```bash
cd cpc-dashboard-app
git init
git add .
git commit -m "Initial commit: CPC 대시보드"
git branch -M main
git remote add origin https://github.com/<사용자계정>/<저장소이름>.git
git push -u origin main
```

(GitHub에 새 저장소를 먼저 만들어두세요: https://github.com/new — Private 권장)

---

## 3. Vercel 배포

1. https://vercel.com 에서 GitHub 계정으로 로그인
2. "Add New Project" → 방금 만든 GitHub 저장소 선택 → Import
3. **Storage 탭에서 Postgres 추가** (Vercel Postgres 또는 Neon 통합 선택)
   - 생성하면 `DATABASE_URL` 환경변수가 프로젝트에 자동으로 연결됩니다.
4. **Settings → Environment Variables** 에 아래 값 추가
   - `APP_PASSWORD` : 팀이 함께 쓸 로그인 비밀번호
   - `SESSION_SECRET` : 임의의 긴 문자열 (터미널에서 `openssl rand -hex 32` 로 생성)
   - (DATABASE_URL은 3번에서 자동으로 추가됨)
5. **Deploy** 클릭

배포가 끝나면 Vercel이 `https://<프로젝트이름>.vercel.app` 링크를 줍니다.
팀원들은 이 링크로 접속해서 공용 비밀번호로 로그인하면 됩니다.

### 최초 배포 후 1회만 실행

DB 테이블 생성과 워크센터 초기 데이터는 배포 후 한 번만 해주면 됩니다.

```bash
# 로컬 터미널에서, .env의 DATABASE_URL을 Vercel Postgres 값으로 맞춘 뒤
npx prisma migrate deploy
node prisma/seed.js
```

또는 Vercel 프로젝트의 "Deployments" → 최신 배포 → 상단의 터미널 아이콘(있는 경우)에서 실행해도 됩니다.

---

## 4. 사용 방법

| 화면 | 경로 | 설명 |
|---|---|---|
| 대시보드 | `/dashboard` | 월 선택 + "근무자 수 기준"/"실근무시간 기준" 토글, 꺾은선/도넛 차트, TOP10, 상세 표 |
| CPC 데이터 | `/admin/cpc-data` | 원본 핸들링 엑셀 업로드(같은 기간 데이터는 자동 교체) 또는 수동 1건 입력, 워크센터 관리 |
| 근무자 | `/admin/workers` | 워크센터별 근무자 등록 (정규직/파트타임) |
| 기본 스케줄 | `/admin/schedule` | 파트타임 근무자의 요일별 기본 근무시간 설정 |
| 일일 근무시간 | `/admin/hours` | 특정 날짜의 결근 처리, 스케줄 예외, 연장근무 시간 입력 |

### 계산 방식

- **근무자 수 기준**: `그 날 raw CPC 합계 ÷ 그 날 근무시간이 0보다 큰 근무자 수`
- **실근무시간 기준**: `그 날 raw CPC 합계 ÷ (기본 스케줄 시간 + 연장근무 시간, 결근자는 0)`
  - 어떤 날짜에 "일일 근무시간"에 입력이 없으면 "기본 스케줄" 값이 자동 적용됩니다.
  - 파트타임 근무자는 요일마다 다른 기본 시간을 설정할 수 있습니다.

엑셀 업로드는 기존 "원본데이터" 시트와 동일한 컬럼(Date, Workcenter, Description, Total Cpc 등)을
그대로 인식합니다. 워크센터 코드가 새로운 값이면 자동으로 워크센터가 생성되며,
`/admin/cpc-data`에서 표시 이름(라벨)을 확인/수정할 수 있습니다.

---

## 5. 보안 관련 참고

지금 구현은 "사내 공용 비밀번호 1개"로만 접근을 제어하는 가벼운 방식입니다.
개별 계정, 권한 구분(입력자 vs 조회자), 감사 로그 등이 필요해지면 NextAuth 등으로 교체를
권장드립니다 — 필요하실 때 말씀해주시면 이어서 작업해드리겠습니다.
