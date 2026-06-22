import type { Candidate, UserProfile } from '../../models';
import {
  DIVIDEND_BRACKET_HIGH,
  DIVIDEND_BRACKET_LOW,
  DIVIDEND_BRACKET_MID,
  DIVIDEND_HIGH_INCOME_AMOUNT,
  DIVIDEND_TRIGGER_AMOUNT,
} from '../constants';
import { isFinancialIncomeTaxable } from '../profileHelpers';
import { BaseRule, fixedScore } from './base';

/**
 * 고배당주 배당소득 분리과세 추천 (2026~2028년 3년 한시).
 * 종합과세 시 최고 49.5% 대비 분리과세(14~30%)로 큰 절세 효과.
 * 계산 불가 항목으로 고정 점수 적용.
 */
export class DividendSeparateTaxRule extends BaseRule {
  readonly name = '고배당주 배당소득 분리과세';

  isApplicable(profile: UserProfile): boolean {
    const hasTrigger =
      profile.holds_high_dividend || profile.dividend_income > DIVIDEND_TRIGGER_AMOUNT;
    if (!hasTrigger) return false;
    return (
      isFinancialIncomeTaxable(profile) ||
      profile.dividend_income > DIVIDEND_HIGH_INCOME_AMOUNT
    );
  }

  evaluate(profile: UserProfile): Candidate {
    const rate = this.bracket(profile.dividend_income);
    const ratePercent = this.bracketPercent(profile.dividend_income);
    const { score, expectedBenefitKrw } = fixedScore();
    return {
      rule_id: 'dividend',
      product: '고배당주 배당소득 분리과세',
      category: '배당소득 분리과세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      annual_limit_krw: null,
      tax_rate_percent: ratePercent,
      short_strategy: `고배당주 분리과세 ${rate} 활용 (종합과세 최고 49.5% 대비)`,
      reason: `연 배당소득 ${profile.dividend_income}만원. 2026~2028년 한시로 고배당 상장주 배당에 종합과세 대신 ${rate} 분리과세 적용. 종합과세(최고 49.5%) 대비 세율 대폭 절감.`,
      action:
        '배당성향 40% 이상 또는 전년 대비 배당 10% 이상 증가 상장주 중심 포트폴리오 구성 / 은행·통신 등 전통 고배당 업종 비중 확대',
      warning: 'ETF·리츠 배당은 분리과세 대상에서 제외됩니다.',
    };
  }

  private bracket(dividendIncome: number): string {
    if (dividendIncome <= DIVIDEND_BRACKET_LOW) return '14%';
    if (dividendIncome <= DIVIDEND_BRACKET_MID) return '20%';
    if (dividendIncome <= DIVIDEND_BRACKET_HIGH) return '25%';
    return '30%';
  }

  private bracketPercent(dividendIncome: number): number {
    if (dividendIncome <= DIVIDEND_BRACKET_LOW) return 14;
    if (dividendIncome <= DIVIDEND_BRACKET_MID) return 20;
    if (dividendIncome <= DIVIDEND_BRACKET_HIGH) return 25;
    return 30;
  }
}
