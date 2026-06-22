import type { Candidate, UserProfile } from '../../models';
import {
  FOREIGN_DEDUCTION,
  FOREIGN_TAX_RATE,
  GIFT_ADULT,
  GIFT_MIN_UNREALIZED,
  GIFT_MINOR,
  GIFT_SPOUSE,
} from '../constants';
import { BaseRule, URGENCY, computeScore, fixedScore } from './base';

/**
 * 해외주식 연도별 분산 매도.
 * 미실현 수익을 매년 기본공제(250만원) 이하로 나누어 매도하면 양도세를 0으로 줄일 수 있습니다.
 */
export class ForeignStockSplitSellRule extends BaseRule {
  readonly name = '해외주식 연도별 분산 매도';

  isApplicable(profile: UserProfile): boolean {
    if (!profile.invest_types.includes('foreign_stock')) return false;
    return profile.foreign_stock_unrealized_profit > FOREIGN_DEDUCTION;
  }

  evaluate(profile: UserProfile): Candidate {
    const unrealized = profile.foreign_stock_unrealized_profit;
    const years = Math.ceil(unrealized / FOREIGN_DEDUCTION);
    const taxIfNowManWon = Math.round(
      Math.max(0, unrealized - FOREIGN_DEDUCTION) * FOREIGN_TAX_RATE
    );
    const benefitManWon = taxIfNowManWon;
    const urgency =
      unrealized > 1000 ? URGENCY.IMMEDIATE : URGENCY.PARTIAL;
    const { score, expectedBenefitKrw } = computeScore(benefitManWon, urgency);

    return {
      rule_id: 'foreign_split',
      product: '해외주식 연도별 분산 매도',
      category: '양도소득세 절세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      short_strategy: '해외주식 연 250만원 이하 분산 매도로 양도세 절감',
      reason: `미실현 수익 ${unrealized}만원. 한 번에 매도 시 양도세 약 ${taxIfNowManWon}만원. 매년 ${FOREIGN_DEDUCTION}만원씩 ${years}년에 걸쳐 매도하면 양도세 0원 가능.`,
      action: `연간 매도 수익을 ${FOREIGN_DEDUCTION}만원 이하로 분산 (약 ${years}년 계획)`,
      warning: '12월 29일(거래일) 이전 매도 완료 필요 (결제일 기준 과세)',
    };
  }
}

/**
 * 해외주식 손익통산 + 손실 종목 재매수 전략.
 * 계산 불가 항목으로 고정 점수 500.
 */
export class ForeignStockOffsetRule extends BaseRule {
  readonly name = '해외주식 손익통산 및 재매수';

  isApplicable(profile: UserProfile): boolean {
    return profile.invest_types.includes('foreign_stock');
  }

  evaluate(_profile: UserProfile): Candidate {
    const { score, expectedBenefitKrw } = fixedScore();
    return {
      rule_id: 'foreign_offset',
      product: '해외주식 손익통산 및 재매수',
      category: '양도소득세 절세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      short_strategy: '손실 종목 매도 → 즉시 재매수로 과세표준 축소',
      reason:
        '수익 종목 매도 시 손실 종목을 함께 매도해 과세표준 축소 가능. 손실 종목은 즉시 재매수하여 보유 지속 가능 (세법상 문제 없음). 국내 비상장주식 손실도 해외주식 수익과 통산 가능.',
      action:
        '12월 말 전 수익·손실 종목 동시 매도로 수익 250만원 이하 조정 / 손실 종목 재매수하여 포지션 유지',
      warning: '결제일 기준 과세 — 12월 29일(거래일) 이전 매도 완료 필요',
    };
  }
}

/**
 * 가족 증여 후 매도 전략 (배우자/자녀 증여 후 1년 이상 보유 후 매도).
 * 계산 불가 항목으로 고정 점수 500.
 */
export class FamilyGiftRule extends BaseRule {
  readonly name = '가족 증여 후 매도';

  isApplicable(profile: UserProfile): boolean {
    if (!profile.invest_types.includes('foreign_stock')) return false;
    if (profile.foreign_stock_unrealized_profit <= GIFT_MIN_UNREALIZED) return false;
    return profile.has_spouse || profile.has_children;
  }

  evaluate(profile: UserProfile): Candidate {
    const targets: string[] = [];
    if (profile.has_spouse) targets.push(`배우자 ${GIFT_SPOUSE}만원`);
    if (profile.has_children) {
      if (profile.has_minor_children) targets.push(`미성년자녀 ${GIFT_MINOR}만원`);
      else targets.push(`성인자녀 ${GIFT_ADULT}만원`);
    }
    const { score, expectedBenefitKrw } = fixedScore();
    return {
      rule_id: 'family_gift',
      product: '가족 증여 후 매도',
      category: '양도소득세 절세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: null,
      short_strategy: '가족 증여로 취득가액 재설정 후 양도세 절감',
      reason: `미실현 수익 ${profile.foreign_stock_unrealized_profit}만원 보유 주식을 가족(${targets.join(
        ', '
      )})에게 증여 후 매도 시 증여 시점 시가가 취득가액으로 재설정되어 양도세 절감 가능. 10년 합산 비과세 한도 내에서 가능.`,
      action: '증여 후 반드시 1년 이상 보유 후 매도 (2025년~ 이월과세 규정 적용)',
      warning:
        '2025년부터 증여 후 1년 이내 매도 시 이월과세 적용 — 절세 효과 소멸. 매도 대금이 증여자에게 반환되면 부당행위계산 부인 적용. 10년 합산 한도 초과 시 초과분 증여세 발생.',
    };
  }
}
