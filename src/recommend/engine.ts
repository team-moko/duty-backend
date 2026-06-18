import type {
  Candidate,
  RecommendItem,
  RecommendResponse,
  UserProfile,
} from '../models';
import { BaseRule } from './rules/base';
import { PensionRule } from './rules/pension';
import { IrpRule } from './rules/irp';
import { IsaRule, IsaToIrpRule } from './rules/isa';
import {
  FamilyGiftRule,
  ForeignStockOffsetRule,
  ForeignStockSplitSellRule,
} from './rules/foreignStock';
import { EtfOptimizationRule } from './rules/etf';
import { DividendSeparateTaxRule } from './rules/dividend';
import { FinancialIncomeManagementRule } from './rules/capGains';

/**
 * 룰 등록 순서는 score 동률(특히 고정 점수 500 항목들) 시 tie-break 기준이 됩니다.
 * Array.prototype.sort 는 stable 정렬이므로 등록 순서가 그대로 유지됩니다.
 * 우선순위 의도:
 *   1) 직접 절세 (연금/IRP/ISA)
 *   2) 한도 활용 양도세 절세 (해외주식 분산매도)
 *   3) 종합과세 관리 (한도 초과 위험 — fin_종합 시 가장 시급)
 *   4) 그 외 구조적 절세 항목들 (손익통산/증여/배당/ETF)
 */
const RULES: BaseRule[] = [
  new PensionRule(),
  new IrpRule(),
  new IsaRule(),
  new IsaToIrpRule(),
  new ForeignStockSplitSellRule(),
  new FinancialIncomeManagementRule(),
  new ForeignStockOffsetRule(),
  new FamilyGiftRule(),
  new DividendSeparateTaxRule(),
  new EtfOptimizationRule(),
];

export function recommend(profile: UserProfile): RecommendResponse {
  const applicable: Candidate[] = [];
  for (const rule of RULES) {
    if (rule.isApplicable(profile)) {
      applicable.push(rule.evaluate(profile));
    }
  }

  applicable.sort((a, b) => b.score - a.score);

  const top5: RecommendItem[] = applicable
    .slice(0, 5)
    .map((c, idx): RecommendItem => ({ rank: idx + 1, ...c }));

  return {
    recommendations: top5,
    total_applicable: applicable.length,
    profile_summary: buildProfileSummary(profile),
  };
}

const INCOME_LABEL: Record<UserProfile['income_type'], string> = {
  employee: '직장인',
  freelancer: '프리랜서',
  none: '무소득',
};

/** 1,234,567 → "1,234,567" (ICU 의존성 없이 로케일 독립적으로 천 단위 콤마 추가) */
function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function buildProfileSummary(profile: UserProfile): string {
  const incomeText = INCOME_LABEL[profile.income_type];
  const salaryText =
    profile.annual_salary > 0
      ? ` · 연봉 ${formatThousands(profile.annual_salary)}만원`
      : '';
  return `${profile.age}세 ${incomeText}${salaryText}`;
}
