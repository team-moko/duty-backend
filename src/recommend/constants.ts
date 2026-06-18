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

export const DIVIDEND_BRACKET_LOW = 2000;
export const DIVIDEND_BRACKET_MID = 30000;
export const DIVIDEND_BRACKET_HIGH = 500000;
export const DIVIDEND_TRIGGER_AMOUNT = 200;
export const DIVIDEND_HIGH_INCOME_AMOUNT = 500;

export function getTaxRate(annualSalary: number): number {
  return annualSalary <= SALARY_THRESHOLD ? TAX_RATE_LOW : TAX_RATE_HIGH;
}

export const MAN_WON_TO_KRW = 10_000;
