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
 * 룰 내부 평가 결과. v1 응답(RecommendItem)에는 노출되지 않는 필드들이 포함되어
 * v2 조합 엔진 및 상세 페이지에 활용됩니다. v1 응답 매핑 시 명시적으로 필드를
 * picking 합니다 (engine.ts).
 *   - rule_id: 조합 dedup / chip 라벨 매핑용
 *   - recommended_contribution_krw: 권장 연 납입액 (납입 개념 없는 룰은 null)
 *   - short_strategy: 한 줄 카피
 *   - annual_limit_krw: 연 한도 (예: 연금 600만원 = 6,000,000원, 한도 개념 없으면 null)
 *   - tax_rate_percent: 적용 세율 % (예: 16.5, 9.9, 22.0 / 의미 없으면 null)
 */
export type Candidate = Omit<RecommendItem, 'rank'> & {
  rule_id: RuleId;
  recommended_contribution_krw: number | null;
  short_strategy: string;
  annual_limit_krw: number | null;
  tax_rate_percent: number | null;
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
  priority: z.number().int().min(1),
  priority_hint: z.string(),
  expected_benefit_krw: z.number().int().nullable(),
  recommended_contribution_krw: z.number().int().nullable(),
  annual_limit_krw: z.number().int().nullable(),
  tax_rate_percent: z.number().nullable(),
  reason: z.string(),
  action: z.string(),
  warning: z.string().nullable(),
});
export type ComboDetailItem = z.infer<typeof ComboDetailItemSchema>;

export const LongTermAssumptionsSchema = z.object({
  horizon_years: z.number().int().min(1),
  assumed_return_rate_percent: z.number(),
  normal_tax_rate_percent: z.number(),
  isa_separate_tax_rate_percent: z.number(),
  note: z.string(),
});
export type LongTermAssumptions = z.infer<typeof LongTermAssumptionsSchema>;

export const LongTermProjectionSchema = z.object({
  /** 10년 누적 세후 기대 수익 (원). 절세 환급 + 운용 수익 절세분의 합산. */
  gain_krw: z.number().int(),
  /** 항목별 분해 (UI 표시용). */
  breakdown: z.object({
    cumulative_refund_krw: z.number().int(),
    isa_tax_saving_krw: z.number().int(),
    pension_tax_saving_krw: z.number().int(),
  }),
  assumptions: LongTermAssumptionsSchema,
});
export type LongTermProjection = z.infer<typeof LongTermProjectionSchema>;

export const ComboSchema = z.object({
  rank: z.number().int().min(1).max(5),
  label: z.string().nullable(),
  products: z.array(ComboProductChipSchema).min(1),
  refund_rate_percent: z.number().nullable(),
  expected_annual_refund_krw: z.number().int().min(0),
  recommended_contribution_krw: z.number().int().min(0),
  short_strategy: z.string(),
  /** "왜 이 조합이 유리한가요?" — 3~4 bullet 종합 설명 */
  justifications: z.array(z.string()),
  /** 10년 세후 기대수익 시뮬레이션 (가정값 명시) */
  long_term_projection: LongTermProjectionSchema,
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
