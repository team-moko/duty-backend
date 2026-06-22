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

/**
 * 룰 식별자. 조합 엔진이 룰 종류별 그룹화 / 중복 제거 / 칩 라벨링에 사용합니다.
 * (ISA는 사용자 프로필별로 하나만 fire 하지만 별도 ID로 식별 — 청년형/서민형/일반형 구분)
 */
export const RuleIdValues = [
  'pension',
  'irp',
  'isa_general',
  'isa_welfare',
  'isa_youth',
  'isa_to_irp',
  'foreign_split',
  'foreign_offset',
  'family_gift',
  'etf',
  'dividend',
  'cap_gains',
] as const;
export type RuleId = (typeof RuleIdValues)[number];

/**
 * 룰 내부 평가 결과. v1 응답(RecommendItem)에는 노출되지 않는 필드(rule_id,
 * recommended_contribution_krw, short_strategy)가 포함되어 v2 조합 엔진에 활용됩니다.
 * v1 응답 매핑 시 명시적으로 필드를 picking 합니다 (engine.ts).
 */
export type Candidate = Omit<RecommendItem, 'rank'> & {
  rule_id: RuleId;
  recommended_contribution_krw: number | null;
  short_strategy: string;
};

// ──────────────────────────────────────────────────────────────────────
// v2 — 조합(Combo) 추천 응답
// ──────────────────────────────────────────────────────────────────────

export const ComboProductChipSchema = z.object({
  rule_id: z.string(),
  product: z.string(),
});
export type ComboProductChip = z.infer<typeof ComboProductChipSchema>;

export const ComboDetailItemSchema = z.object({
  rule_id: z.string(),
  product: z.string(),
  category: z.string(),
  expected_benefit_krw: z.number().int().nullable(),
  recommended_contribution_krw: z.number().int().nullable(),
  reason: z.string(),
  action: z.string(),
  warning: z.string().nullable(),
});
export type ComboDetailItem = z.infer<typeof ComboDetailItemSchema>;

export const ComboSchema = z.object({
  rank: z.number().int().min(1).max(5),
  label: z.string().nullable(),
  products: z.array(ComboProductChipSchema).min(1),
  refund_rate_percent: z.number().nullable(),
  expected_annual_refund_krw: z.number().int().min(0),
  recommended_contribution_krw: z.number().int().min(0),
  short_strategy: z.string(),
  details: z.array(ComboDetailItemSchema).min(1),
});
export type Combo = z.infer<typeof ComboSchema>;

export const ComboHeaderSchema = z.object({
  max_refund_rate_percent: z.number().nullable(),
  max_annual_refund_krw: z.number().int().min(0),
  applicable_combo_count: z.number().int().min(0),
});
export type ComboHeader = z.infer<typeof ComboHeaderSchema>;

export const ComboResponseSchema = z.object({
  combos: z.array(ComboSchema).max(5),
  header: ComboHeaderSchema,
  profile_summary: z.string(),
});
export type ComboResponse = z.infer<typeof ComboResponseSchema>;
