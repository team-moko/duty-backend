/**
 * 2025년 한국 세법 상수.
 * 세법 개정 시 이 파일만 수정하면 전체 추천 로직에 반영됩니다.
 */

export const TAX_RATE_LOW = 0.165;
export const TAX_RATE_HIGH = 0.132;
export const SALARY_THRESHOLD = 5500;

export const PENSION_LIMIT = 600;
export const COMBINED_LIMIT = 900;

export const ISA_GENERAL_LIMIT = 200;
export const ISA_WELFARE_LIMIT = 400;
export const ISA_WELFARE_SALARY = 3600;
export const ISA_ANNUAL_MAX = 2000;
export const ISA_TRANSFER_LIMIT = 300;
export const ISA_EXPECTED_RETURN_RATE = 0.05;
export const ISA_NORMAL_TAX_RATE = 0.154;
export const ISA_EXCESS_TAX_RATE = 0.099;

export const FOREIGN_DEDUCTION = 250;
export const FOREIGN_TAX_RATE = 0.22;

export const FIN_INCOME_THRESHOLD = 2000;
export const FIN_INCOME_WARNING = 1500;

export const GIFT_SPOUSE = 60000;
export const GIFT_ADULT = 5000;
export const GIFT_MINOR = 2000;
export const GIFT_MIN_UNREALIZED = 500;

export const ISA_TRANSFER_CREDIT_RATE = 0.1;

/**
 * 청년형 ISA (만 19~34세 대상).
 * 비과세 한도 400만원 (서민형과 동일 수준), 연 납입 한도는 일반 ISA와 동일 2,000만원.
 */
export const ISA_YOUTH_AGE_MAX = 34;
export const ISA_YOUTH_LIMIT = 400;

export const DIVIDEND_BRACKET_LOW = 2000;
export const DIVIDEND_BRACKET_MID = 30000;
export const DIVIDEND_BRACKET_HIGH = 500000;
export const DIVIDEND_TRIGGER_AMOUNT = 200;
export const DIVIDEND_HIGH_INCOME_AMOUNT = 500;

export function getTaxRate(annualSalary: number): number {
  return annualSalary <= SALARY_THRESHOLD ? TAX_RATE_LOW : TAX_RATE_HIGH;
}

export const MAN_WON_TO_KRW = 10_000;

/**
 * 10년 세후 기대수익 시뮬레이션용 가정값.
 * PM 합의 시 이 상수만 조정하면 시뮬레이터에 즉시 반영됩니다.
 */
export const HORIZON_YEARS = 10;
export const ASSUMED_RETURN_RATE = 0.05;
export const NORMAL_TAX_RATE = 0.154;
export const ISA_SEPARATE_TAX_RATE = 0.099;
export const LONG_TERM_NOTE =
  '단순 모델 — 매년 동일 추가 납입 + 균등 운용 가정. 실제 수익률·세율 변화는 반영되지 않습니다.';

/**
 * 카테고리별 납입 우선순위 + 한 줄 카피.
 * 세액공제(즉시 환급)부터 채우고, 다음 분리과세, 그 다음 양도세/관리 안내 순서.
 */
export const CATEGORY_PRIORITY: Record<string, number> = {
  세액공제: 1,
  '세액공제 추가': 2,
  '비과세·분리과세': 3,
  '구조적 절세': 4,
  '양도소득세 절세': 5,
  '배당소득 분리과세': 6,
  '종합소득 관리': 7,
};

export const CATEGORY_PRIORITY_HINT: Record<string, string> = {
  세액공제: '세액공제 한도를 가장 먼저 채워요',
  '세액공제 추가': '남은 공제 한도를 마저 채워요',
  '비과세·분리과세': '남는 여유자금은 비과세로 굴려요',
  '구조적 절세': '계좌 구조를 바꿔 세금 자체를 줄여요',
  '양도소득세 절세': '매도 시점을 분산해 양도세 부담을 줄여요',
  '배당소득 분리과세': '고배당 종목은 분리과세로 종합과세를 피해요',
  '종합소득 관리': '종합과세 한도 초과 위험을 관리해요',
};
