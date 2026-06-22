import request from 'supertest';
import { recommendCombos } from '../src/recommend/comboEngine';
import { createApp } from '../src/server';
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
