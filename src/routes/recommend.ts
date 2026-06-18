import { Router } from 'express';
import { ZodError } from 'zod';
import { UserProfileSchema } from '../models';
import { recommend } from '../recommend/engine';
import { getMockResponse } from '../recommend/mock';

export const recommendRouter: Router = Router();

recommendRouter.post('/recommend', (req, res, next) => {
  try {
    const profile = UserProfileSchema.parse(req.body);
    const response = recommend(profile);
    res.status(200).json(response);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({
        detail: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
      return;
    }
    next(err);
  }
});

recommendRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

recommendRouter.get('/mock', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ detail: 'not found' });
    return;
  }
  res.status(200).json(getMockResponse());
});
