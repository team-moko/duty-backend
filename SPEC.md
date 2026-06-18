# API 상세 명세서 (SPEC.md)
# 주식 절세 추천 서비스 — 백엔드 / 프론트 공통 참고

---

## 1. 엔드포인트

| Method | Path        | 설명 |
|--------|-------------|------|
| POST   | /recommend  | 프로필 입력 → Top 5 추천 반환 |
| GET    | /health     | 헬스체크 |
| GET    | /mock       | 고정 Mock 데이터 반환 (프론트 개발용) |

Base URL (로컬): `http://localhost:8000`

---

## 2. POST /recommend

### Request Body

```json
{
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
}
```

#### 필드 상세

| 필드 | 타입 | 필수 | 설명 | 유효값 |
|------|------|------|------|--------|
| age | int | ✅ | 나이 | 19 ~ 80 |
| annual_salary | int | ✅ | 연봉 (만원), 무소득이면 0 | 0 이상 |
| income_type | string | ✅ | 소득 유형 | `employee` / `freelancer` / `none` |
| invest_types | string[] | ✅ | 보유 투자 유형 (복수 선택) | 아래 InvestType 참고 |
| monthly_invest | int | ✅ | 월 투자 가능 금액 (만원) | 0 이상 |
| has_isa | bool | ✅ | ISA 계좌 보유 여부 | |
| has_pension | bool | ✅ | 연금저축 보유 여부 | |
| has_irp | bool | ✅ | IRP 보유 여부 | |
| pension_contribution | int | | 연금저축 연 납입액 (만원), 기본값 0 | 0 ~ 600 |
| irp_contribution | int | | IRP 연 납입액 (만원), 기본값 0 | 0 ~ 300 |
| financial_income | int | | 연 금융소득 이자+배당 추정 (만원), 기본값 0 | 0 이상 |
| risk_tolerance | string | ✅ | 투자 성향 | `low` / `medium` / `high` |
| has_spouse | bool | | 배우자 유무, 기본값 false | |
| has_children | bool | | 자녀 유무, 기본값 false | |
| has_minor_children | bool | | 미성년 자녀 유무, 기본값 false | |
| foreign_stock_unrealized_profit | int | | 해외주식 미실현 수익 (만원), 기본값 0 | 0 이상 |
| dividend_income | int | | 연 배당소득 (만원), 기본값 0 | 0 이상 |
| holds_high_dividend | bool | | 고배당주 보유 여부, 기본값 false | |

#### InvestType 유효값

| 값 | 설명 |
|----|------|
| `domestic_stock` | 국내 상장주식 |
| `foreign_stock` | 해외주식 (미국 등) |
| `etf_domestic` | 국내주식형 ETF (KODEX 200 등) |
| `etf_foreign` | 국내 상장 해외지수 ETF (TIGER S&P500 등) |
| `fund` | 공모펀드 |
| `deposit` | 예·적금 |
| `bond` | 채권 |
| `reit` | 리츠 |

---

### Response Body

```json
{
  "recommendations": [
    {
      "rank": 1,
      "product": "연금저축펀드",
      "category": "세액공제",
      "score": 594.0,
      "expected_benefit_krw": 594000,
      "reason": "연봉 6,000만원 기준 세액공제율 13.2% 적용. 현재 300만원 납입 중으로 한도 600만원까지 300만원 여유 있습니다.",
      "action": "연금저축 300만원 추가 납입 (현재 300만원 → 목표 600만원)",
      "warning": null
    },
    {
      "rank": 2,
      "product": "해외주식 연도별 분산 매도",
      "category": "양도소득세 절세",
      "score": 500.0,
      "expected_benefit_krw": 2750000,
      "reason": "미실현 수익 1,500만원을 한 번에 매도하면 양도세 약 275만원 발생합니다. 매년 250만원씩 6년에 걸쳐 매도하면 양도세 0원이 가능합니다.",
      "action": "연간 매도 수익 250만원 이하로 분산 (약 6년 계획)",
      "warning": "12월 29일(거래일) 이전 매도 완료 필요 (결제일 기준 과세)"
    }
  ],
  "total_applicable": 6,
  "profile_summary": "35세 직장인 · 연봉 6,000만원"
}
```

