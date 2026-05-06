const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, disconnectDB } = require("./setup");
const { createAdminAndLogin, createRepAndLogin } = require("./helpers");

process.env.JWT_SECRET = "integration_test_secret";

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

describe("GET /settings", () => {
  it("retorna defaultObservations, defaultSellerName e sellerName do usuario", async () => {
    const { token, user } = await createAdminAndLogin();
    const res = await request(app).get("/settings").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.defaultObservations).toBe("string");
    expect(typeof res.body.defaultSellerName).toBe("string");
    expect(res.body.sellerName).toBe(user.name);
  });

  it("representante recebe seu proprio nome como sellerName", async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const res = await request(app).get("/settings").set("Authorization", `Bearer ${repToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sellerName).toBe(rep.name);
  });

  it("cria documento com texto padrao na primeira chamada (upsert)", async () => {
    const { token } = await createAdminAndLogin();
    const res = await request(app).get("/settings").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toMatch(/pagamento/i);
    expect(res.body.defaultSellerName).toBeTruthy();
  });

  it("retorna 401 sem autenticacao", async () => {
    const res = await request(app).get("/settings");
    expect(res.status).toBe(401);
  });
});

describe("PUT /settings", () => {
  it("admin atualiza defaultObservations com sucesso", async () => {
    const { token } = await createAdminAndLogin();
    const res = await request(app)
      .put("/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultObservations: "Pagamento: 30 dias\nFrete: FOB" });
    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toBe("Pagamento: 30 dias\nFrete: FOB");
  });

  it("admin atualiza defaultSellerName com sucesso", async () => {
    const { token } = await createAdminAndLogin();
    const res = await request(app)
      .put("/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultSellerName: "Maria Administradora" });
    expect(res.status).toBe(200);
    expect(res.body.defaultSellerName).toBe("Maria Administradora");
  });

  it("admin atualiza ambos os campos de uma vez", async () => {
    const { token } = await createAdminAndLogin();
    const res = await request(app)
      .put("/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultObservations: "Novo texto", defaultSellerName: "Nova Vendedora" });
    expect(res.status).toBe(200);
    expect(res.body.defaultObservations).toBe("Novo texto");
    expect(res.body.defaultSellerName).toBe("Nova Vendedora");
  });

  it("GET apos PUT retorna os valores atualizados", async () => {
    const { token } = await createAdminAndLogin();
    await request(app).put("/settings").set("Authorization", `Bearer ${token}`)
      .send({ defaultObservations: "Texto personalizado", defaultSellerName: "Vendedora X" });
    const res = await request(app).get("/settings").set("Authorization", `Bearer ${token}`);
    expect(res.body.defaultObservations).toBe("Texto personalizado");
    expect(res.body.defaultSellerName).toBe("Vendedora X");
  });

  it("retorna 400 quando nenhum campo e enviado", async () => {
    const { token } = await createAdminAndLogin();
    const res = await request(app).put("/settings").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("representante nao pode alterar settings (403)", async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken } = await createRepAndLogin(adminToken);
    const res = await request(app)
      .put("/settings")
      .set("Authorization", `Bearer ${repToken}`)
      .send({ defaultObservations: "Tentativa indevida" });
    expect(res.status).toBe(403);
  });

  it("retorna 401 sem autenticacao", async () => {
    const res = await request(app).put("/settings").send({ defaultObservations: "Texto" });
    expect(res.status).toBe(401);
  });

  it("preserva quebras de linha no texto salvo", async () => {
    const { token } = await createAdminAndLogin();
    const texto = "Linha 1\nLinha 2\nLinha 3";
    await request(app).put("/settings").set("Authorization", `Bearer ${token}`).send({ defaultObservations: texto });
    const res = await request(app).get("/settings").set("Authorization", `Bearer ${token}`);
    expect(res.body.defaultObservations).toBe(texto);
  });
});
