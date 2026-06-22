import type {
  Candidate,
  Combo,
  ComboDetailItem,
  ComboProductChip,
  ComboResponse,
  LongTermProjection,
  RuleId,
  UserProfile,
} from '../models';
import {
  ASSUMED_RETURN_RATE,
  CATEGORY_PRIORITY,
  CATEGORY_PRIORITY_HINT,
  FIN_INCOME_THRESHOLD,
  HORIZON_YEARS,
  ISA_SEPARATE_TAX_RATE,
  ISA_YOUTH_AGE_MAX,
  LONG_TERM_NOTE,
  NORMAL_TAX_RATE,
  SALARY_THRESHOLD,
  TAX_RATE_HIGH,
  TAX_RATE_LOW,
} from './constants';
import { buildProfileSummary, evaluateAllRules } from './engine';

/**
 * 조합 카드 칩에 표시할 짧은 라벨.
 * v1 응답의 product 필드는 정식 상품명(긴 라벨)을 유지하고, v2 chip 만 별도 매핑합니다.
 */
const CHIP_LABEL: Record<RuleId, string> = {
  pension: '연금저축',
  irp: 'IRP',
  isa_general: '일반형 ISA',
  isa_welfare: '서민형 ISA',
  isa_youth: '청년형 ISA',
  isa_to_irp: 'ISA→IRP 전환',
  foreign_split: '해외주식 분산매도',
  foreign_offset: '손익통산',
  family_gift: '가족 증여',
  etf: 'ETF 최적화',
  dividend: '고배당 분리과세',
  cap_gains: '종합과세 관리',
};

interface ComboPreset {
  key: string;
  pick: (candidates: Candidate[]) => Candidate[];
  shortStrategy: (chips: ComboProductChip[]) => string;
}

const PRESETS: ComboPreset[] = [
  {
    key: 'all',
    pick: (cands) => cands,
    shortStrategy: (chips) =>
      `${chips.length}개 상품을 모두 활용해 환급 효과 극대화`,
  },
  {
    key: 'tax_credit',
    pick: (cands) =>
      cands.filter(
        (c) => c.category === '세액공제' || c.category === '세액공제 추가'
      ),
    shortStrategy: () => '세액공제로 환급액부터 챙기는 조합',
  },
  {
    key: 'tax_free',
    pick: (cands) =>
      cands.filter(
        (c) =>
          c.category === '비과세·분리과세' || c.category === '구조적 절세'
      ),
    shortStrategy: () => '비과세 한도 활용 중심의 입문 조합',
  },
  {
    key: 'capital_gains',
    pick: (cands) => cands.filter((c) => c.category === '양도소득세 절세'),
    shortStrategy: () => '해외주식 양도세 절감 전략 묶음',
  },
  {
    key: 'top_single',
    pick: (cands) => (cands.length ? [cands[0]!] : []),
    shortStrategy: (chips) => `${chips[0]!.product} 단독 — 가장 단순한 진입`,
  },
];

