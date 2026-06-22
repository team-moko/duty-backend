import type { Candidate, UserProfile } from '../../models';
import { COMBINED_LIMIT, MAN_WON_TO_KRW, getTaxRate } from '../constants';
import { annualInvestmentManWon, pensionRoomFill } from '../profileHelpers';
import { BaseRule, URGENCY, computeScore } from './base';

/**
 * IRP(개인형퇴직연금) 세액공제 추천.
 * 직장인 대상으로 연금저축+IRP 합산 900만원 한도 내에서 IRP 추가 납입을 권장합니다.
 * 동일 사용자가 연금저축도 추가 납입한다는 전제 하에, 남은 투자 가능액에서
 * pension fill 만큼 차감한 잔여로 IRP 할당량을 산정합니다.
 */
export class IrpRule extends BaseRule {
  readonly name = 'IRP(개인형퇴직연금)';

  isApplicable(profile: UserProfile): boolean {
    if (profile.income_type !== 'employee') return false;
    if (profile.annual_salary <= 0) return false;
    if (profile.monthly_invest <= 0) return false;
    return this.computeFill(profile) > 0;
  }

  evaluate(profile: UserProfile): Candidate {
    const taxRate = getTaxRate(profile.annual_salary);
    const combined = profile.pension_contribution + profile.irp_contribution;
    const fill = this.computeFill(profile);
    const benefitManWon = Math.round(fill * taxRate);
    const urgency =
      profile.irp_contribution === 0 ? URGENCY.IMMEDIATE : URGENCY.PARTIAL;
    const { score, expectedBenefitKrw } = computeScore(benefitManWon, urgency);

    return {
      rule_id: 'irp',
      product: 'IRP(개인형퇴직연금)',
      category: '세액공제',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: fill * MAN_WON_TO_KRW,
      short_strategy: `IRP 세액공제 ${(taxRate * 100).toFixed(1)}% 추가 활용`,
      reason: `연금저축+IRP 합산 한도 ${COMBINED_LIMIT}만원 중 ${combined}만원 납입 중. IRP ${fill}만원 추가 시 약 ${benefitManWon}만원 추가 환급.`,
      action: `IRP ${fill}만원 추가 납입`,
      warning: '만 55세 이전 중도인출 제한 — 여유자금만 납입',
    };
  }

  private computeFill(profile: UserProfile): number {
    const combined = profile.pension_contribution + profile.irp_contribution;
    const irpRoom = Math.max(0, COMBINED_LIMIT - combined);
    if (irpRoom <= 0) return 0;
    const annualInv = annualInvestmentManWon(profile);
    const pensionFill = pensionRoomFill(profile);
    return Math.min(irpRoom, Math.max(0, annualInv - pensionFill));
  }
}
