import type {
  Candidate,
  Combo,
  ComboDetailItem,
  ComboProductChip,
  ComboResponse,
  RuleId,
  UserProfile,
} from '../models';
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

/**
 * 조합 프리셋 정의.
 * 각 프리셋이 어떤 룰 부분집합을 묶어 하나의 "절세 조합"으로 노출할지 결정합니다.
 * (단일 진실 소스 — 후보 추가/제거 시 이 배열만 수정하면 됩니다.)
 */
interface ComboPreset {
  /** 디버깅용. 응답의 label 은 정렬 후 자동 부여(BEST = rank 1) */
  key: string;
  /** 조합 후보가 만족시킬 룰 ID 집합 */
  pick: (candidates: Candidate[]) => Candidate[];
  /** 한 줄 카피 — chips 기반 동적 생성 */
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

/**
 * 사용자 프로필을 받아 조합 추천 응답을 생성합니다.
 * 절차:
 *   1) 모든 룰 평가 → 적용 가능한 Candidate 리스트
 *   2) 각 프리셋으로 부분집합 추출
 *   3) 동일 ruleIds 집합은 dedup
 *   4) refund_rate_percent desc 정렬, 상위 5개에 rank/label 부여
 *   5) 헤더 (max_refund_rate, max_annual_refund, applicable_combo_count) 산출
 */
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
    const { preset } = draft;
    const chips: ComboProductChip[] = draft.candidates.map((c) => ({
      rule_id: c.rule_id,
      product: CHIP_LABEL[c.rule_id] ?? c.product,
    }));
    const details: ComboDetailItem[] = draft.candidates.map((c) => ({
      rule_id: c.rule_id,
      product: c.product,
      category: c.category,
      expected_benefit_krw: c.expected_benefit_krw,
      recommended_contribution_krw: c.recommended_contribution_krw,
      reason: c.reason,
      action: c.action,
      warning: c.warning,
    }));
    const totalRefund = draft.candidates.reduce(
      (acc, c) => acc + (c.expected_benefit_krw ?? 0),
      0
    );
    const totalContribution = draft.candidates.reduce(
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
 * 조합 정렬 비교 함수.
 * 1순위: refund_rate_percent desc (null 은 가장 뒤로)
 * 2순위: expected_annual_refund_krw desc (절대 환급액)
 * 3순위: products.length desc (구성 상품 많을수록 먼저)
 */
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