export function recommendCombos(profile: UserProfile): ComboResponse {
  const allCandidates = evaluateAllRules(profile);
  const profileSummary = buildProfileSummary(profile);

  if (allCandidates.length === 0) {
    return {
      combos: [],
      header: {
        max_refund_rate_percent: null,
        max_annual_refund_krw: 0,
        applicable_combo_count: 0,
      },
      profile_summary: profileSummary,
    };
  }

  const seenKeys = new Set<string>();
  const drafts: { candidates: Candidate[]; preset: ComboPreset }[] = [];
  for (const preset of PRESETS) {
    const picked = preset.pick(allCandidates);
    if (picked.length === 0) continue;
    const key = picked
      .map((c) => c.rule_id)
      .slice()
      .sort()
      .join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    drafts.push({ candidates: picked, preset });
  }

  const unrankedCombos: Omit<Combo, 'rank' | 'label'>[] = drafts.map((draft) => {
    const { preset, candidates } = draft;
    const sortedCandidates = sortByPriority(candidates);

    const chips: ComboProductChip[] = sortedCandidates.map((c) => ({
      rule_id: c.rule_id,
      product: CHIP_LABEL[c.rule_id] ?? c.product,
    }));
    const details: ComboDetailItem[] = sortedCandidates.map((c, idx) => ({
      rule_id: c.rule_id,
      product: c.product,
      category: c.category,
      priority: idx + 1,
      priority_hint: CATEGORY_PRIORITY_HINT[c.category] ?? c.short_strategy,
      expected_benefit_krw: c.expected_benefit_krw,
      recommended_contribution_krw: c.recommended_contribution_krw,
      annual_limit_krw: c.annual_limit_krw,
      tax_rate_percent: c.tax_rate_percent,
      reason: c.reason,
      action: c.action,
      warning: c.warning,
    }));
    const totalRefund = sortedCandidates.reduce(
      (acc, c) => acc + (c.expected_benefit_krw ?? 0),
      0
    );
    const totalContribution = sortedCandidates.reduce(
      (acc, c) => acc + (c.recommended_contribution_krw ?? 0),
      0
    );
    const refundRate =
      totalContribution > 0
        ? Math.round((totalRefund / totalContribution) * 1000) / 10
        : null;

    return {
      products: chips,
      refund_rate_percent: refundRate,
      expected_annual_refund_krw: totalRefund,
      recommended_contribution_krw: totalContribution,
      short_strategy: preset.shortStrategy(chips),
      justifications: buildJustifications(profile, sortedCandidates),
      long_term_projection: buildLongTermProjection(
        sortedCandidates,
        totalRefund
      ),
      details,
    };
  });

  unrankedCombos.sort(compareCombos);

  const top5 = unrankedCombos.slice(0, 5).map(
    (c, idx): Combo => ({
      rank: idx + 1,
      label: idx === 0 ? 'BEST 추천' : null,
      ...c,
    })
  );

  return {
    combos: top5,
    header: {
      max_refund_rate_percent: top5[0]?.refund_rate_percent ?? null,
      max_annual_refund_krw: top5.reduce(
        (acc, c) => Math.max(acc, c.expected_annual_refund_krw),
        0
      ),
      applicable_combo_count: unrankedCombos.length,
    },
    profile_summary: profileSummary,
  };
}

/**
 * 같은 조합 안에서 details 표시 순서를 카테고리 우선순위로 정렬.
 * 같은 카테고리 안에서는 expected_benefit 큰 순서 (예: 연금저축 > IRP).
 */
function sortByPriority(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 99;
    const pb = CATEGORY_PRIORITY[b.category] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.expected_benefit_krw ?? 0) - (a.expected_benefit_krw ?? 0);
  });
}

/**
 * "왜 이 조합이 유리한가요?" — 조합 특성 기반 3~4 bullet 자동 생성.
 * 시안의 3 bullet (세액공제율 / 청년형 ISA / 종합 효과) 패턴을 재현.
 */
function buildJustifications(
  profile: UserProfile,
  candidates: Candidate[]
): string[] {
  const bullets: string[] = [];
  const ruleIds = new Set(candidates.map((c) => c.rule_id));

  const hasTaxCredit = ruleIds.has('pension') || ruleIds.has('irp');
  if (hasTaxCredit) {
    const isLowBracket = profile.annual_salary <= SALARY_THRESHOLD;
    const ratePercent = isLowBracket ? TAX_RATE_LOW * 100 : TAX_RATE_HIGH * 100;
    const bracketLabel = isLowBracket
      ? `총급여 ${SALARY_THRESHOLD}만원 이하`
      : `총급여 ${SALARY_THRESHOLD}만원 초과`;
    bullets.push(
      `현재 연봉 구간(${bracketLabel})에서는 연금저축·IRP 세액공제율이 ${ratePercent.toFixed(1)}%로 적용돼 환급 효과가 큽니다.`
    );
  }

  if (ruleIds.has('isa_youth')) {
    bullets.push(
      `만 19~${ISA_YOUTH_AGE_MAX}세 청년형 ISA는 일반형(200만원) 대비 비과세 한도가 두 배(400만원)로 늘어나 같은 납입액에도 절세 효과가 큽니다.`
    );
  } else if (ruleIds.has('isa_welfare')) {
    bullets.push(
      '서민형 ISA는 비과세 한도 400만원으로 일반형(200만원) 대비 두 배 — 같은 납입액에도 절세 효과가 큽니다.'
    );
  } else if (ruleIds.has('isa_general')) {
    bullets.push(
      'ISA 계좌 내 손익통산으로 종목별 손실을 수익과 상계해 세금을 추가로 줄일 수 있습니다.'
    );
  }

  if (ruleIds.has('foreign_split')) {
    bullets.push(
      '해외주식 미실현 수익을 매년 250만원(기본공제) 이하로 분산 매도하면 양도세를 사실상 0원에 근접시킬 수 있습니다.'
    );
  }

  if (ruleIds.has('family_gift')) {
    bullets.push(
      '배우자·자녀 증여(10년 합산 비과세 한도 활용) 후 매도하면 취득가액이 재설정돼 양도차익 자체가 줄어듭니다.'
    );
  }

  if (
    ruleIds.has('dividend') ||
    profile.financial_income >= FIN_INCOME_THRESHOLD
  ) {
    bullets.push(
      '금융소득 종합과세(최고 49.5%) 위험 구간이라 분리과세 상품 비중을 늘리는 것이 효과적입니다.'
    );
  }

  if (bullets.length === 0) {
    bullets.push(
      '현재 프로필 기준 적용 가능한 절세 전략을 묶어 환급 효과를 높인 조합입니다.'
    );
  }

  return bullets.slice(0, 4);
}

