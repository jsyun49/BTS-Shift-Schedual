# 교대 근무표 관리 시스템

6명의 교대 근무자가 각자 로그인하여 근무 일정을 스스로 등록/수정하고, 관리자가 전체 현황을
감독·조정할 수 있는 셀프서비스 근무표 관리 웹앱입니다.

## 기술 스택

- **프론트엔드**: React + Vite + TypeScript, Tailwind CSS v4
- **백엔드**: Node.js + Express + TypeScript
- **데이터베이스**: SQLite (`node:sqlite` 내장 모듈 사용 — 별도 네이티브 빌드 불필요)
- **인증**: 아이디/비밀번호 로그인, JWT, bcrypt 비밀번호 해시

> 원래 계획한 `better-sqlite3`는 네이티브 컴파일(node-gyp, Python)이 필요해 이 환경에서 빌드가
> 실패했습니다. 대신 Node.js 22.5+ 에 내장된 `node:sqlite`(`DatabaseSync`)를 사용하도록
> 변경했습니다. API가 거의 동일(동기식 `prepare/get/all/run`)하여 코드 구조에는 차이가 없습니다.

## 폴더 구조

```
shift-scheduler-app/
  server/            Express + TypeScript API 서버
    src/
      db/            스키마, 마이그레이션, 시드 스크립트
      middleware/     JWT 인증/인가 미들웨어
      routes/         auth, users, shift-types, schedules, swaps, notifications, stats, export, settings
    .env.example
  client/            React + Vite + TypeScript 프론트엔드
    src/
      api/           axios 클라이언트
      context/        Auth, Toast 컨텍스트
      components/     Calendar, ShiftModal, SwapRequestModal, NotificationBell, admin/*
      pages/          로그인, 내 근무 관리, 교대 요청함, 프로필, 관리자
```

## 계정 발급 정책

- **공개 회원가입 페이지는 존재하지 않습니다.** 서버에도 회원가입 라우트가 없습니다.
- 근무자 계정은 **관리자가 관리자 화면(근무자 계정 탭)에서만** 생성할 수 있습니다.
- 근무자는 관리자가 발급한 아이디/임시 비밀번호로 최초 로그인 후, 비밀번호를 변경하기 전까지는
  **프로필(비밀번호 변경) 화면으로만 강제 이동**됩니다.

## 실행 방법

### 0. 사전 준비

Node.js 22.5 이상 (권장: 최신 LTS, 예: v24)이 필요합니다. `node:sqlite`가 이 버전부터 내장되어 있습니다.

```bash
node -v
```

### 1. 백엔드 설정 및 실행

```bash
cd server
npm install
copy .env.example .env    # (Windows PowerShell는 Copy-Item .env.example .env)
npm run migrate           # DB 스키마 생성
npm run seed               # 초기 관리자 계정 + 기본 근무 유형 시드
npm run dev                 # http://localhost:4000
```

`.env`의 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME`을 바꾼 뒤 시드를
실행하면 원하는 초기 관리자 계정으로 생성할 수 있습니다. 기본값은 아래와 같습니다.

**초기 관리자 계정**
- 아이디: `admin`
- 비밀번호: `admin`

로그인 후 반드시 비밀번호를 변경하세요.

### 2. 프론트엔드 설정 및 실행

새 터미널에서:

```bash
cd client
npm install
npm run dev    # http://localhost:5173
```

Vite 개발 서버는 `/api` 요청을 `http://localhost:4000`으로 프록시하도록 설정되어 있어
(`vite.config.ts`), 별도 CORS 설정 없이 바로 동작합니다.

브라우저에서 `http://localhost:5173` 접속 → 위 초기 관리자 계정으로 로그인.

### 3. 근무자 계정 발급

1. 관리자로 로그인 → 상단 탭 **관리자** → **근무자 계정** 탭
2. **+ 근무자 계정 추가** 클릭 → 이름/아이디/임시 비밀번호/연락처/색상 태그 입력 후 생성
3. 근무자에게 아이디/임시 비밀번호 전달 → 근무자가 로그인 후 **프로필**에서 비밀번호 변경

