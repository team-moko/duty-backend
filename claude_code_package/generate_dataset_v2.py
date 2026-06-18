"""
한국 금융소득 절세 추천 모델 학습 데이터 생성기 v2
====================================================
v1 대비 추가된 항목:
  1. 해외주식 연도 분산 매도 (250만원 공제 매년 활용)
  2. 해외주식 손익통산 + 재매수 전략
  3. 가족 증여 절세 (배우자 6억 / 성인자녀 5천 / 미성년 2천, 2025~이월과세 1년 적용)
  4. 고배당주 배당소득 분리과세 (2026년~2028년 한시)
  5. ETF 유형별 세금 구조 (국내주식형 vs 국내상장해외형)
  6. 국내 비상장주식 손익통산 (국외주식과 통산 가능)

입력 피처 (신규 추가):
  - has_spouse          : 배우자 유무
  - has_children        : 자녀 유무 (미성년 포함 여부)
  - has_minor_children  : 미성년 자녀 여부
  - foreign_stock_unrealized_profit : 해외주식 미실현 수익 (만원, 0이면 없음)
  - dividend_income     : 연 배당소득 (만원)
  - holds_high_dividend : 고배당주 보유 여부
"""

import json
import random
from collections import Counter

random.seed(42)

# ─────────────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────────────

def get_tax_rate(annual_salary):
    return 0.165 if annual_salary <= 5500 else 0.132


# ─────────────────────────────────────────────────────
# 핵심 추천 엔진 (v2)
# ─────────────────────────────────────────────────────