/**
 * 10년 세후 기대수익 시뮬레이션.
 *
 * 단순 모델:
 *   - 누적 환급 = 연 환급액 × 10년 (매년 동일 추가 납입 가정)
 *   - ISA 운용수익 절세 = ISA 납입액 × 5%/년 × 평균 보유기간 × (15.4 - 9.9)%
 *   - 연금/IRP 운용수익 절세 = 납입액 × 5%/년 × 평균 보유기간 × 15.4%
 *     (인출 시 연금소득세 5.5% 별도 발생하지만 이 단순 모델에서는 무시)
 *
 * 평균 보유기간 = (1 + 2 + ... + 10) / 10 = 5.5년
 */
function buildLongTermProjection(
  candidates: Candidate[],
  totalAnnualRefundKrw: number
): LongTermProjection {
  const avgHoldingYears = (HORIZON_YEARS + 1) / 2;
  const cumulativeRefund = totalAnnualRefundKrw * HORIZON_YEARS;

  const isaContribution = candidates
    .filter((c) => c.rule_id.startsWith('isa_'))
    .reduce((acc, c) => acc + (c.recommended_contribution_krw ?? 0), 0);
  const isaCumulativeReturn =
    isaContribution * ASSUMED_RETURN_RATE * avgHoldingYears;
  const isaTaxSaving = Math.round(
    isaCumulativeReturn * (NORMAL_TAX_RATE - ISA_SEPARATE_TAX_RATE)
  );

  const pensionContribution = candidates
    .filter((c) => c.rule_id === 'pension' || c.rule_id === 'irp')
    .reduce((acc, c) => acc + (c.recommended_contribution_krw ?? 0), 0);
  const pensionCumulativeReturn =
    pensionContribution * ASSUMED_RETURN_RATE * avgHoldingYears;
  const pensionTaxSaving = Math.round(pensionCumulativeReturn * NORMAL_TAX_RATE);

  const gain = cumulativeRefund + isaTaxSaving + pensionTaxSaving;

  return {
    gain_krw: gain,
    breakdown: {
      cumulative_refund_krw: cumulativeRefund,
      isa_tax_saving_krw: isaTaxSaving,
      pension_tax_saving_krw: pensionTaxSaving,
    },
    assumptions: {
      horizon_years: HORIZON_YEARS,
      assumed_return_rate_percent: ASSUMED_RETURN_RATE * 100,
      normal_tax_rate_percent: NORMAL_TAX_RATE * 100,
      isa_separate_tax_rate_percent: ISA_SEPARATE_TAX_RATE * 100,
      note: LONG_TERM_NOTE,
    },
  };
}

function compareCombos(
  a: Omit<Combo, 'rank' | 'label'>,
  b: Omit<Combo, 'rank' | 'label'>
): number {
  const aRate = a.refund_rate_percent ?? -1;
  const bRate = b.refund_rate_percent ?? -1;
  if (aRate !== bRate) return bRate - aRate;
  if (a.expected_annual_refund_krw !== b.expected_annual_refund_krw) {
    return b.expected_annual_refund_krw - a.expected_annual_refund_krw;
  }
  return b.products.length - a.products.length;
}
