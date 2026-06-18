import type { UserProfile } from '../models';
import { FIN_INCOME_THRESHOLD, PENSION_LIMIT } from './constants';

/**
 * 금융소득 종합과세 대상 여부 (연 2,000만원 초과).
 * 5개 룰 파일에 흩어져 있던 동일 조건을 한 곳으로 모은 헬퍼입니다.
 */
export function isFinancialIncomeTaxable(profile: UserProfile): boolean {
  return profile.financial_income >= FIN_INCOME_THRESHOLD;
}

export function annualInvestmentManWon(profile: UserProfile): number {
  return profile.monthly_invest * 12;
}

/**
 * 연금저축 한도(600만원) 내에서 추가 납입 가능한 실제 금액.
 * 사용자의 연간 투자 가능액에 의해 상한이 정해집니다.
 */
export function pensionRoomFill(profile: UserProfile): number {
  const room = Math.max(0, PENSION_LIMIT - profile.pension_contribution);
  return Math.min(room, annualInvestmentManWon(profile));
}
