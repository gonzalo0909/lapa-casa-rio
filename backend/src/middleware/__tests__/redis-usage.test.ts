jest.mock('@/config/redis', () => ({
  redisCache: { get: jest.fn(), incr: jest.fn(), expire: jest.fn(), decr: jest.fn(), del: jest.fn() },
}));
jest.mock('@/config/prisma', () => ({ prisma: {} }));

import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';
import { redisCache } from '@/config/redis';
import { authenticateToken, markTokenRevoked } from '../auth';
import { rateLimiter } from '../rate-limiter';

const redis = redisCache as unknown as Record<string, jest.Mock>;

describe('uso de Redis en la API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('rate limiter', () => {
    const appWith = (shared?: boolean) => {
      const app = express();
      app.use(rateLimiter({ max: 2, windowMs: 60000, prefix: 't', shared }), (_req, res) => res.json({ ok: true }));
      return app;
    };

    it('por defecto cuenta en memoria y no toca Redis', async () => {
      const app = appWith();
      expect((await request(app).get('/')).status).toBe(200);
      expect((await request(app).get('/')).status).toBe(200);
      expect((await request(app).get('/')).status).toBe(429);
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('con shared:true usa Redis', async () => {
      redis.incr.mockResolvedValue(1);
      await request(appWith(true)).get('/');
      expect(redis.incr).toHaveBeenCalledTimes(1);
    });
  });

  describe('tokens revocados', () => {
    process.env.JWT_SECRET = 'test-secret';
    const sign = () => jwt.sign({ userId: 'u', email: 'a@b.c', role: 'admin' }, 'test-secret', {
      issuer: 'lapa-casa-rio', audience: 'lapacasario-api', jwtid: Math.random().toString(36),
    });
    const appAuth = () => {
      const app = express();
      app.get('/', authenticateToken, (_req, res) => res.json({ ok: true }));
      return app;
    };

    it('consulta Redis una sola vez por token en vez de en cada pedido', async () => {
      redis.get.mockResolvedValue(null);
      const token = sign();
      for (let i = 0; i < 5; i++) {
        expect((await request(appAuth()).get('/').set('Authorization', `Bearer ${token}`)).status).toBe(200);
      }
      expect(redis.get).toHaveBeenCalledTimes(1);
    });

    it('un token revocado en esta instancia se bloquea al instante, aunque estuviera en cache', async () => {
      redis.get.mockResolvedValue(null);
      const token = sign();
      expect((await request(appAuth()).get('/').set('Authorization', `Bearer ${token}`)).status).toBe(200);
      markTokenRevoked(token, 60);
      expect((await request(appAuth()).get('/').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    });

    it('un token revocado en Redis se rechaza', async () => {
      redis.get.mockResolvedValue('1');
      expect((await request(appAuth()).get('/').set('Authorization', `Bearer ${sign()}`)).status).toBe(401);
    });
  });
});
