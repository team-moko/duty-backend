import request from 'supertest';
import { recommendCombos } from '../src/recommend/comboEngine';
import { createApp } from '../src/server';
import type { UserProfile } from '../src/models';
import { SCENARIOS, findScenario } from './scenarios';

const app = createApp();

describe('combo engine invariants — all 12 scenarios', () => {
  for (const sc of SCENARIOS) {
    test(`${sc.id} produces valid ComboResponse`, () => {
      const res = recommendCombos(sc.profile);

      expect(res.combos.length).toBeGreaterThanOrEqual(0);
      expect(res.combos.length).toBeLessThanOrEqual(5);
      expect(res.header.applicable_combo_count).toBeGreaterThanOrEqual(
        res.combos.length
      );
      expect(res.profile_summary).toMatch(/\d+세/);

      res.combos.forEach((combo, idx) => {
        expect(combo.rank).toBe(idx + 1);
        expect(combo.products.length).toBeGreaterThan(0);
        expect(combo.details.length).toBe(combo.products.length);
        expect(combo.short_strategy.length).toBeGreaterThan(2);
        expect(combo.expected_annual_refund_krw).toBeGreaterThanOrEqual(0);
        expect(combo.recommended_contribution_krw).toBeGreaterThanOrEqual(0);
        if (combo.refund_rate_percent !== null) {
          expect(combo.refund_rate_percent).toBeGreaterThanOrEqual(0);
        }
      });

      // rank 1 만 BEST 라벨
      if (res.combos.length > 0) {
        expect(res.combos[0]!.label).toBe('BEST 추천');
        res.combos.slice(1).forEach((c) => expect(c.label).toBeNull());
      }

      // 정렬 검증: refund_rate desc (null 가장 뒤)
      const rates = res.combos.map((c) => c.refund_rate_percent ?? -1);
      const sortedRates = [...rates].sort((a, b) => b - a);
      expect(rates).toEqual(sortedRates);

      // 헤더 max 가 rank 1 의 값과 일치
      if (res.combos.length > 0) {
        expect(res.header.max_refund_rate_percent).toBe(
          res.combos[0]!.refund_rate_percent
        );
      }
    });
  }
});

describe('combo engine — preset behavior', () => {
  test('S001 사회초년생: 청년형 ISA 가 ISA 룰로 등장', () => {
    const sc = findScenario('S001'); // age 26
    const res = recommendCombos(sc.profile);
    const allChips = res.combos.flatMap((c) => c.products);
    const hasYouthIsa = allChips.some((p) => p.rule_id === 'isa_youth');
    expect(hasYouthIsa).toBe(true);
  });

  test('S002: 연금저축 + IRP + ISA 가 함께 묶인 BEST 조합 존재', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    const best = res.combos[0];
    expect(best).toBeDefined();
    expect(best!.label).toBe('BEST 추천');
    expect(best!.products.length).toBeGreaterThan(1);
  });

  test('S005 고소득 고배당주: 비과세/세액공제 조합 + 헤더 환급액 > 0', () => {
    const sc = findScenario('S005');
    const res = recommendCombos(sc.profile);
    expect(res.combos.length).toBeGreaterThan(0);
    expect(res.header.max_annual_refund_krw).toBeGreaterThan(0);
  });

  test('S006 무소득자: 양도세 절세 위주 조합 (연금저축 없음)', () => {
    const sc = findScenario('S006');
    const res = recommendCombos(sc.profile);
    const allRuleIds = res.combos.flatMap((c) =>
      c.products.map((p) => p.rule_id)
    );
    expect(allRuleIds).not.toContain('pension');
    expect(allRuleIds).not.toContain('irp');
  });

  test('S007 저소득 직장인 (29세): 청년형 ISA 가 ISA 룰 결과', () => {
    const sc = findScenario('S007'); // age 29
    const res = recommendCombos(sc.profile);
    const isaChip = res.combos
      .flatMap((c) => c.products)
      .find((p) => p.rule_id.startsWith('isa_'));
    expect(isaChip?.rule_id).toBe('isa_youth');
  });

  test('short_strategy 가 fallback 이 아닌 preset 정의 카피를 사용', () => {
    // " + " 만 들어간 단순 join 은 PRESETS 중 어느 것도 생성하지 않음.
    // (top_single 은 "X 단독 — 가장 단순한 진입", all 은 "N개 상품을...", 등)
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    const fallbackPattern = /^[가-힣A-Za-z0-9 +]+ \+ [가-힣A-Za-z0-9 +]+$/;
    res.combos.forEach((combo) => {
      // 의미 있는 카피인지 검증 (정의된 preset 의 카피 패턴 중 하나)
      const isPresetCopy =
        /환급 효과 극대화/.test(combo.short_strategy) ||
        /세액공제로/.test(combo.short_strategy) ||
        /비과세 한도/.test(combo.short_strategy) ||
        /양도세/.test(combo.short_strategy) ||
        /단독/.test(combo.short_strategy);
      expect(isPresetCopy).toBe(true);
      // chip 이름들의 단순 join 이 아님
      expect(fallbackPattern.test(combo.short_strategy)).toBe(false);
    });
  });

  test('refund_rate 가 None 이 아닌 조합은 절세금액 / 납입액 비율 (% 단위)', () => {
    const sc = findScenario('S001');
    const res = recommendCombos(sc.profile);
    const withRate = res.combos.filter((c) => c.refund_rate_percent !== null);
    expect(withRate.length).toBeGreaterThan(0);
    withRate.forEach((c) => {
      const expected =
        Math.round((c.expected_annual_refund_krw / c.recommended_contribution_krw) * 1000) /
        10;
      expect(c.refund_rate_percent).toBe(expected);
    });
  });
});

