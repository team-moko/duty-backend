import cors from 'cors';
import express, { ErrorRequestHandler, Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { getOpenApiDocument } from './openapi';
import { recommendRouter } from './routes/recommend';

/**
 * 프로덕션 CORS 정책.
 * NODE_ENV=production 시 ALLOWED_ORIGIN 환경변수에 명시된 origin 만 허용합니다.
 * 미설정이면 CORS 헤더를 보내지 않아 same-origin 만 통과합니다.
 */
function resolveCorsOrigin(): string | false {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOWED_ORIGIN ?? false;
  }
  return '*';
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: resolveCorsOrigin() }));
  app.use(express.json({ limit: '1mb' }));

  // /docs 와 /openapi.json 은 의도적으로 NODE_ENV 게이팅을 적용하지 않습니다.
  // 이 API 는 내부 도구 + 프론트 개발 협업을 전제로 한 dev-phase 서비스이므로
  // 문서 노출의 이점이 surface-disclosure 위험을 상회합니다. 외부 공개 시
  // 게이팅이 필요하다면 아래 두 라우트 앞에 `if (NODE_ENV === 'production') return 404`
  // 가드를 추가하세요 (routes/recommend.ts:/mock 패턴 참고).
  app.get('/openapi.json', (_req, res) => {
    res.status(200).json(getOpenApiDocument());
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(getOpenApiDocument(), {
      customSiteTitle: 'duty-backend API Docs',
      swaggerOptions: {
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
      },
    })
  );

  app.use(recommendRouter);

  app.use((_req, res) => {
    res.status(404).json({ detail: 'not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[server] unhandled error:', err);
    res.status(500).json({ detail: 'internal server error' });
  };
  app.use(errorHandler);

  return app;
}
