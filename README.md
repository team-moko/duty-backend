# duty-backend — 주식 절세 추천 백엔드 API

연봉·나이·투자 현황을 입력하면 한국 세법 기준 **절세 상품 Top 5** 를 추천해주는 백엔드 API.
규칙 기반(Rule-based) 추천 엔진, Express + TypeScript.

원본 스펙은 [`PROMPT.md`](./PROMPT.md), 입출력 상세는 [`SPEC.md`](./SPEC.md) 를 참고하세요.

## 요구 사항

- Node.js 20+
- npm 10+

## 설치

```bash
npm install
```

## 개발 서버 실행

```bash
npm run dev
# → http://localhost:8000
```

`PORT` 환경 변수로 포트 변경 가능 (기본 8000).

## 빌드 & 프로덕션 실행

```bash
npm run build       # tsc → dist/
npm start           # node dist/main.js
```

## 테스트

```bash
npm test
```

- `tests/rules.test.ts` — 12개 대표 시나리오 + PROMPT 요구 어설션 + 룰별 동작 검증
- `tests/api.test.ts` — `/health`, `/mock`, `/recommend` 엔드포인트 (supertest)

## 타입 체크

```bash
npm run typecheck
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/recommend` | `UserProfile` 입력 → `RecommendResponse` (Top 5) |
| `GET` | `/health` | `{ "status": "ok" }` |
| `GET` | `/mock` | 프론트 개발용 고정 Mock 응답 |

### 요청 예시

```bash
curl -X POST http://localhost:8000/recommend \
  -H 'Content-Type: application/json' \
  -d '{
    "age": 35,
    "annual_salary": 6000,
    "income_type": "employee",
    "invest_types": ["foreign_stock", "etf_foreign", "domestic_stock"],
    "monthly_invest": 100,
    "has_isa": false,
    "has_pension": true,
    "has_irp": false,
    "pension_contribution": 300,
    "irp_contribution": 0,
    "financial_income": 80,
    "risk_tolerance": "high",
    "has_spouse": true,
    "has_children": true,
    "has_minor_children": true,
    "foreign_stock_unrealized_profit": 1500,
    "dividend_income": 30,
    "holds_high_dividend": false
  }'
```

유효성 검증 실패 시 `422` 로 `{ "detail": [...] }` 반환. 자세한 필드 정의와 카테고리 목록은 [`SPEC.md`](./SPEC.md) 참고.

## 디렉토리 구조

```
duty-backend/
├── PROMPT.md, SPEC.md              # 원본 요구사항 / 스펙
├── claude_code_package/            # 참고용 Python 원본 (학습 데이터 생성기)
├── package.json, tsconfig.json
├── jest.config.js
└── src/
    ├── main.ts                     # 서버 부트스트랩 (PORT)
    ├── server.ts                   # Express 앱 (CORS, JSON, 라우터, 에러 핸들러)
    ├── models.ts                   # Zod 스키마 (UserProfile/RecommendItem/RecommendResponse)
    ├── routes/
    │   └── recommend.ts            # POST /recommend, GET /health, GET /mock
    └── recommend/
        ├── engine.ts               # recommend(profile) — 룰 평가 + 점수 정렬 + Top 5
        ├── constants.ts            # 2025 세법 상수 (한도, 세율 등)
        ├── mock.ts                 # 고정 Mock 응답
        └── rules/
            ├── base.ts             # BaseRule + computeScore 헬퍼
            ├── pension.ts          # 연금저축 세액공제
            ├── irp.ts              # IRP 세액공제
            ├── isa.ts              # ISA 신규 + ISA→IRP 전환
            ├── foreignStock.ts     # 분산매도 / 손익통산 / 가족 증여 (3 룰)
            ├── etf.ts              # ETF 유형별 세금 최적화
            ├── dividend.ts         # 고배당 분리과세
            └── capGains.ts         # 금융소득 종합과세 관리
```

## 점수 산정 공식

[`PROMPT.md`](./PROMPT.md) §5 의 공식을 따릅니다:

```
score = 예상_절세금액(만원) × 긴급도_가중치 × SCORE_SCALE(=10)
계산 불가 항목 → 고정 점수 500
```

`SCORE_SCALE` 은 가중치 (2.0/1.5/1.0/0.8) 와 고정 점수 500 의 단위를 맞추기 위한 보정 상수입니다 — 자세한 이유는 [`src/recommend/rules/base.ts`](./src/recommend/rules/base.ts) docstring 참조.

## CORS

개발 환경 기본 설정으로 `origin: '*'` 입니다. 프로덕션 배포 시 `src/server.ts` 의 CORS 설정을 명시 도메인으로 제한하세요.
