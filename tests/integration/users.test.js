const request = require('supertest');
const app = require('../../app');
const { connectDB, clearDB, disconnectDB } = require('./setup');
const { createAdminAndLogin, createRepAndLogin } = require('./helpers');

process.env.JWT_SECRET = 'integration_test_secret';

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

// ─── GET /users/me ────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('retorna dados do usuário autenticado', async () => {
    const { token, user } = await createAdminAndLogin();

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

// ─── POST /users/create-representative ───────────────────────────────────────

describe('POST /users/create-representative', () => {
  it('admin cria representante com sucesso', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .post('/users/create-representative')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rep', email: 'rep@test.com', password: 'senha123' });

    expect(res.status).toBe(201);
    expect(res.body.user.profile).toBe('representative');
  });

  it('representante não pode criar outro representante', async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);

    const res = await request(app)
      .post('/users/create-representative')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ name: 'Rep2', email: 'rep2@test.com', password: 'senha123' });

    expect(res.status).toBe(403);
  });

  it('retorna 409 para email duplicado', async () => {
    const { token } = await createAdminAndLogin();

    await request(app)
      .post('/users/create-representative')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rep', email: 'rep@test.com', password: 'senha123' });

    const res = await request(app)
      .post('/users/create-representative')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rep2', email: 'rep@test.com', password: 'senha456' });

    expect(res.status).toBe(409);
  });
});

// ─── GET /users/representatives ───────────────────────────────────────────────

describe('GET /users/representatives', () => {
  it('admin lista representantes', async () => {
    const { token } = await createAdminAndLogin();
    await createRepAndLogin(token, 'rep1@test.com');
    await createRepAndLogin(token, 'rep2@test.com');

    const res = await request(app)
      .get('/users/representatives')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    res.body.forEach((u) => expect(u.profile).toBe('representative'));
  });

  it('filtra por active=true', async () => {
    const { token } = await createAdminAndLogin();
    const { user: rep } = await createRepAndLogin(token, 'rep@test.com');

    // Desativa o representante
    await request(app)
      .patch(`/users/representatives/${rep.id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/users/representatives?active=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

// ─── PUT /users/representatives/:id ──────────────────────────────────────────

describe('PUT /users/representatives/:id', () => {
  it('admin atualiza nome do representante', async () => {
    const { token } = await createAdminAndLogin();
    const { user: rep } = await createRepAndLogin(token);

    const res = await request(app)
      .put(`/users/representatives/${rep.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Nome Atualizado');
  });

  it('retorna 409 ao tentar usar email já existente', async () => {
    const { token } = await createAdminAndLogin();
    await createRepAndLogin(token, 'rep1@test.com');
    const { user: rep2 } = await createRepAndLogin(token, 'rep2@test.com');

    const res = await request(app)
      .put(`/users/representatives/${rep2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'rep1@test.com' });

    expect(res.status).toBe(409);
  });
});

// ─── DELETE /users/representatives/:id ───────────────────────────────────────

describe('DELETE /users/representatives/:id', () => {
  it('admin deleta representante sem vínculos', async () => {
    const { token } = await createAdminAndLogin();
    const { user: rep } = await createRepAndLogin(token);

    const res = await request(app)
      .delete(`/users/representatives/${rep.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/excluído/);
  });

  it('retorna 404 para representante inexistente', async () => {
    const { token } = await createAdminAndLogin();

    const res = await request(app)
      .delete('/users/representatives/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /users/representatives/:id/toggle-active ──────────────────────────

describe('PATCH /users/representatives/:id/toggle-active', () => {
  it('desativa e reativa representante', async () => {
    const { token } = await createAdminAndLogin();
    const { user: rep } = await createRepAndLogin(token);

    // Desativa
    let res = await request(app)
      .patch(`/users/representatives/${rep.id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.active).toBe(false);

    // Reativa
    res = await request(app)
      .patch(`/users/representatives/${rep.id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.active).toBe(true);
  });

  it('usuário inativo não consegue fazer login', async () => {
    const { token } = await createAdminAndLogin();
    const { user: rep } = await createRepAndLogin(token, 'rep@test.com');

    await request(app)
      .patch(`/users/representatives/${rep.id}/toggle-active`)
      .set('Authorization', `Bearer ${token}`);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'rep@test.com', password: 'senha123' });

    expect(loginRes.status).toBe(403);
  });
});
