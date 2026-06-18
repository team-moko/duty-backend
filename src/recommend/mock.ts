import type { RecommendResponse, UserProfile } from '../models';
import { recommend } from './engine';

/**
 * 프론트엔드 개발용 고정 Mock 응답.
 *
 * 첫 요청 시점에 실제 엔진을 SPEC.md §2 의 예시 프로필로 한 번 호출하고,
 * 그 결과를 모듈 단위 캐시에 동결합니다. 모듈 import 시점이 아닌 lazy
 * 평가이므로 엔진의 잠재적 예외가 import-time 크래시로 번지지 않습니다.
 */
const MOCK_PROFILE: UserProfile = {
  age: 35,
  annual_salary: 6000,
  income_type: 'employee',
  invest_types: ['foreign_stock', 'etf_foreign', 'domestic_stock'],
  monthly_invest: 100,
  has_isa: false,
  has_pension: true,
  has_irp: false,
  pension_contribution: 300,
  irp_contribution: 0,
  financial_income: 80,
  risk_tolerance: 'high',
  has_spouse: true,
  has_children: true,
  has_minor_children: true,
  foreign_stock_unrealized_profit: 1500,
  dividend_income: 30,
  holds_high_dividend: false,
};

let cached: RecommendResponse | null = null;

export function getMockResponse(): RecommendResponse {
  if (cached === null) {
    cached = recommend(MOCK_PROFILE);
  }
  return cached;
}
