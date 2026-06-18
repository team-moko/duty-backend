# Claude Code 프롬프트 — 주식 절세 추천 백엔드 API

## 역할
너는 한국 금융소득 절세 추천 서비스의 **백엔드 API**를 구현하는 시니어 파이썬 개발자야.

---

## 프로젝트 개요
- 사용자가 연봉·나이·투자 현황을 입력하면 **절세 상품 Top 5**를 추천해주는 서비스
- 프론트엔드는 **React (TypeScript)** 팀 3명이 별도로 개발 중
- 백엔드는 **FastAPI (Python)** 로 구현
- 추천 로직은 ML 없이 **규칙 기반(Rule-based)** 으로 구현 (세법 조건이 명확하기 때문)

---

## 구현할 것

### 디렉토리 구조 (이대로 만들어)
```
tax-recommend-api/
├── app/
│   ├── main.py                  # FastAPI 앱, CORS 설정, 라우터 등록
│   ├── models.py                # Pydantic 입출력 스키마 전체
│   └── recommend/
│       ├── __init__.py
│       ├── engine.py            # recommend(profile) → Top 5 반환 메인 함수
│       └── rules/
│           ├── __init__.py
│           ├── base.py          # BaseRule 추상 클래스
│           ├── pension.py       # 연금저축 Rule
│           ├── irp.py           # IRP Rule
│           ├── isa.py           # ISA Rule
│           ├── foreign_stock.py # 해외주식 (분산매도 / 손익통산 / 증여)
│           ├── etf.py           # ETF 유형별 최적화 Rule
│           ├── dividend.py      # 고배당주 배당소득 분리과세 Rule
│           └── cap_gains.py     # 금융소득 종합과세 관리 Rule
├── tests/
│   ├── conftest.py              # 공통 픽스처 (대표 시나리오 12개)
│   └── test_rules.py            # 시나리오별 추천 결과 검증
├── requirements.txt
└── README.md
```

---

## 핵심 스펙

### 1. 입력 스키마 (`models.py` — `UserProfile`)
아래 필드를 **그대로** 사용해. 타입과 필드명 변경 금지 (프론트팀과 합의된 스펙).

```python
class InvestType(str, Enum):
    domestic_stock  = "domestic_stock"    # 국내 상장주식
    foreign_stock   = "foreign_stock"     # 해외주식
    etf_domestic    = "etf_domestic"      # 국내주식형 ETF
    etf_foreign     = "etf_foreign"       # 국내상장 해외지수 ETF
    fund            = "fund"              # 공모펀드
    deposit         = "deposit"           # 예·적금
    bond            = "bond"              # 채권
    reit            = "reit"              # 리츠

class IncomeType(str, Enum):
    employee   = "employee"    # 직장인
    freelancer = "freelancer"  # 프리랜서
    none       = "none"        # 무소득

class RiskTolerance(str, Enum):
    low    = "low"
    medium = "medium"
    high   = "high"

class UserProfile(BaseModel):
    age: int = Field(..., ge=19, le=80)
    annual_salary: int = Field(..., ge=0, description="연봉 (만원)")
    income_type: IncomeType
    invest_types: List[InvestType]
    monthly_invest: int = Field(..., ge=0, description="월 투자 가능 금액 (만원)")
    has_isa: bool
    has_pension: bool
    has_irp: bool
    pension_contribution: int = Field(0, ge=0, description="연금저축 연 납입액 (만원)")
    irp_contribution: int = Field(0, ge=0, description="IRP 연 납입액 (만원)")
    financial_income: int = Field(0, ge=0, description="연 금융소득 이자+배당 추정 (만원)")
    risk_tolerance: RiskTolerance
    has_spouse: bool = False
    has_children: bool = False
    has_minor_children: bool = False
    foreign_stock_unrealized_profit: int = Field(0, ge=0, description="해외주식 미실현 수익 (만원)")
    dividend_income: int = Field(0, ge=0, description="연 배당소득 (만원)")
    holds_high_dividend: bool = False
```

### 2. 출력 스키마 (`models.py` — `RecommendItem`, `RecommendResponse`)

```python
class RecommendItem(BaseModel):
    rank: int                              # 1~5
    product: str                           # 상품명
    category: str                          # 세액공제 / 비과세·분리과세 / 양도소득세 절세 등
    score: float                           # 내부 점수 (프론트에 노출 안 해도 되지만 포함)
    expected_benefit_krw: Optional[int]    # 예상 절세액 (원 단위, None이면 "계산 불가")
    reason: str                            # 추천 근거 (1~2문장)
    action: str                            # 구체적 실행 방법 (1문장)
    warning: Optional[str]                 # 주의사항 (없으면 None)

class RecommendResponse(BaseModel):
    recommendations: List[RecommendItem]   # 최대 5개
    total_applicable: int                  # 해당 항목 총 개수 (5개 초과할 수 있음)
    profile_summary: str                   # 프로필 한 줄 요약 (예: "35세 직장인 · 연봉 6,000만원")
```