#### RecommendItem 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| rank | int | 추천 순위 (1~5) |
| product | string | 추천 상품명 |
| category | string | 카테고리 (아래 참고) |
| score | float | 내부 점수 |
| expected_benefit_krw | int \| null | 예상 절세액 (원 단위). 계산 불가 시 null |
| reason | string | 추천 근거 (1~2문장, 수치 포함) |
| action | string | 구체적 실행 방법 (1문장) |
| warning | string \| null | 주의사항. 없으면 null |

#### category 유효값

| 값 | 설명 |
|----|------|
| `세액공제` | 연금저축, IRP |
| `비과세·분리과세` | ISA |
| `세액공제 추가` | ISA→IRP 전환 |
| `양도소득세 절세` | 해외주식 관련 전략 |
| `구조적 절세` | ETF 유형 최적화 |
| `배당소득 분리과세` | 고배당주 분리과세 |
| `종합소득 관리` | 금융소득 종합과세 관리 |

---

## 3. GET /mock

프론트 개발용 고정 응답. 실제 계산 없이 하드코딩된 샘플 데이터 반환.
백엔드 완성 전에도 프론트가 UI 개발 가능하도록 제공.

응답 형식은 `/recommend` 와 동일.

---

## 4. 에러 응답

```json
{
  "detail": "에러 메시지"
}
```

| HTTP 상태코드 | 상황 |
|---------------|------|
| 422 | 입력값 유효성 검증 실패 (Pydantic 자동 처리) |
| 500 | 서버 내부 오류 |

---

## 5. 세법 상수 (2025년 기준)

| 상수명 | 값 | 설명 |
|--------|----|------|
| TAX_RATE_LOW | 0.165 | 연봉 5,500만원 이하 세액공제율 |
| TAX_RATE_HIGH | 0.132 | 연봉 5,500만원 초과 세액공제율 |
| SALARY_THRESHOLD | 5500 | 세액공제율 구분 기준 연봉 (만원) |
| PENSION_LIMIT | 600 | 연금저축 세액공제 한도 (만원) |
| COMBINED_LIMIT | 900 | 연금저축+IRP 합산 한도 (만원) |
| ISA_GENERAL_LIMIT | 200 | ISA 일반형 비과세 한도 (만원) |
| ISA_WELFARE_LIMIT | 400 | ISA 서민형 비과세 한도 (만원) |
| ISA_WELFARE_SALARY | 3600 | 서민형 기준 연봉 (만원) |
| ISA_ANNUAL_MAX | 2000 | ISA 연 납입 한도 (만원) |
| ISA_TRANSFER_LIMIT | 300 | ISA→IRP 전환 추가 세액공제 최대 (만원) |
| FOREIGN_DEDUCTION | 250 | 해외주식 연간 기본공제 (만원) |
| FOREIGN_TAX_RATE | 0.22 | 해외주식 양도소득세율 |
| FIN_INCOME_THRESHOLD | 2000 | 금융소득 종합과세 기준 (만원) |
| FIN_INCOME_WARNING | 1500 | 금융소득 경고 시작 기준 (만원) |
| GIFT_SPOUSE | 60000 | 배우자 증여 비과세 한도 (만원) |
| GIFT_ADULT | 5000 | 성인자녀 증여 비과세 한도 (만원) |
| GIFT_MINOR | 2000 | 미성년자녀 증여 비과세 한도 (만원) |

---

## 6. 추천 상품 목록

| product 값 | category |
|------------|----------|
| 연금저축펀드 | 세액공제 |
| IRP(개인형퇴직연금) | 세액공제 |
| ISA(일반형) | 비과세·분리과세 |
| ISA(서민형) | 비과세·분리과세 |
| ISA→IRP 전환 | 세액공제 추가 |
| 해외주식 연도별 분산 매도 | 양도소득세 절세 |
| 해외주식 손익통산 및 재매수 | 양도소득세 절세 |
| 가족 증여 후 매도 | 양도소득세 절세 |
| ETF 유형별 세금 최적화 | 구조적 절세 |
| 고배당주 배당소득 분리과세 | 배당소득 분리과세 |
| 금융소득 종합과세 관리 | 종합소득 관리 |

---

*기준: 2025년 현행 세법. 세법 개정 시 `engine.py` 상단 상수만 수정하면 전체 반영됨.*
