import { recommend } from '../src/recommend/engine';
import type { RecommendItem } from '../src/models';
import { SCENARIOS, findScenario } from './scenarios';

function products(recs: RecommendItem[]): string[] {
  return recs.map((r) => r.product);
}

describe('recommend engine — invariants across all 12 scenarios', () => {
  for (const sc of SCENARIOS) {
    test(`${sc.id} produces a valid response`, () => {
      const result = recommend(sc.profile);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
      expect(result.total_applicable).toBeGreaterThanOrEqual(
        result.recommendations.length
      );

      result.recommendations.forEach((item, idx) => {
        expect(item.rank).toBe(idx + 1);
        expect(item.product).toBeTruthy();
        expect(item.category).toBeTruthy();
        expect(item.score).toBeGreaterThan(0);
        expect(item.reason.length).toBeGreaterThan(5);
        expect(item.action.length).toBeGreaterThan(2);
        if (item.expected_benefit_krw !== null) {
          expect(item.expected_benefit_krw).toBeGreaterThan(0);
        }
      });

      const scores = result.recommendations.map((r) => r.score);
      const sorted = [...scores].sort((a, b) => b - a);
      expect(scores).toEqual(sorted);

      expect(result.profile_summary).toMatch(/\d+세/);
    });
  }
});

describe('PROMPT.md required scenario assertions', () => {
  test('S001 사회초년생 직장인 — Top1 = 연금저축펀드', () => {
    const sc = findScenario('S001');
    const result = recommend(sc.profile);
    expect(result.recommendations[0]?.product).toBe('연금저축펀드');
  });

  test('S002 미국주식 수익 大 — 해외주식 분산매도 포함', () => {
    const sc = findScenario('S002');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('해외주식 연도별 분산 매도');
  });

  test('S003 고소득 금융소득 경계 — 금융소득 종합과세 관리 포함', () => {
    const sc = findScenario('S003');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('금융소득 종합과세 관리');
  });

  test('S006 무소득 미실현수익 大 — 가족 증여 포함', () => {
    const sc = findScenario('S006');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('가족 증여 후 매도');
  });

  test('S007 저소득 직장인 — ISA 서민형 포함', () => {
    const sc = findScenario('S007');
    const result = recommend(sc.profile);
    const isaItem = result.recommendations.find((r) =>
      r.product.startsWith('ISA(')
    );
    expect(isaItem?.product).toBe('ISA(서민형)');
  });
});

describe('rule-specific behavior checks', () => {
  test('S003 풀납입 직장인은 연금저축/IRP 신규 추천 없음', () => {
    const sc = findScenario('S003');
    const result = recommend(sc.profile);
    const ps = products(result.recommendations);
    expect(ps).not.toContain('연금저축펀드');
    expect(ps).not.toContain('IRP(개인형퇴직연금)');
  });

  test('S006 무소득자는 연금저축/IRP 추천 없음 (salary 0)', () => {
    const sc = findScenario('S006');
    const result = recommend(sc.profile);
    const ps = products(result.recommendations);
    expect(ps).not.toContain('연금저축펀드');
    expect(ps).not.toContain('IRP(개인형퇴직연금)');
  });

  test('S011 금융소득 종합과세자 — 고배당 분리과세 포함', () => {
    const sc = findScenario('S011');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('고배당주 배당소득 분리과세');
  });

  test('S009 큰 미실현 수익 + 배우자 — 가족 증여 포함', () => {
    const sc = findScenario('S009');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('가족 증여 후 매도');
  });

  test('S010 ETF 혼합 — ETF 유형별 세금 최적화 포함', () => {
    const sc = findScenario('S010');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('ETF 유형별 세금 최적화');
  });

  test('S012 미성년 자녀 보유 — 가족 증여 후 매도 포함', () => {
    const sc = findScenario('S012');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('가족 증여 후 매도');
  });

  test('S005 금융소득 1500-2000 경계 — 종합과세 관리 포함', () => {
    const sc = findScenario('S005');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('금융소득 종합과세 관리');
  });

  test('S008 금융소득 종합과세자(2500) — 종합과세 관리 + 고배당 분리과세 포함', () => {
    const sc = findScenario('S008');
    const result = recommend(sc.profile);
    const ps = products(result.recommendations);
    expect(ps).toContain('금융소득 종합과세 관리');
    expect(ps).toContain('고배당주 배당소득 분리과세');
  });

  test('S004 프리랜서 ISA 기보유 — ISA→IRP 전환 추천 없음 (IRP 미보유 + freelancer)', () => {
    const sc = findScenario('S004');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).not.toContain('ISA→IRP 전환');
  });

  test('S012 ISA + IRP + foreign 보유 — ISA→IRP 전환 Top 5 포함', () => {
    const sc = findScenario('S012');
    const result = recommend(sc.profile);
    expect(products(result.recommendations)).toContain('ISA→IRP 전환');
  });
});

describe('expected_benefit_krw / score wiring', () => {
  test('S001 연금저축 expected_benefit_krw 는 만원×10,000 단위', () => {
    const sc = findScenario('S001');
    const result = recommend(sc.profile);
    const pension = result.recommendations.find((r) => r.product === '연금저축펀드');
    expect(pension).toBeDefined();
    expect(pension!.expected_benefit_krw).not.toBeNull();
    expect(pension!.expected_benefit_krw! % 10000).toBe(0);
  });

  test('손익통산/증여 등 계산 불가 항목은 expected_benefit_krw = null, score = 500', () => {
    const sc = findScenario('S006');
    const result = recommend(sc.profile);
    const offset = result.recommendations.find(
      (r) => r.product === '해외주식 손익통산 및 재매수'
    );
    expect(offset).toBeDefined();
    expect(offset!.expected_benefit_krw).toBeNull();
    expect(offset!.score).toBe(500);
  });
});

describe('input validation invariants', () => {
  test('빈 invest_types 배열은 422', async () => {
    const { UserProfileSchema } = await import('../src/models');
    const baseProfile = findScenario('S001').profile;
    const result = UserProfileSchema.safeParse({
      ...baseProfile,
      invest_types: [],
    });
    expect(result.success).toBe(false);
  });

  test('21개 이상 invest_types 는 422 (DoS 방어)', async () => {
    const { UserProfileSchema } = await import('../src/models');
    const baseProfile = findScenario('S001').profile;
    const result = UserProfileSchema.safeParse({
      ...baseProfile,
      invest_types: Array(21).fill('domestic_stock'),
    });
    expect(result.success).toBe(false);
  });
});

describe('PensionRule 가드 — monthly_invest=0 에는 추천 없음', () => {
  test('연봉/연금 한도가 있어도 월 투자 0이면 연금저축 추천 안 함', () => {
    const sc = findScenario('S001');
    const result = recommend({ ...sc.profile, monthly_invest: 0 });
    expect(products(result.recommendations)).not.toContain('연금저축펀드');
  });
});