### 3. API 엔드포인트 (`main.py`)

```
POST /recommend
  Body: UserProfile
  Response: RecommendResponse

GET  /health
  Response: {"status": "ok"}

GET  /mock
  Response: RecommendResponse  ← 고정 Mock 데이터 반환 (프론트 개발용)
```

- CORS: 개발 중이므로 `allow_origins=["*"]` 로 설정
- `/docs` 에서 Swagger UI 자동 제공 (FastAPI 기본)

### 4. Rule 클래스 구조 (`rules/base.py`)

```python
from abc import ABC, abstractmethod
from app.models import UserProfile, RecommendItem

class BaseRule(ABC):
    @abstractmethod
    def is_applicable(self, profile: UserProfile) -> bool:
        """이 규칙이 해당 프로필에 적용 가능한지"""
        pass

    @abstractmethod
    def evaluate(self, profile: UserProfile) -> RecommendItem:
        """점수, 설명, 실행방법 계산"""
        pass
```

### 5. 점수 계산 기준 (`engine.py`)

점수가 높을수록 먼저 추천. 아래 공식 사용:

```
score = 예상_절세금액(만원) × 긴급도_가중치

긴급도_가중치:
  - 현재 납입 0원인데 한도 있는 경우: 2.0  (당장 실행 가능)
  - 납입 중이지만 한도 남은 경우: 1.5
  - 구조적 최적화 필요한 경우: 1.0
  - 주의/관리 필요한 경우: 0.8

예상_절세금액을 계산할 수 없는 항목(손익통산 등):
  → 고정 점수 500 부여
```

---

## 세법 상수 (2025년 기준, `engine.py` 상단에 상수로 선언)

```python
TAX_RATE_LOW  = 0.165   # 연봉 5,500만원 이하 세액공제율
TAX_RATE_HIGH = 0.132   # 연봉 5,500만원 초과
PENSION_LIMIT = 600     # 연금저축 세액공제 한도 (만원)
COMBINED_LIMIT = 900    # 연금저축+IRP 합산 한도 (만원)
ISA_GENERAL_LIMIT = 200 # ISA 일반형 비과세 한도 (만원)
ISA_WELFARE_LIMIT = 400 # ISA 서민형 비과세 한도 (만원)
ISA_WELFARE_SALARY = 3600  # 서민형 기준 연봉 (만원)
FOREIGN_DEDUCTION = 250 # 해외주식 연간 기본공제 (만원)
FOREIGN_TAX_RATE  = 0.22  # 해외주식 양도소득세율
FIN_INCOME_THRESHOLD = 2000  # 금융소득 종합과세 기준 (만원)
GIFT_SPOUSE   = 60000   # 배우자 증여 비과세 한도 (만원)
GIFT_ADULT    = 5000    # 성인자녀 증여 비과세 한도 (만원)
GIFT_MINOR    = 2000    # 미성년자녀 증여 비과세 한도 (만원)
```

---

## 테스트 (`tests/test_rules.py`)

아래 시나리오들에 대해 pytest 테스트 작성.
각 시나리오의 기대 결과는 `tests/conftest.py`의 `SCENARIOS` 리스트에서 픽스처로 제공.

| 시나리오 | 핵심 검증 |
|----------|-----------|
| S001 사회초년생 직장인 | Top1 = 연금저축펀드 |
| S002 미국주식 수익 大 | 해외주식 분산매도 포함 여부 |
| S003 고소득 금융소득 경계 | 금융소득 종합과세 관리 포함 여부 |
| S006 무소득 미실현수익 大 | 가족 증여 포함 여부 |
| S007 저소득 직장인 | ISA 서민형 포함 여부 |

---

## 첨부 파일 안내

같은 폴더에 아래 파일들이 있어. 구현 시 참고해:

- `generate_dataset_v2.py` — 기존 추천 로직 전체 (Rule 로직 이 파일 기반으로 리팩토링)
- `test_scenarios_v2.json` — 12개 대표 시나리오 입출력 샘플 (테스트 픽스처로 활용)
- `SPEC.md` — 입출력 스키마 + 세법 상수 상세 명세

---

## 코드 품질 기준
- Python 3.11+
- 타입 힌트 100% 적용
- 각 Rule 클래스마다 docstring 작성
- `requirements.txt` 에 버전 고정 (`fastapi==0.111.0`, `uvicorn==0.29.0`, `pydantic==2.7.1`)
- README.md 에 로컬 실행 방법 포함 (`uvicorn app.main:app --reload`)