describe('POST /recommend/combos endpoint', () => {
  test('valid profile returns ComboResponse', async () => {
    const profile = findScenario('S001').profile;
    const res = await request(app).post('/recommend/combos').send(profile);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.combos)).toBe(true);
    expect(res.body.header).toBeDefined();
    expect(typeof res.body.profile_summary).toBe('string');
  });

  test('invalid profile returns 422 with detail', async () => {
    const res = await request(app).post('/recommend/combos').send({ age: 30 });
    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.detail)).toBe(true);
  });

  test('OpenAPI spec exposes /recommend/combos with 422/500', async () => {
    const res = await request(app).get('/openapi.json');
    const post = res.body.paths['/recommend/combos']?.post;
    expect(post).toBeDefined();
    expect(post?.responses?.['200']).toBeDefined();
    expect(post?.responses?.['422']).toBeDefined();
    expect(post?.responses?.['500']).toBeDefined();
  });

  test('OpenAPI spec exposes Combo / ComboResponse schemas', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.body.components?.schemas?.Combo).toBeDefined();
    expect(res.body.components?.schemas?.ComboResponse).toBeDefined();
    expect(res.body.components?.schemas?.ComboHeader).toBeDefined();
    expect(res.body.components?.schemas?.ComboProductChip).toBeDefined();
  });
});

describe('상세 페이지 데이터 — priority / hint / limit / tax_rate', () => {
  test('각 조합의 details 가 priority 1..N 순서로 정렬됨', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    res.combos.forEach((combo) => {
      combo.details.forEach((d, idx) => {
        expect(d.priority).toBe(idx + 1);
        expect(d.priority_hint.length).toBeGreaterThan(2);
      });
    });
  });

  test('세액공제 카테고리가 비과세보다 먼저 (시안: 연금 → IRP → ISA)', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    const best = res.combos[0]!;
    const categories = best.details.map((d) => d.category);
    const firstTaxCredit = categories.findIndex((c) => c === '세액공제');
    const firstTaxFree = categories.findIndex((c) => c === '비과세·분리과세');
    if (firstTaxCredit >= 0 && firstTaxFree >= 0) {
      expect(firstTaxCredit).toBeLessThan(firstTaxFree);
    }
  });

  test('annual_limit_krw / tax_rate_percent 는 핵심 룰에 채워짐', () => {
    const sc = findScenario('S001'); // age 26, has neither pension nor ISA
    const res = recommendCombos(sc.profile);
    const all = res.combos.flatMap((c) => c.details);
    const pension = all.find((d) => d.rule_id === 'pension');
    expect(pension?.annual_limit_krw).toBe(6_000_000);
    expect(pension?.tax_rate_percent).toBeGreaterThan(0);
    const isa = all.find((d) => d.rule_id.startsWith('isa_'));
    expect(isa?.annual_limit_krw).toBe(20_000_000);
    expect(isa?.tax_rate_percent).toBe(9.9);
  });
});

describe('Combo.justifications — 조합 단위 종합 설명', () => {
  test('1~4개 bullet 생성, 의미 있는 내용', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    res.combos.forEach((combo) => {
      expect(combo.justifications.length).toBeGreaterThan(0);
      expect(combo.justifications.length).toBeLessThanOrEqual(4);
      combo.justifications.forEach((j) =>
        expect(j.length).toBeGreaterThan(10)
      );
    });
  });

  test('S001 (저소득 + 청년) — 세액공제 16.5% 언급 + 청년형 ISA 언급', () => {
    const sc = findScenario('S001'); // age 26, salary 3600
    const res = recommendCombos(sc.profile);
    const allBullets = res.combos.flatMap((c) => c.justifications).join('\n');
    expect(allBullets).toMatch(/16\.5%/);
    expect(allBullets).toMatch(/청년형/);
  });

  test('S002 (foreign 큰 미실현 수익) — 분산매도 언급', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    const allBullets = res.combos.flatMap((c) => c.justifications).join('\n');
    expect(allBullets).toMatch(/(분산 매도|250만원)/);
  });
});

