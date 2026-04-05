import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
const request = (supertest as any).default ?? supertest;
import { AppModule } from '../src/app.module';

describe('Hexawords API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
    // Give BullMQ time to close Redis connections
    await new Promise((r) => setTimeout(r, 500));
  });

  describe('Health', () => {
    it('GET / returns status ok', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.dictionary).toBeGreaterThan(0);
        });
    });
  });

  describe('Auth', () => {
    let cookies: string[];

    it('POST /auth/anonymous creates user and sets cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/anonymous')
        .expect(201);

      expect(res.body.userId).toBeDefined();
      cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
    });

    it('GET /auth/me returns user from cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.userId).toBeDefined();
      expect(res.body.role).toBe('anonymous');
    });

    it('POST /auth/sign-up creates email user', async () => {
      const email = `test-${Date.now()}@hexawords.dev`;
      const res = await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send({ email, password: 'test123', nickname: 'Tester' })
        .expect(201);

      expect(res.body.userId).toBeDefined();

      const signIn = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email, password: 'test123' })
        .expect(201);

      expect(signIn.body.userId).toBe(res.body.userId);
    });

    it('POST /auth/sign-in rejects wrong password', async () => {
      const email = `wrong-${Date.now()}@hexawords.dev`;
      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send({ email, password: 'correct123' });

      await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email, password: 'wrong' })
        .expect(401);
    });

    it('POST /auth/upgrade converts anonymous to email', async () => {
      const anon = await request(app.getHttpServer())
        .post('/auth/anonymous')
        .expect(201);

      const anonCookies = anon.headers['set-cookie'] as unknown as string[];
      const email = `upgrade-${Date.now()}@hexawords.dev`;

      const upgraded = await request(app.getHttpServer())
        .post('/auth/upgrade')
        .set('Cookie', anonCookies)
        .send({ email, password: 'upgrade123' })
        .expect(201);

      expect(upgraded.body.userId).toBe(anon.body.userId);
    });
  });

  describe('Game', () => {
    let cookies: string[];
    let gameId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/anonymous');
      cookies = res.headers['set-cookie'] as unknown as string[];
    });

    it('POST /games/new creates a single game', async () => {
      const res = await request(app.getHttpServer())
        .post('/games/new')
        .set('Cookie', cookies)
        .send({ mode: 'single', complexity: 'hard' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.hexagons).toHaveLength(4); // hard = 4 hexagons
      expect(res.body.hexagons[0].cells).toHaveLength(7); // 7 letters each
      expect(res.body.status).toBe('active');
      gameId = res.body.id;
    });

    it('GET /games/:id returns game state', async () => {
      const res = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.id).toBe(gameId);
      expect(res.body.hexagons).toHaveLength(4);
    });

    it('POST /games/:id/submit-word rejects too short', async () => {
      const game = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .set('Cookie', cookies);

      const hex = game.body.hexagons[0];
      const res = await request(app.getHttpServer())
        .post(`/games/${gameId}/submit-word`)
        .set('Cookie', cookies)
        .send({ path: [{ hexQ: hex.q, hexR: hex.r, slot: 0 }] })
        .expect(201);

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe('too_short');
    });

    it('POST /games/new creates campaign game', async () => {
      const res = await request(app.getHttpServer())
        .post('/games/new')
        .set('Cookie', cookies)
        .send({ mode: 'campaign', level: 1 })
        .expect(201);

      expect(res.body.hexagons).toHaveLength(3); // level 1 = 3 hexagons
    });

    it('GET /games/campaign/progress returns progress', async () => {
      const res = await request(app.getHttpServer())
        .get('/games/campaign/progress')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(res.body.completedLevels)).toBe(true);
    });
  });

  describe('Leaderboard', () => {
    it('GET /leaderboard returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/leaderboard')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('User', () => {
    let cookies: string[];

    beforeAll(async () => {
      const email = `profile-${Date.now()}@hexawords.dev`;
      const res = await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send({ email, password: 'test123', nickname: 'ProfileUser' });
      cookies = res.headers['set-cookie'] as unknown as string[];
    });

    it('GET /user/profile returns profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.nickname).toBe('ProfileUser');
    });

    it('PATCH /user/profile updates nickname', async () => {
      const res = await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Cookie', cookies)
        .send({ nickname: 'UpdatedName' })
        .expect(200);

      expect(res.body.nickname).toBe('UpdatedName');
    });

    it('GET /user/stats returns stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/user/stats')
        .set('Cookie', cookies)
        .expect(200);

      expect(typeof res.body.gamesPlayed).toBe('number');
      expect(typeof res.body.totalScore).toBe('number');
    });

    it('GET /user/words returns word history', async () => {
      const res = await request(app.getHttpServer())
        .get('/user/words')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(res.body.words)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });
  });
});
