import type { Candidate, UserProfile } from '../../models';
import { MAN_WON_TO_KRW } from '../constants';

export abstract class BaseRule {
  abstract readonly name: string;

  abstract isApplicable(profile: UserProfile): boolean;

  abstract evaluate(profile: UserProfile): Candidate;
}

export interface ScoreParts {
  score: number;
  expectedBenefitKrw: number | null;
}

/**
 * PROMPT.md 점수 공식.
 *   score = 예상_절세금액(만원) × 긴급도_가중치 × SCORE_SCALE
 *   계산 불가 항목 → 고정 점수 (FIXED_SCORE)
 *
 * SCORE_SCALE은 PROMPT 의 가중치 (2.0/1.5/1.0/0.8) 와 고정 점수 500 의 단위를
 * 맞추기 위한 보정 상수입니다 (만원 → 천원 환산). 이 보정이 없으면 비계산 항목
 * 500 이 항상 계산 항목 (수십~수백 만원 × 2.0 미만) 을 이겨서 PROMPT 의 시나리오
 * 검증 (예: S001 Top1 = 연금저축펀드) 이 불가능해집니다.
 */
const SCORE_SCALE = 10;
export const FIXED_SCORE = 500;

export function computeScore(
  benefitManWon: number,
  urgencyWeight: number
): ScoreParts {
  const score =
    Math.round(benefitManWon * urgencyWeight * SCORE_SCALE * 10) / 10;
  return { score, expectedBenefitKrw: benefitManWon * MAN_WON_TO_KRW };
}

/**
 * 예상 절세금액을 수치화할 수 없는 항목용 고정 점수.
 * urgency 가중치가 적용되지 않으므로 별도 함수로 분리해 호출부의 dead-parameter 혼동을 방지합니다.
 */
export function fixedScore(): ScoreParts {
  return { score: FIXED_SCORE, expectedBenefitKrw: null };
}

export const URGENCY = {
  IMMEDIATE: 2.0,
  PARTIAL: 1.5,
  STRUCTURAL: 1.0,
  WARNING: 0.8,
} as const;
