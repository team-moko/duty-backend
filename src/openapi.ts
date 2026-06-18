import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  RecommendItemSchema,
  RecommendResponseSchema,
  UserProfileSchema,
} from './models';

/**
 * Zod 인스턴스에 `.openapi()` 메서드를 패치합니다.
 *
 * 주의: 이 호출은 반드시 같은 모듈 내 `.openapi()` 사용 이전에 실행되어야 합니다.
 * 라이브러리가 Zod 프로토타입을 mutating 하기 때문에 호출 시점 이전/이후
 * 생성된 모든 스키마(즉 models.ts 에서 미리 정의된 스키마 포함)에서 사용 가능합니다.
 * 부수효과가 모듈 import 시점에 일어나는 것을 의도하므로 lazify 하면 동작이 깨집니다.
 */
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const ErrorDetailItemSchema = z
  .object({
    path: z.string().openapi({ example: 'pension_contribution' }),
    message: z.string().openapi({ example: 'Number must be less than or equal to 600' }),
    code: z.string().openapi({ example: 'too_big' }),
  })
  .openapi('ErrorDetailItem');

const ValidationErrorSchema = z
  .object({
    detail: z.array(ErrorDetailItemSchema),
  })
  .openapi('ValidationError');

const GenericErrorSchema = z
  .object({
    detail: z.string().openapi({ example: 'not found' }),
  })
  .openapi('GenericError');

const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
  })
  .openapi('HealthResponse');

registry.register('UserProfile', UserProfileSchema.openapi({
  description:
    '사용자 프로필 (연봉/투자 현황/가족 관계 등). 모든 금액 단위는 만원, 나이는 만 나이.',
}));
registry.register('RecommendItem', RecommendItemSchema.openapi({
  description: '추천 항목 한 건 (rank 1~5).',
}));
registry.register('RecommendResponse', RecommendResponseSchema.openapi({
  description: '추천 결과 응답 (Top 5 + 프로필 요약).',
}));

registry.registerPath({
  method: 'post',
  path: '/recommend',
  summary: '절세 상품 Top 5 추천',
  description:
    '사용자 프로필을 입력받아 2025년 한국 세법 기준 절세 상품 Top 5를 점수 순으로 반환합니다.',
  tags: ['recommend'],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: UserProfileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '추천 결과',
      content: {
        'application/json': {
          schema: RecommendResponseSchema,
        },
      },
    },
    422: {
      description: '입력 유효성 검증 실패 (Zod)',
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
    },
    500: {
      description: '서버 내부 오류',
      content: {
        'application/json': {
          schema: GenericErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health',
  summary: '헬스 체크',
  description: '서비스 가용성 확인용 엔드포인트.',
  tags: ['system'],
  responses: {
    200: {
      description: 'ok',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/mock',
  summary: '프론트 개발용 고정 Mock 응답',
  description:
    '프론트엔드 개발용으로 SPEC.md §2 예시 프로필 기준 결과를 반환합니다. `NODE_ENV=production` 환경에서는 404를 반환합니다.',
  tags: ['system'],
  responses: {
    200: {
      description: 'Mock 응답',
      content: {
        'application/json': {
          schema: RecommendResponseSchema,
        },
      },
    },
    404: {
      description: '프로덕션에서는 비활성화',
      content: {
        'application/json': {
          schema: GenericErrorSchema,
        },
      },
    },
  },
});

let cachedDocument: ReturnType<OpenApiGeneratorV3['generateDocument']> | null = null;

export function getOpenApiDocument() {
  if (cachedDocument === null) {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    cachedDocument = generator.generateDocument({
      openapi: '3.0.0',
      info: {
        title: 'duty-backend — 주식 절세 추천 API',
        version: '1.0.0',
        description:
          '한국 금융소득 절세 추천 백엔드 API. 사용자 프로필을 입력받아 절세 상품 Top 5를 규칙 기반으로 추천합니다.\n\n원본 스펙: PROMPT.md / SPEC.md',
        contact: {
          name: 'duty-backend',
        },
      },
      servers: [
        { url: 'http://localhost:8000', description: '로컬 개발 서버' },
      ],
      tags: [
        { name: 'recommend', description: '추천 엔드포인트' },
        { name: 'system', description: '시스템/유틸 엔드포인트' },
      ],
    });
  }
  return cachedDocument;
}