describe('Combo.long_term_projection — 10년 세후 기대수익', () => {
  test('가정값(horizon 10년 / 5% 수익률 / 15.4% 일반세율) 노출', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    res.combos.forEach((combo) => {
      const a = combo.long_term_projection.assumptions;
      expect(a.horizon_years).toBe(10);
      expect(a.assumed_return_rate_percent).toBe(5);
      expect(a.normal_tax_rate_percent).toBe(15.4);
      expect(a.isa_separate_tax_rate_percent).toBe(9.9);
      expect(a.note.length).toBeGreaterThan(10);
    });
  });

  test('gain_krw = breakdown 합산, 모두 0 이상', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    res.combos.forEach((combo) => {
      const p = combo.long_term_projection;
      const sum =
        p.breakdown.cumulative_refund_krw +
        p.breakdown.isa_tax_saving_krw +
        p.breakdown.pension_tax_saving_krw;
      expect(p.gain_krw).toBe(sum);
      expect(p.gain_krw).toBeGreaterThanOrEqual(0);
    });
  });

  test('cumulative_refund = expected_annual_refund × 10 (수학적 invariant)', () => {
    const sc = findScenario('S002');
    const res = recommendCombos(sc.profile);
    res.combos.forEach((combo) => {
      expect(combo.long_term_projection.breakdown.cumulative_refund_krw).toBe(
        combo.expected_annual_refund_krw * 10
      );
    });
  });

  test('시안 가설 검산: 연봉 4,200만 / 연납입 900만 / 환급 148만원 케이스 → 약 1,800만원', () => {
    // 시안의 BEST 조합(연금+IRP+청년형 ISA)에 가까운 단일 가상 케이스로 검증
    const synthetic: UserProfile = {
      age: 29,
      annual_salary: 4200,
      income_type: 'employee',
      invest_types: ['domestic_stock', 'etf_domestic'],
      monthly_invest: 100, // 연 1,200만원 투자
      has_isa: false,
      has_pension: false,
      has_irp: false,
      pension_contribution: 0,
      irp_contribution: 0,
      financial_income: 10,
      risk_tolerance: 'medium',
      has_spouse: false,
      has_children: false,
      has_minor_children: false,
      foreign_stock_unrealized_profit: 0,
      dividend_income: 0,
      holds_high_dividend: false,
    };
    const res = recommendCombos(synthetic);
    const best = res.combos[0]!;
    // 시안의 1,840만원 ± 30% 범위 (단순 모델이므로 정확 일치 불가)
    expect(best.long_term_projection.gain_krw).toBeGreaterThan(13_000_000);
    expect(best.long_term_projection.gain_krw).toBeLessThan(25_000_000);
  });
});

describe('CHIP_LABEL completeness', () => {
  test('모든 RuleId 에 대해 chip 라벨이 매핑되어 있음', async () => {
    const { RuleIdValues } = await import('../src/models');
    const res = await request(app).post('/recommend/combos').send(
      findScenario('S002').profile
    );
    const allChipRuleIds = new Set<string>(
      res.body.combos.flatMap((c: { products: { rule_id: string }[] }) =>
        c.products.map((p) => p.rule_id)
      )
    );
    // 응답에 나온 모든 rule_id 는 정의된 RuleId 집합의 부분집합
    allChipRuleIds.forEach((id) => {
      expect((RuleIdValues as readonly string[]).includes(id)).toBe(true);
    });
    // chip 의 product 라벨이 단순히 rule_id 그대로가 아님 (CHIP_LABEL 적용됨)
    res.body.combos.forEach((combo: { products: { rule_id: string; product: string }[] }) => {
      combo.products.forEach((p) => {
        expect(p.product).not.toBe(p.rule_id);
        expect(p.product.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('v1 API regression — /recommend still returns RecommendItem shape', () => {
  test('v1 응답에 v2 전용 필드 (rule_id 등) 가 누설되지 않음', async () => {
    const profile = findScenario('S001').profile;
    const res = await request(app).post('/recommend').send(profile);
    expect(res.status).toBe(200);
    res.body.recommendations.forEach((item: Record<string, unknown>) => {
      expect(item).not.toHaveProperty('rule_id');
      expect(item).not.toHaveProperty('recommended_contribution_krw');
      expect(item).not.toHaveProperty('short_strategy');
    });
  });
});
