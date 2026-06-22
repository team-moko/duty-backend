import type { Candidate, UserProfile } from '../../models';
import { FIN_INCOME_THRESHOLD, FIN_INCOME_WARNING } from '../constants';
import { isFinancialIncomeTaxable } from '../profileHelpers';
import { BaseRule, fixedScore } from './base';

/**
 * 금융소득 종합과세 관리 안내.
 * 금융소득이 1,500만원 이상이면 종합과세 위험 구간으로 진입하므로 분산 전략을 권합니다.
 * 계산 불가 항목으로 고정 점수 적용.
 */
export class FinancialIncomeManagementRule extends BaseRule {
  readonly name = '금융소득 종합과세 관리';

  isApplicable(profile: UserProfile): boolean {
    return profile.financial_income >= FIN_INCOME_WARNING;
  }

  evaluate(profile: UserProfile): Candidate {
    const status = isFinancialIncomeTaxable(profile)
      ? '초과(종합과세 대상)'
      : '경계(주의 필요)';
    const { score, expectedBenefitKrw } = fixedScore();

    return {
      rule_id: 'cap_gains',
      product: '금융소득 종합과세 관리',
      category: '종합소득 관리',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      annual_limit_krw: null,
      tax_rate_percent: null,
      short_strategy: '금융소득 종합과세 한도(2,000만원) 분산 관리',
      reason: `연 금융소득 ${profile.financial_income}만원으로 종합과세 기준 ${FIN_INCOME_THRESHOLD}만원 ${status}. 초과 시 최고 49.5% 세율 적용 가능.`,
      action:
        '분리과세 상품 비중 확대(ISA 초과분 9.9%) / 2026년부터 고배당 분리과세 적극 활용 / 가족 명의 분산 투자 / 세무사 상담 권장',
      warning: null,
    };
  }
}
