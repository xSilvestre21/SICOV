const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');

process.env.JWT_SECRET = 'integration_test_secret';

// setup.js já define ADMIN_REGISTER_SECRET = 'test-secret'
const ADMIN_SECRET = 'test-secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── POST /auth/register-admin ────────────────────────────────────────────────

describe('POST /auth/register-admin', () => {
  it('cria admin com sucesso e retorna 201', async () => {
    const res = await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({ name: 'Admin', email: 'admin@test.com', password: 'senha123' });

    expect(res.status).toBe(201);
    expect(res.body.user.profile).toBe('admin');
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('retorna 403 quando x-admin-secret está ausente', async () => {
    const res = await request(app)
      .post('/auth/register-admin')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'senha123' });

    expect(res.status).toBe(403);
  });

  it('retorna 403 quando x-admin-secret está incorreto', async () => {
    const res = await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', 'segredo-errado')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'senha123' });

    expect(res.status).toBe(403);
  });

  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const res = await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({ name: 'Admin' });

    expect(res.status).toBe(400);
  });

  it('retorna 409 quando email já está cadastrado', async () => {
    await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({ name: 'Admin', email: 'admin@test.com', password: 'senha123' });

    const res = await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({ name: 'Admin2', email: 'admin@test.com', password: 'senha456' });

    expect(res.status).toBe(409);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register-admin')
      .set('x-admin-secret', ADMIN_SECRET)
      .send({ name: 'Admin', email: 'admin@test.com', password: 'senha123' });
  });

  it('retorna 200 com token JWT para credenciais válidas', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'senha123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.profile).toBe('admin');
  });

  it('retorna 401 para senha incorreta', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'senhaerrada' });

    expect(res.status).toBe(401);
  });

  it('retorna 401 para email inexistente', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'naoexiste@test.com', password: 'senha123' });

    expect(res.status).toBe(401);
  });

  it('retorna 400 quando email ou senha estão ausentes', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(400);
  });
});
