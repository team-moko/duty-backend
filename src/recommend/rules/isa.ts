import type { Candidate, RuleId, UserProfile } from '../../models';
import {
  ISA_ANNUAL_MAX,
  ISA_EXCESS_TAX_RATE,
  ISA_EXPECTED_RETURN_RATE,
  ISA_GENERAL_LIMIT,
  ISA_NORMAL_TAX_RATE,
  ISA_TRANSFER_CREDIT_RATE,
  ISA_TRANSFER_LIMIT,
  ISA_WELFARE_LIMIT,
  ISA_WELFARE_SALARY,
  ISA_YOUTH_AGE_MAX,
  ISA_YOUTH_LIMIT,
  MAN_WON_TO_KRW,
} from '../constants';
import { isFinancialIncomeTaxable } from '../profileHelpers';
import { BaseRule, URGENCY, computeScore } from './base';

interface IsaVariant {
  ruleId: RuleId;
  productLabel: string;
  shortLabel: string;
  taxFreeLimit: number;
}

/**
 * 프로필 기준 가입 가능한 ISA 유형 1개를 선택합니다.
 * 우선순위: 청년형(만 19~34세) > 서민형(연봉 3,600 이하) > 일반형
 * (실제 세법상 한 명이 동시에 여러 유형 가입 불가하므로 mutually exclusive.)
 */
function pickIsaVariant(profile: UserProfile): IsaVariant {
  if (profile.age >= 19 && profile.age <= ISA_YOUTH_AGE_MAX) {
    return {
      ruleId: 'isa_youth',
      productLabel: '청년형 ISA',
      shortLabel: '청년형',
      taxFreeLimit: ISA_YOUTH_LIMIT,
    };
  }
  if (profile.annual_salary <= ISA_WELFARE_SALARY) {
    return {
      ruleId: 'isa_welfare',
      productLabel: 'ISA(서민형)',
      shortLabel: '서민형',
      taxFreeLimit: ISA_WELFARE_LIMIT,
    };
  }
  return {
    ruleId: 'isa_general',
    productLabel: 'ISA(일반형)',
    shortLabel: '일반형',
    taxFreeLimit: ISA_GENERAL_LIMIT,
  };
}

/**
 * ISA 신규 개설 추천.
 * 금융소득종합과세 비대상이고 ISA 미보유 시 청년형/서민형/일반형 중 1개를 추천합니다.
 */
export class IsaRule extends BaseRule {
  readonly name = 'ISA';

  isApplicable(profile: UserProfile): boolean {
    if (isFinancialIncomeTaxable(profile)) return false;
    if (profile.age < 19) return false;
    return !profile.has_isa;
  }

  evaluate(profile: UserProfile): Candidate {
    const variant = pickIsaVariant(profile);
    const annualInv = profile.monthly_invest * 12;
    const fill = Math.min(ISA_ANNUAL_MAX, annualInv);
    const estProfit = fill * ISA_EXPECTED_RETURN_RATE;
    const benefitManWon = Math.round(
      Math.min(estProfit, variant.taxFreeLimit) * ISA_NORMAL_TAX_RATE
    );
    const { score, expectedBenefitKrw } = computeScore(
      benefitManWon,
      URGENCY.IMMEDIATE
    );

    return {
      rule_id: variant.ruleId,
      product: variant.productLabel,
      category: '비과세·분리과세',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: fill * MAN_WON_TO_KRW,
      short_strategy: `ISA ${variant.shortLabel} 비과세 한도(${variant.taxFreeLimit}만원) 활용`,
      reason: `${variant.shortLabel} ISA 미보유. 연 수익 ${variant.taxFreeLimit}만원까지 비과세, 초과분 ${(
        ISA_EXCESS_TAX_RATE * 100
      ).toFixed(1)}%(일반 ${(ISA_NORMAL_TAX_RATE * 100).toFixed(
        1
      )}% 대비 절세). 계좌 내 손익통산으로 세금 추가 절감.`,
      action: `${variant.productLabel} 개설 후 연 최대 ${fill}만원 납입`,
      warning: '해외주식 직접 투자 불가 / 국내 상장 해외ETF는 가능 / 3년 의무 유지',
    };
  }
}

/**
 * 기존 ISA 만기금을 IRP로 이전할 때 받을 수 있는 추가 세액공제(10%).
 */
export class IsaToIrpRule extends BaseRule {
  readonly name = 'ISA→IRP 전환';

  isApplicable(profile: UserProfile): boolean {
    if (isFinancialIncomeTaxable(profile)) return false;
    if (profile.age < 19) return false;
    if (!profile.has_isa) return false;
    return profile.has_irp || profile.income_type === 'employee';
  }

  evaluate(_profile: UserProfile): Candidate {
    const benefitManWon = Math.round(
      ISA_TRANSFER_LIMIT * ISA_TRANSFER_CREDIT_RATE
    );
    const { score, expectedBenefitKrw } = computeScore(
      benefitManWon,
      URGENCY.STRUCTURAL
    );
    return {
      rule_id: 'isa_to_irp',
      product: 'ISA→IRP 전환',
      category: '세액공제 추가',
      score,
      expected_benefit_krw: expectedBenefitKrw,
      recommended_contribution_krw: ISA_TRANSFER_LIMIT * MAN_WON_TO_KRW,
      short_strategy: 'ISA 만기금 IRP 전환 시 10% 추가 공제',
      reason: `ISA 만기금 IRP 이전 시 이전액의 10%(최대 ${ISA_TRANSFER_LIMIT}만원) 추가 세액공제.`,
      action: 'ISA 만기 시 IRP로 이전',
      warning: null,
    };
  }
}
