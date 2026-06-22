import { Router } from 'express';
import { ZodError } from 'zod';
import { UserProfileSchema } from '../models';
import { recommendCombos } from '../recommend/comboEngine';
import { recommend } from '../recommend/engine';
import { getMockResponse } from '../recommend/mock';

export const recommendRouter: Router = Router();

function handleValidationError(err: unknown, res: import('express').Response, next: import('express').NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({
      detail: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    });
    return true;
  }
  next(err);
  return false;
}

recommendRouter.post('/recommend', (req, res, next) => {
  try {
    const profile = UserProfileSchema.parse(req.body);
    const response = recommend(profile);
    res.status(200).json(response);
  } catch (err) {
    handleValidationError(err, res, next);
  }
});

recommendRouter.post('/recommend/combos', (req, res, next) => {
  try {
    const profile = UserProfileSchema.parse(req.body);
    const response = recommendCombos(profile);
    res.status(200).json(response);
  } catch (err) {
    handleValidationError(err, res, next);
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