비밀번호를 잊어버린 근무자는 관리자가 **근무자 계정** 탭에서 "비밀번호 초기화"로 새 임시
비밀번호를 부여할 수 있습니다(다음 로그인 시 다시 변경 필요).

### 4. 근무 유형 설정

관리자 → **근무 유형** 탭에서 Office(주간)/GY(야간)/SW(반차)/휴무 등 근무 유형을 추가·비활성화할 수
있습니다. (시드 스크립트가 기본값으로 Office 08:00~17:00, GY 22:00~06:00, SW 14:00~22:00,
휴무를 생성합니다.)

### 5. 프로덕션 빌드

```bash
cd server && npm run build && npm start     # dist/index.js 실행, 기본 포트 4000
cd client && npm run build                   # dist/ 에 정적 파일 생성 — 원하는 정적 호스팅/리버스 프록시로 서빙
```

프로덕션 배포 시 `client`의 빌드 결과물을 별도 정적 서버(Nginx 등)로 서빙하고, `/api` 요청을
Express 서버(4000)로 리버스 프록시하도록 구성하세요. `server/.env`의 `JWT_SECRET`은 반드시
충분히 길고 무작위한 값으로 교체해야 합니다.

## 핵심 기능 요약

- **근무자 셀프서비스**: 월간 캘린더에서 본인 근무만 등록/수정/삭제 (같은 날짜 중복 등록은
  서버에서 차단, 최소 근무 인원 미달 날짜는 캘린더에 하이라이트)
- **교대(스왑) 요청**: 근무자가 다른 근무자에게 본인 근무를 교대 요청 → 대상자가 수락하면
  두 사람의 근무가 **트랜잭션으로 원자적으로** 교체(또는 이전)됨. 관련된 다른 대기중 요청은
  자동 취소되어 데이터 정합성을 보장합니다.
- **알림**: 스왑 요청 수신/수락/거절, 관리자의 대리 수정 시 인앱 알림(상단 배지 + 드롭다운)
- **관리자**: 근무자 계정 생성/비활성화/비밀번호 초기화, 근무 유형 관리, 전체 근무표 강제
  수정, 스왑 요청 전체 관리(강제 승인/거절/취소), 월별 통계, CSV 내보내기, 변경 이력 조회
- **보안**: 모든 API가 JWT 인증 미들웨어를 통과해야 하며, 본인 소유가 아닌 근무/스왑 요청에
  대한 수정 시도는 서버에서 403으로 차단(프론트엔드 검증에만 의존하지 않음). 비밀번호는
  bcrypt로 해시 저장. 공개 회원가입 라우트 없음.

## API 개요 (일부)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| POST | `/api/auth/login` | 로그인 | 공개 |
| GET/PATCH | `/api/auth/me` | 내 정보 조회/연락처 수정 | 인증 필요 |
| POST | `/api/auth/change-password` | 비밀번호 변경 | 인증 필요 |
| GET/POST | `/api/users` | 사용자 목록 조회 / 근무자 계정 생성 | 인증 필요 / 관리자 |
| PATCH `/api/users/:id`, `POST /api/users/:id/reset-password` | 계정 수정, 비밀번호 초기화 | 관리자 |
| GET/POST | `/api/shift-types` | 근무 유형 조회/추가 | 인증 필요 / 관리자 |
| GET/POST/PATCH/DELETE | `/api/schedules` | 근무 조회/등록/수정/삭제 | 인증 필요(소유자 또는 관리자) |
| GET | `/api/schedules/change-logs` | 변경 이력 | 관리자 |
| GET/POST | `/api/swaps`, `/api/swaps/:id/accept|reject|cancel` | 교대 요청 | 인증 필요(요청자/대상자 또는 관리자) |
| GET/POST | `/api/notifications` | 알림 조회/읽음 처리 | 인증 필요 |
| GET | `/api/stats` | 월별 통계 | 인증 필요 |
| GET | `/api/export/schedules.csv` | CSV 내보내기 | 관리자 |
| GET/PATCH | `/api/settings` | 최소 근무 인원 설정 | 인증 필요 / 관리자(수정) |
