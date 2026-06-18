import request from 'supertest';
import { createApp } from '../src/server';
import { findScenario } from './scenarios';

const app = createApp();

describe('GET /health', () => {
  test('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /mock', () => {
  test('returns fixed mock RecommendResponse shape', async () => {
    const res = await request(app).get('/mock');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(5);
    expect(typeof res.body.profile_summary).toBe('string');
    expect(typeof res.body.total_applicable).toBe('number');
    res.body.recommendations.forEach((item: { rank: number; product: string }) => {
      expect(item.rank).toBeGreaterThanOrEqual(1);
      expect(item.rank).toBeLessThanOrEqual(5);
      expect(item.product).toBeTruthy();
    });
  });
});

describe('POST /recommend', () => {
  test('valid S001 profile returns Top1 = 연금저축펀드', async () => {
    const profile = findScenario('S001').profile;
    const res = await request(app).post('/recommend').send(profile);
    expect(res.status).toBe(200);
    expect(res.body.recommendations[0].product).toBe('연금저축펀드');
  });

  test('valid S002 includes 해외주식 분산매도', async () => {
    const profile = findScenario('S002').profile;
    const res = await request(app).post('/recommend').send(profile);
    expect(res.status).toBe(200);
    const products = res.body.recommendations.map(
      (r: { product: string }) => r.product
    );
    expect(products).toContain('해외주식 연도별 분산 매도');
  });

  test('invalid body (missing required fields) returns 422 with detail', async () => {
    const res = await request(app).post('/recommend').send({ age: 30 });
    expect(res.status).toBe(422);
    expect(res.body.detail).toBeDefined();
    expect(Array.isArray(res.body.detail)).toBe(true);
  });

  test('age out of range (18) returns 422', async () => {
    const profile = findScenario('S001').profile;
    const res = await request(app)
      .post('/recommend')
      .send({ ...profile, age: 18 });
    expect(res.status).toBe(422);
  });

  test('negative annual_salary returns 422', async () => {
    const profile = findScenario('S001').profile;
    const res = await request(app)
      .post('/recommend')
      .send({ ...profile, annual_salary: -100 });
    expect(res.status).toBe(422);
  });

  test('CORS header is permissive in dev', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('X-Powered-By header is disabled', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('404 on unknown route returns JSON', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: 'not found' });
  });
});
