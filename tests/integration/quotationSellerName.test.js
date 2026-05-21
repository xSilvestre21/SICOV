const request = require("supertest");
const app = require("../../app");
const { connectDB, clearDB, disconnectDB } = require("./setup");
const { createAdminAndLogin, createRepAndLogin, createSupplier, createClient, createProduct } = require("./helpers");

process.env.JWT_SECRET = "integration_test_secret";

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await clearDB(); });
afterAll(async () => { await disconnectDB(); });

async function buildFixture(adminToken, repId) {
  const supplier = await createSupplier(adminToken, { ipi: 0 });
  const client = await createClient(adminToken, repId);
  const product = await createProduct(adminToken, client._id, supplier._id);
  return { supplier, client, product };
}

describe("sellerName em cotacoes", () => {
  it("save:true com representante usa o nome do representante como sellerName", async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const { client, product } = await buildFixture(adminToken, rep.id);

    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${repToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }], save: true });

    expect(res.status).toBe(201);
    expect(res.body.quotation.sellerName).toBe(rep.name);
  });

  it("save:true com admin usa o nome do admin como sellerName", async () => {
    const { token: adminToken, user: admin } = await createAdminAndLogin();
    const { client, product } = await buildFixture(adminToken, admin.id);

    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }], save: true });

    expect(res.status).toBe(201);
    expect(res.body.quotation.sellerName).toBe(admin.name);
  });

  it("sellerName enviado no body sobrepoe o nome do usuario", async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const { client, product } = await buildFixture(adminToken, rep.id);

    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${repToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }], save: true, sellerName: "Nome Customizado" });

    expect(res.status).toBe(201);
    expect(res.body.quotation.sellerName).toBe("Nome Customizado");
  });

  it("save:false retorna sellerName do usuario no objeto calculado", async () => {
    const { token: adminToken } = await createAdminAndLogin();
    const { token: repToken, user: rep } = await createRepAndLogin(adminToken);
    const { client, product } = await buildFixture(adminToken, rep.id);

    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${repToken}`)
      .send({ clientId: client._id, items: [{ productId: product._id, quantity: 10 }], save: false });

    expect(res.status).toBe(200);
    expect(res.body.quotation.sellerName).toBe(rep.name);
  });
});
