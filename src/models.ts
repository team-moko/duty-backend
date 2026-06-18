import { z } from 'zod';

export const InvestType = {
  domestic_stock: 'domestic_stock',
  foreign_stock: 'foreign_stock',
  etf_domestic: 'etf_domestic',
  etf_foreign: 'etf_foreign',
  fund: 'fund',
  deposit: 'deposit',
  bond: 'bond',
  reit: 'reit',
} as const;
export type InvestType = (typeof InvestType)[keyof typeof InvestType];
export const InvestTypeSchema = z.nativeEnum(InvestType);

export const IncomeType = {
  employee: 'employee',
  freelancer: 'freelancer',
  none: 'none',
} as const;
export type IncomeType = (typeof IncomeType)[keyof typeof IncomeType];
export const IncomeTypeSchema = z.nativeEnum(IncomeType);

export const RiskTolerance = {
  low: 'low',
  medium: 'medium',
  high: 'high',
} as const;
export type RiskTolerance = (typeof RiskTolerance)[keyof typeof RiskTolerance];
export const RiskToleranceSchema = z.nativeEnum(RiskTolerance);

export const UserProfileSchema = z.object({
  age: z.number().int().min(19).max(80),
  annual_salary: z.number().int().min(0),
  income_type: IncomeTypeSchema,
  invest_types: z.array(InvestTypeSchema).min(1).max(20),
  monthly_invest: z.number().int().min(0),
  has_isa: z.boolean(),
  has_pension: z.boolean(),
  has_irp: z.boolean(),
  pension_contribution: z.number().int().min(0).max(600).default(0),
  irp_contribution: z.number().int().min(0).max(300).default(0),
  financial_income: z.number().int().min(0).default(0),
  risk_tolerance: RiskToleranceSchema,
  has_spouse: z.boolean().default(false),
  has_children: z.boolean().default(false),
  has_minor_children: z.boolean().default(false),
  foreign_stock_unrealized_profit: z.number().int().min(0).default(0),
  dividend_income: z.number().int().min(0).default(0),
  holds_high_dividend: z.boolean().default(false),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const CategoryValues = [
  '세액공제',
  '세액공제 추가',
  '비과세·분리과세',
  '양도소득세 절세',
  '구조적 절세',
  '배당소득 분리과세',
  '종합소득 관리',
] as const;
export type Category = (typeof CategoryValues)[number];

export const RecommendItemSchema = z.object({
  rank: z.number().int().min(1).max(5),
  product: z.string(),
  category: z.string(),
  score: z.number(),
  expected_benefit_krw: z.number().int().nullable(),
  reason: z.string(),
  action: z.string(),
  warning: z.string().nullable(),
});
export type RecommendItem = z.infer<typeof RecommendItemSchema>;

export const RecommendResponseSchema = z.object({
  recommendations: z.array(RecommendItemSchema).max(5),
  total_applicable: z.number().int().min(0),
  profile_summary: z.string(),
});
export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;

export type Candidate = Omit<RecommendItem, 'rank'>;
