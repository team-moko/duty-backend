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

describe('OpenAPI / Swagger documentation', () => {
  test('GET /openapi.json returns valid OpenAPI 3.0 spec', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info?.title).toContain('duty-backend');
    expect(res.body.paths['/recommend']).toBeDefined();
    expect(res.body.paths['/health']).toBeDefined();
    expect(res.body.paths['/mock']).toBeDefined();
    expect(res.body.components?.schemas?.UserProfile).toBeDefined();
    expect(res.body.components?.schemas?.RecommendItem).toBeDefined();
    expect(res.body.components?.schemas?.RecommendResponse).toBeDefined();
  });

  test('UserProfile 스키마가 핵심 필드(required + properties)를 포함', async () => {
    const res = await request(app).get('/openapi.json');
    const userProfile = res.body.components.schemas.UserProfile;
    expect(userProfile.type).toBe('object');
    const required: string[] = userProfile.required ?? [];
    [
      'age',
      'annual_salary',
      'income_type',
      'invest_types',
      'monthly_invest',
      'has_isa',
      'has_pension',
      'has_irp',
      'risk_tolerance',
    ].forEach((key) => expect(required).toContain(key));
    expect(userProfile.properties?.age?.type).toBe('integer');
    expect(userProfile.properties?.age?.minimum).toBe(19);
    expect(userProfile.properties?.age?.maximum).toBe(80);
    expect(userProfile.properties?.invest_types?.type).toBe('array');
    expect(userProfile.properties?.invest_types?.minItems).toBe(1);
    expect(userProfile.properties?.invest_types?.maxItems).toBe(20);
  });

  test('RecommendResponse 스키마가 recommendations(max 5) + total_applicable + profile_summary 포함', async () => {
    const res = await request(app).get('/openapi.json');
    const resp = res.body.components.schemas.RecommendResponse;
    expect(resp.type).toBe('object');
    const required: string[] = resp.required ?? [];
    ['recommendations', 'total_applicable', 'profile_summary'].forEach((key) =>
      expect(required).toContain(key)
    );
    expect(resp.properties?.recommendations?.type).toBe('array');
    expect(resp.properties?.recommendations?.maxItems).toBe(5);
  });

  test('GET /openapi.json POST /recommend 응답 422 스키마가 노출됨', async () => {
    const res = await request(app).get('/openapi.json');
    const post = res.body.paths['/recommend']?.post;
    expect(post?.responses?.['200']).toBeDefined();
    expect(post?.responses?.['422']).toBeDefined();
    expect(post?.responses?.['500']).toBeDefined();
  });

  test('GET /docs Swagger UI HTML 페이지 응답', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/swagger-ui/i);
    expect(res.text).toContain('duty-backend API Docs');
  });
});
