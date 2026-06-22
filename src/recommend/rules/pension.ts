import type { Candidate, UserProfile } from '../../models';
import { MAN_WON_TO_KRW, PENSION_LIMIT, getTaxRate } from '../constants';
import { BaseRule, URGENCY, computeScore } from './base';

/**
 * 연금저축펀드 세액공제 추천.
 * 한도 600만원 내에서 추가 납입 시 연봉 구간별 세액공제율(13.2% / 16.5%)을 적용한
 * 예상 환급액을 산정합니다.
 */
export class PensionRule extends BaseRule {
  readonly name = '연금저축펀드';

  isApplicable(profile: UserProfile): boolean {
    if (profile.annual_salary <= 0) return false;
    if (profile.income_type !== 'employee' && profile.income_type !== 'freelancer') {
      return false;
    }
    if (profile.monthly_invest <= 0) return false;
    return PENSION_LIMIT - profile.pension_contribution > 0;
  }

  evaluate(profile: UserProfile): Candidate {
    const taxRate = getTaxRate(profile.annual_salary);
    const room = PENSION_LIMIT - profile.pension_contribution;
    const annualInv = profile.monthly_invest * 12;
    const fill = Math.min(room, annualInv);
    const benefitManWon = Math.round(fill * taxRate);
    const urgency =
      profile.pension_contribution === 0 ? URGENCY.IMMEDIATE : URGENCY.PARTIAL;
    const { score, expectedBenefitKrw } = computeScore(benefitManWon, urgency);

    return {
      rule_id: 'pension',
      product: '연금저축펀드',
      category: '세액공제',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: fill * MAN_WON_TO_KRW,
      annual_limit_krw: PENSION_LIMIT * MAN_WON_TO_KRW,
      tax_rate_percent: Math.round(taxRate * 1000) / 10,
      short_strategy: `연금저축 세액공제 ${(taxRate * 100).toFixed(1)}% 활용`,
      reason: `연봉 ${profile.annual_salary}만원 기준 세액공제율 ${(
        taxRate * 100
      ).toFixed(1)}% 적용. 현재 납입 ${profile.pension_contribution}만원, 한도 ${PENSION_LIMIT}만원까지 ${room}만원 여유. ${fill}만원 추가 납입 시 약 ${benefitManWon}만원 환급.`,
      action: `연금저축 ${fill}만원 추가 납입`,
      warning: null,
    };
  }
}