def recommend(profile):
    recs = []
    salary      = profile["annual_salary"]
    age         = profile["age"]
    income_type = profile["income_type"]
    invest_types = profile["invest_types"]
    monthly     = profile["monthly_invest"]
    annual_inv  = monthly * 12
    has_isa     = profile["has_isa"]
    has_pension = profile["has_pension"]
    has_irp     = profile["has_irp"]
    pension_c   = profile["pension_contribution"]
    irp_c       = profile["irp_contribution"]
    fin_income  = profile["financial_income"]
    risk        = profile["risk_tolerance"]
    tax_rate    = get_tax_rate(salary)

    # 신규 피처
    has_spouse        = profile.get("has_spouse", False)
    has_children      = profile.get("has_children", False)
    has_minor_children= profile.get("has_minor_children", False)
    unrealized_profit = profile.get("foreign_stock_unrealized_profit", 0)
    dividend_income   = profile.get("dividend_income", 0)
    holds_high_div    = profile.get("holds_high_dividend", False)

    fin_종합과세 = fin_income >= 2000

    # ── 1. 연금저축 ──────────────────────────────────
    if income_type in ("employee", "freelancer") and salary > 0:
        room = 600 - pension_c
        if room > 0:
            fill = min(room, annual_inv)
            benefit = round(fill * tax_rate)
            priority = 5 if pension_c == 0 else (4 if pension_c < 300 else 3)
            recs.append({
                "product": "연금저축펀드",
                "category": "세액공제",
                "priority": priority,
                "expected_benefit_만원": benefit,
                "annual_limit_만원": 600,
                "current_contribution_만원": pension_c,
                "additional_room_만원": room,
                "tax_rate_applied": f"{tax_rate*100:.1f}%",
                "reason": (
                    f"연봉 {salary}만원 기준 세액공제율 {tax_rate*100:.1f}% 적용. "
                    f"현재 납입 {pension_c}만원, 한도 600만원까지 {room}만원 여유. "
                    f"{fill}만원 추가 납입 시 약 {benefit}만원 환급."
                ),
                "action": f"연금저축 {fill}만원 추가 납입"
            })

    # ── 2. IRP ──────────────────────────────────────
    if income_type == "employee" and salary > 0:
        combined = pension_c + irp_c
        irp_room = max(0, 900 - combined)
        if irp_room > 0:
            fill = min(irp_room, max(0, annual_inv - pension_c))
            if fill > 0:
                benefit = round(fill * tax_rate)
                priority = 4 if irp_c == 0 else 3
                recs.append({
                    "product": "IRP(개인형퇴직연금)",
                    "category": "세액공제",
                    "priority": priority,
                    "expected_benefit_만원": benefit,
                    "annual_combined_limit_만원": 900,
                    "current_combined_만원": combined,
                    "additional_room_만원": irp_room,
                    "tax_rate_applied": f"{tax_rate*100:.1f}%",
                    "reason": (
                        f"연금저축+IRP 합산 한도 900만원 중 {combined}만원 납입 중. "
                        f"IRP {fill}만원 추가 시 약 {benefit}만원 추가 환급."
                    ),
                    "action": f"IRP {fill}만원 추가 납입",
                    "warning": "만 55세 이전 중도인출 제한 — 여유자금만 납입"
                })

    # ── 3. ISA ──────────────────────────────────────
    if not fin_종합과세 and age >= 19:
        isa_비과세 = 400 if salary <= 3600 else 200
        isa_type  = "서민형" if salary <= 3600 else "일반형"

        if not has_isa:
            fill = min(2000, annual_inv)
            est_profit = fill * 0.05
            benefit = round(min(est_profit, isa_비과세) * 0.154)
            priority = 5 if ("etf_foreign" in invest_types or "fund" in invest_types) else 4
            recs.append({
                "product": f"ISA({isa_type})",
                "category": "비과세·분리과세",
                "priority": priority,
                "expected_benefit_만원": benefit,
                "annual_limit_만원": 2000,
                "tax_free_limit_만원": isa_비과세,
                "excess_tax_rate": "9.9%",
                "normal_tax_rate": "15.4%",
                "reason": (
                    f"{isa_type} ISA 미보유. 연 수익 {isa_비과세}만원까지 비과세, "
                    f"초과분 9.9%(일반 15.4% 대비 절세). "
                    f"계좌 내 손익통산으로 세금 추가 절감."
                ),
                "action": f"ISA({isa_type}) 개설 후 연 최대 {fill}만원 납입",
                "note": "해외주식 직접 투자 불가 / 국내 상장 해외ETF는 가능 / 3년 의무 유지"
            })
        else:
            if has_irp or income_type == "employee":
                recs.append({
                    "product": "ISA→IRP 전환",
                    "category": "세액공제 추가",
                    "priority": 3,
                    "expected_benefit_만원": 30,
                    "transfer_limit_만원": 300,
                    "additional_tax_credit_rate": "10%",
                    "reason": "ISA 만기금 IRP 이전 시 이전액의 10%(최대 300만원) 추가 세액공제.",
                    "action": "ISA 만기 시 IRP로 이전"
                })

    # ── 4. 해외주식 — 연도 분산 매도 (신규) ──────────
    if "foreign_stock" in invest_types and unrealized_profit > 250:
        # 250만원씩 분할하면 몇 년 걸리는지
        years = -(-unrealized_profit // 250)  # ceil
        total_tax_if_now = round(max(0, unrealized_profit - 250) * 0.22)
        total_tax_if_split = round(max(0, 250 - 250) * 0.22) * years  # 0
        saving = total_tax_if_now
        recs.append({
            "product": "해외주식 연도별 분산 매도",
            "category": "양도소득세 절세",
            "priority": 5 if unrealized_profit > 1000 else 4,
            "expected_benefit_만원": saving,
            "basic_deduction_만원": 250,
            "unrealized_profit_만원": unrealized_profit,
            "recommended_years": int(years),
            "tax_rate": "22%",
            "reason": (
                f"미실현 수익 {unrealized_profit}만원. 한 번에 매도 시 양도세 약 {total_tax_if_now}만원. "
                f"매년 250만원씩 {int(years)}년에 걸쳐 매도하면 양도세 0원 가능."
            ),
            "action": f"연간 매도 수익을 250만원 이하로 분산 (약 {int(years)}년 계획)"
        })

    # ── 5. 해외주식 — 손익통산 + 재매수 (신규) ────────
    if "foreign_stock" in invest_types:
        recs.append({
            "product": "해외주식 손익통산 및 재매수",
            "category": "양도소득세 절세",
            "priority": 4,
            "expected_benefit_만원": None,
            "basic_deduction_만원": 250,
            "tax_rate": "22%",
            "reason": (
                "수익 종목 매도 시 손실 종목을 함께 매도해 과세표준 축소 가능. "
                "손실 종목은 즉시 재매수하여 보유 지속 가능 (세법상 문제 없음). "
                "국내 비상장주식 손실도 해외주식 수익과 통산 가능."
            ),
            "action": (
                "12월 말 전 수익·손실 종목 동시 매도로 수익 250만원 이하 조정 / "
                "손실 종목 재매수하여 포지션 유지"
            ),
            "warning": "결제일 기준 과세 — 12월 29일(거래일) 이전 매도 완료 필요"
        })

    # ── 6. 가족 증여 절세 (신규) ──────────────────────
    if "foreign_stock" in invest_types and unrealized_profit > 500 and (has_spouse or has_children):
        gift_targets = []
        if has_spouse:
            gift_targets.append({"관계": "배우자", "공제한도_만원": 60000, "10년_합산": True})
        if has_children:
            limit = 2000 if has_minor_children else 5000
            gift_targets.append({"관계": "자녀(미성년)" if has_minor_children else "자녀(성인)", "공제한도_만원": limit, "10년_합산": True})

        recs.append({
            "product": "가족 증여 후 매도",
            "category": "양도소득세 절세",
            "priority": 4 if unrealized_profit > 2000 else 3,
            "expected_benefit_만원": None,
            "gift_targets": gift_targets,
            "reason": (
                f"미실현 수익 {unrealized_profit}만원 보유 주식을 가족에게 증여 후 매도 시 "
                f"증여 시점 시가가 취득가액으로 재설정되어 양도세 절감 가능. "
                f"배우자 6억원, 성인자녀 5,000만원, 미성년자녀 2,000만원 10년 합산 비과세."
            ),
            "action": "증여 후 반드시 1년 이상 보유 후 매도 (2025년~이월과세 규정 적용)",
            "warning": (
                "2025년부터 증여 후 1년 이내 매도 시 이월과세 적용 — 절세 효과 소멸. "
                "매도 대금이 증여자에게 반환되면 부당행위계산 부인 적용. "
                "10년 합산 한도 초과 시 초과분 증여세 발생."
            )
        })

    # ── 7. 고배당주 배당소득 분리과세 (신규, 2026~2028) ──
    if holds_high_div or dividend_income > 200:
        if fin_종합과세 or dividend_income > 500:
            # 분리과세 세율표
            구간 = None
            if dividend_income <= 2000:
                구간 = "14%"
            elif dividend_income <= 30000:
                구간 = "20%"
            elif dividend_income <= 500000:
                구간 = "25%"
            else:
                구간 = "30%"

            recs.append({
                "product": "고배당주 배당소득 분리과세",
                "category": "배당소득 분리과세",
                "priority": 4 if fin_종합과세 else 3,
                "expected_benefit_만원": None,
                "applicable_period": "2026년~2028년 3년 한시",
                "separate_tax_rate": 구간,
                "normal_max_rate": "최고 49.5%(종합과세 시)",
                "eligible_companies": "배당성향 40% 이상 또는 배당성향 25%이상+전년比 배당 10%↑ 기업",
                "excluded": "ETF·리츠 배당은 분리과세 대상 제외",
                "reason": (
                    f"연 배당소득 {dividend_income}만원. 2026~2028년 한시로 고배당 상장주 배당에 "
                    f"종합과세 대신 {구간} 분리과세 적용. 종합과세(최고 49.5%) 대비 세율 대폭 절감."
                ),
                "action": (
                    "배당성향 40% 이상 또는 전년 대비 배당 10% 이상 증가 상장주 중심 포트폴리오 구성 / "
                    "은행·통신 등 전통 고배당 업종 비중 확대"
                )
            })

    # ── 8. ETF 유형별 세금 최적화 (신규) ────────────
    if "etf_foreign" in invest_types or "etf_domestic" in invest_types:
        etf_tips = []
        if "etf_foreign" in invest_types and not has_isa and not fin_종합과세:
            etf_tips.append("국내상장 해외ETF → ISA로 이동 시 분배금 세율 15.4%→9.9%(한도 내 비과세)")
        if "etf_domestic" in invest_types:
            etf_tips.append("국내주식형 ETF: 매매차익 비과세, 분배금만 15.4% — 일반 계좌 유지 유리")
        if "etf_foreign" in invest_types and fin_종합과세:
            etf_tips.append("금융소득종합과세자: 국내상장 해외ETF 매매차익은 배당소득 과세 → 해외 상장 ETF로 전환 시 양도소득세 22%로 오히려 유리할 수 있음")

        if etf_tips:
            recs.append({
                "product": "ETF 유형별 세금 최적화",
                "category": "구조적 절세",
                "priority": 3,
                "expected_benefit_만원": None,
                "tips": etf_tips,
                "reason": (
                    "ETF는 상장 위치(국내/해외)와 투자 대상(국내주식/해외주식)에 따라 세금 구조가 달라짐. "
                    "국내주식형 ETF: 매매차익 비과세. "
                    "국내상장 해외ETF: 매매차익·분배금 모두 배당소득세 15.4%. "
                    "해외상장 ETF: 매매차익 양도소득세 22%."
                ),
                "action": " / ".join(etf_tips) if etf_tips else "현행 유지"
            })

    # ── 9. 금융소득 종합과세 관리 ──────────────────
    if fin_income >= 1500:
        status = "초과(종합과세 대상)" if fin_종합과세 else "경계(주의 필요)"
        recs.append({
            "product": "금융소득 종합과세 관리",
            "category": "종합소득 관리",
            "priority": 5 if fin_종합과세 else 4,
            "expected_benefit_만원": None,
            "current_financial_income_만원": fin_income,
            "threshold_만원": 2000,
            "status": status,
            "reason": (
                f"연 금융소득 {fin_income}만원으로 종합과세 기준 2,000만원 {status}. "
                f"초과 시 최고 49.5% 세율 적용 가능."
            ),
            "action": (
                "분리과세 상품 비중 확대(ISA 초과분 9.9%) / "
                "2026년부터 고배당 분리과세 적극 활용 / "
                "가족 명의 분산 투자 / 세무사 상담 권장"
            )
        })

    # 우선순위 정렬
    recs.sort(key=lambda x: -x["priority"])
    return recs


# ─────────────────────────────────────────────────────
# 샘플 프로필 생성기 (v2)
# ─────────────────────────────────────────────────────

INVEST_POOL = [
    "domestic_stock", "foreign_stock",
    "etf_domestic", "etf_foreign",
    "fund", "deposit", "bond", "reit"
]

def random_profile(seed_val):
    rng = random.Random(seed_val)
    age = rng.randint(22, 65)
    income_type = rng.choices(
        ["employee", "freelancer", "none"], weights=[0.65, 0.25, 0.10]
    )[0]

    if income_type == "employee":
        salary = rng.choice([3000,3600,4000,4500,5000,5500,6000,7000,8000,10000,12000,15000])
    elif income_type == "freelancer":
        salary = rng.choice([2400,3000,4000,5000,6000,8000])
    else:
        salary = 0

    invest_types = rng.sample(INVEST_POOL, rng.randint(1, 4))
    monthly = rng.choice([10,20,30,50,70,100,150,200])

    has_pension = rng.random() < 0.55
    has_irp     = rng.random() < 0.35 if income_type == "employee" else False
    has_isa     = rng.random() < 0.40

    pension_c = rng.choice([0,100,200,300,400,600]) if has_pension else 0
    irp_c     = rng.choice([0,100,200,300]) if has_irp else 0

    base_fin = monthly * rng.uniform(0.02, 0.10) * 12
    fin_income = round(base_fin)
    if rng.random() < 0.05:
        fin_income = rng.choice([1500,1800,2000,2500,3000])

    # 신규 피처
    has_spouse         = rng.random() < 0.55 if age >= 25 else False
    has_children       = rng.random() < 0.45 if age >= 28 else False
    has_minor_children = has_children and rng.random() < 0.50 and age < 50

    # 미실현 수익: 해외주식 보유자에게만
    if "foreign_stock" in invest_types:
        unrealized = rng.choice([0, 0, 0, 100, 250, 500, 800, 1500, 3000])
    else:
        unrealized = 0

    dividend_income  = round(rng.uniform(0, fin_income * 0.8)) if fin_income > 0 else 0
    holds_high_div   = rng.random() < 0.25 if ("domestic_stock" in invest_types or "reit" in invest_types) else False

    return {
        "age": age,
        "annual_salary": salary,
        "income_type": income_type,
        "invest_types": invest_types,
        "monthly_invest": monthly,
        "has_isa": has_isa,
        "has_pension": has_pension,
        "has_irp": has_irp,
        "pension_contribution": pension_c,
        "irp_contribution": irp_c,
        "financial_income": fin_income,
        "risk_tolerance": rng.choice(["low","medium","high"]),
        # v2 신규
        "has_spouse": has_spouse,
        "has_children": has_children,
        "has_minor_children": has_minor_children,
        "foreign_stock_unrealized_profit": unrealized,
        "dividend_income": dividend_income,
        "holds_high_dividend": holds_high_div
    }


# ─────────────────────────────────────────────────────
# 대표 시나리오 v2
# ─────────────────────────────────────────────────────

SCENARIOS = [
    {
        "scenario_id": "S001",
        "description": "사회초년생 직장인 — 연금저축·ISA 미보유",
        "profile": {
            "age": 26, "annual_salary": 3600, "income_type": "employee",
            "invest_types": ["domestic_stock","etf_domestic"],
            "monthly_invest": 30, "has_isa": False, "has_pension": False,
            "has_irp": False, "pension_contribution": 0, "irp_contribution": 0,
            "financial_income": 10, "risk_tolerance": "medium",
            "has_spouse": False, "has_children": False, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 0, "dividend_income": 5,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S002",
        "description": "중간 소득 직장인 — 연금저축 부분납입 + 미국주식 수익 大",
        "profile": {
            "age": 35, "annual_salary": 6000, "income_type": "employee",
            "invest_types": ["foreign_stock","etf_foreign","domestic_stock"],
            "monthly_invest": 100, "has_isa": False, "has_pension": True,
            "has_irp": False, "pension_contribution": 300, "irp_contribution": 0,
            "financial_income": 80, "risk_tolerance": "high",
            "has_spouse": True, "has_children": True, "has_minor_children": True,
            "foreign_stock_unrealized_profit": 1500, "dividend_income": 30,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S003",
        "description": "고소득 직장인 — 연금저축+IRP 풀납입, 금융소득 종합과세 접근",
        "profile": {
            "age": 45, "annual_salary": 12000, "income_type": "employee",
            "invest_types": ["foreign_stock","fund","bond","reit"],
            "monthly_invest": 200, "has_isa": True, "has_pension": True,
            "has_irp": True, "pension_contribution": 600, "irp_contribution": 300,
            "financial_income": 1800, "risk_tolerance": "medium",
            "has_spouse": True, "has_children": True, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 3000, "dividend_income": 800,
            "holds_high_dividend": True
        }
    },
    {
        "scenario_id": "S004",
        "description": "프리랜서 — ISA만 보유, 해외주식 중간 수익",
        "profile": {
            "age": 32, "annual_salary": 5000, "income_type": "freelancer",
            "invest_types": ["domestic_stock","foreign_stock","fund"],
            "monthly_invest": 50, "has_isa": True, "has_pension": False,
            "has_irp": False, "pension_contribution": 0, "irp_contribution": 0,
            "financial_income": 30, "risk_tolerance": "medium",
            "has_spouse": False, "has_children": False, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 500, "dividend_income": 15,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S005",
        "description": "50대 직장인 — 금융소득 종합과세 경계, 고배당주 보유",
        "profile": {
            "age": 53, "annual_salary": 10000, "income_type": "employee",
            "invest_types": ["bond","reit","deposit","etf_foreign","domestic_stock"],
            "monthly_invest": 150, "has_isa": False, "has_pension": True,
            "has_irp": True, "pension_contribution": 600, "irp_contribution": 300,
            "financial_income": 1900, "risk_tolerance": "low",
            "has_spouse": True, "has_children": True, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 800, "dividend_income": 1200,
            "holds_high_dividend": True
        }
    },
    {
        "scenario_id": "S006",
        "description": "무소득 전업주부 — 해외주식 미실현 수익 큰 상태",
        "profile": {
            "age": 38, "annual_salary": 0, "income_type": "none",
            "invest_types": ["foreign_stock","etf_foreign"],
            "monthly_invest": 50, "has_isa": False, "has_pension": False,
            "has_irp": False, "pension_contribution": 0, "irp_contribution": 0,
            "financial_income": 50, "risk_tolerance": "high",
            "has_spouse": True, "has_children": True, "has_minor_children": True,
            "foreign_stock_unrealized_profit": 2000, "dividend_income": 20,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S007",
        "description": "서민형 ISA 대상 저소득 직장인",
        "profile": {
            "age": 29, "annual_salary": 3000, "income_type": "employee",
            "invest_types": ["deposit","domestic_stock"],
            "monthly_invest": 20, "has_isa": False, "has_pension": False,
            "has_irp": False, "pension_contribution": 0, "irp_contribution": 0,
            "financial_income": 5, "risk_tolerance": "low",
            "has_spouse": False, "has_children": False, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 0, "dividend_income": 2,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S008",
        "description": "고소득 프리랜서 — 금융소득 종합과세자, 고배당 포트폴리오",
        "profile": {
            "age": 44, "annual_salary": 8000, "income_type": "freelancer",
            "invest_types": ["foreign_stock","reit","bond","etf_domestic"],
            "monthly_invest": 150, "has_isa": False, "has_pension": True,
            "has_irp": False, "pension_contribution": 400, "irp_contribution": 0,
            "financial_income": 2500, "risk_tolerance": "medium",
            "has_spouse": True, "has_children": True, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 1200, "dividend_income": 1800,
            "holds_high_dividend": True
        }
    },
    # ── v2 신규 시나리오 ──────────────────────────────
    {
        "scenario_id": "S009",
        "description": "30대 맞벌이 — 미국주식 수익 크고 배우자 증여 고려",
        "profile": {
            "age": 37, "annual_salary": 7000, "income_type": "employee",
            "invest_types": ["foreign_stock","etf_foreign"],
            "monthly_invest": 120, "has_isa": False, "has_pension": True,
            "has_irp": True, "pension_contribution": 600, "irp_contribution": 300,
            "financial_income": 120, "risk_tolerance": "high",
            "has_spouse": True, "has_children": False, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 4000, "dividend_income": 50,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S010",
        "description": "40대 — ETF 혼합 보유(국내주식형+국내상장해외형), 세금 구조 최적화 필요",
        "profile": {
            "age": 42, "annual_salary": 8000, "income_type": "employee",
            "invest_types": ["etf_domestic","etf_foreign","fund"],
            "monthly_invest": 80, "has_isa": False, "has_pension": True,
            "has_irp": False, "pension_contribution": 400, "irp_contribution": 0,
            "financial_income": 200, "risk_tolerance": "medium",
            "has_spouse": True, "has_children": True, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 0, "dividend_income": 100,
            "holds_high_dividend": False
        }
    },
    {
        "scenario_id": "S011",
        "description": "금융소득 종합과세자 — 고배당 분리과세 최대 활용",
        "profile": {
            "age": 55, "annual_salary": 15000, "income_type": "employee",
            "invest_types": ["domestic_stock","reit","bond"],
            "monthly_invest": 300, "has_isa": True, "has_pension": True,
            "has_irp": True, "pension_contribution": 600, "irp_contribution": 300,
            "financial_income": 3500, "risk_tolerance": "low",
            "has_spouse": True, "has_children": True, "has_minor_children": False,
            "foreign_stock_unrealized_profit": 0, "dividend_income": 2800,
            "holds_high_dividend": True
        }
    },
    {
        "scenario_id": "S012",
        "description": "20대 미성년 자녀 보유 — 자녀 주식 증여 절세 계획",
        "profile": {
            "age": 40, "annual_salary": 9000, "income_type": "employee",
            "invest_types": ["foreign_stock","domestic_stock"],
            "monthly_invest": 100, "has_isa": True, "has_pension": True,
            "has_irp": True, "pension_contribution": 600, "irp_contribution": 300,
            "financial_income": 150, "risk_tolerance": "medium",
            "has_spouse": True, "has_children": True, "has_minor_children": True,
            "foreign_stock_unrealized_profit": 2500, "dividend_income": 80,
            "holds_high_dividend": False
        }
    }
]


# ─────────────────────────────────────────────────────
# 데이터셋 생성
# ─────────────────────────────────────────────────────

def build_dataset():
    dataset = []

    # 대표 시나리오
    for sc in SCENARIOS:
        recs = recommend(sc["profile"])
        dataset.append({
            "id": sc["scenario_id"],
            "type": "representative",
            "description": sc["description"],
            "input": sc["profile"],
            "output": {
                "recommendations": recs,
                "total_products_recommended": len(recs),
                "top_priority_product": recs[0]["product"] if recs else None,
                "categories": list(dict.fromkeys(r["category"] for r in recs))
            }
        })

    # 합성 데이터 1,000개
    for i in range(1000):
        profile = random_profile(i)
        recs = recommend(profile)
        dataset.append({
            "id": f"R{i+1:04d}",
            "type": "synthetic",
            "description": None,
            "input": profile,
            "output": {
                "recommendations": recs,
                "total_products_recommended": len(recs),
                "top_priority_product": recs[0]["product"] if recs else None,
                "categories": list(dict.fromkeys(r["category"] for r in recs))
            }
        })

    return dataset


if __name__ == "__main__":
    dataset = build_dataset()

    with open("/home/claude/tax_dataset/train_data_v2.jsonl","w",encoding="utf-8") as f:
        for r in dataset:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    with open("/home/claude/tax_dataset/train_data_v2_full.json","w",encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    test = [d for d in dataset if d["type"] == "representative"]
    with open("/home/claude/tax_dataset/test_scenarios_v2.json","w",encoding="utf-8") as f:
        json.dump(test, f, ensure_ascii=False, indent=2)

    print(f"✅ 총 {len(dataset)}개 레코드 생성")
    print(f"   - 대표 시나리오: {len(test)}개")
    print(f"   - 합성 데이터: {len(dataset)-len(test)}개")

    all_products = [r["product"] for d in dataset for r in d["output"]["recommendations"]]
    all_cats     = [r["category"] for d in dataset for r in d["output"]["recommendations"]]

    print("\n📊 상품별 추천 빈도:")
    for p, c in Counter(all_products).most_common():
        print(f"   {p}: {c}회")

    print("\n📂 카테고리별 빈도:")
    for cat, c in Counter(all_cats).most_common():
        print(f"   {cat}: {c}회")
