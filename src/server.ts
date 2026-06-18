import cors from 'cors';
import express, { ErrorRequestHandler, Express } from 'express';
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
