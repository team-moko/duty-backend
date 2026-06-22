import type { Candidate, UserProfile } from '../../models';
import { isFinancialIncomeTaxable } from '../profileHelpers';
import { BaseRule, fixedScore } from './base';

/**
 * ETF 유형별 세금 최적화 추천.
 * 국내주식형 / 국내상장 해외ETF / 해외상장 ETF 의 세금 구조 차이를 활용하도록 안내합니다.
 * 계산 불가 항목으로 고정 점수 500.
 */
export class EtfOptimizationRule extends BaseRule {
  readonly name = 'ETF 유형별 세금 최적화';

  isApplicable(profile: UserProfile): boolean {
    if (
      !profile.invest_types.includes('etf_foreign') &&
      !profile.invest_types.includes('etf_domestic')
    ) {
      return false;
    }
    return this.buildTips(profile).length > 0;
  }

  evaluate(profile: UserProfile): Candidate {
    const tips = this.buildTips(profile);
    const { score, expectedBenefitKrw } = fixedScore();
    return {
      rule_id: 'etf',
      product: 'ETF 유형별 세금 최적화',
      category: '구조적 절세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      annual_limit_krw: null,
      tax_rate_percent: null,
      short_strategy: 'ETF 상장 위치별 세금 구조 활용',
      reason:
        'ETF는 상장 위치(국내/해외)와 투자 대상(국내주식/해외주식)에 따라 세금 구조가 달라집니다. 국내주식형 ETF: 매매차익 비과세. 국내상장 해외ETF: 매매차익·분배금 모두 배당소득세 15.4%. 해외상장 ETF: 매매차익 양도소득세 22%.',
      action: tips.join(' / '),
      warning: null,
    };
  }

  private buildTips(profile: UserProfile): string[] {
    const tips: string[] = [];
    const finTaxable = isFinancialIncomeTaxable(profile);
    if (profile.invest_types.includes('etf_foreign') && !profile.has_isa && !finTaxable) {
      tips.push('국내상장 해외ETF → ISA로 이동 시 분배금 세율 15.4%→9.9%(한도 내 비과세)');
    }
    if (profile.invest_types.includes('etf_domestic')) {
      tips.push('국내주식형 ETF: 매매차익 비과세, 분배금만 15.4% — 일반 계좌 유지 유리');
    }
    if (profile.invest_types.includes('etf_foreign') && finTaxable) {
      tips.push(
        '금융소득종합과세자: 국내상장 해외ETF 매매차익은 배당소득 과세 → 해외 상장 ETF로 전환 시 양도소득세 22%로 오히려 유리할 수 있음'
      );
    }
    return tips;
  }
}
