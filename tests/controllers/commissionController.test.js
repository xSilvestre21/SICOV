jest.mock("../../src/models/commission");
jest.mock("../../src/models/order");

const Commission = require("../../src/models/commission");
const Order = require("../../src/models/order");
const {
  createCommission,
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  createInstallments,
} = require("../../src/controllers/commissionController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: "adminId", profile: "admin" };
const repUser = { id: "repId", profile: "representative" };

function makeOrder(overrides = {}) {
  return {
    _id: "orderId",
    subtotal: 1000,
    representativeId: "repId",
    deliveryDate: new Date("2026-04-15T00:00:00.000Z"),
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCommission(overrides = {}) {
  const base = {
    _id: "commId",
    orderId: "orderId",
    representativeId: { toString: () => "repId" },
    orderValueWithoutIpi: 1000,
    realReceivedValue: null,
    representativePercentage: 3,
    adminPercentage: 5,
    representativeCommission: 30,
    adminCommission: 50,
    period: { month: 4, year: 2026 },
    realDeliveryDate: null,
    projected: false,
    toObject: function () { return { ...this }; },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  return base;
}

// ─── createCommission ────────────────────────────────────────────────────────
describe("createCommission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 quando orderId esta ausente", async () => {
    const req = { body: { representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "orderId \u00e9 obrigat\u00f3rio" });
  });

  it("400 quando representativePercentage esta ausente", async () => {
    const req = { body: { orderId: "orderId" }, user: adminUser };
    const res = makeRes();
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "representativePercentage \u00e9 obrigat\u00f3rio" });
  });

  it("400 quando representativePercentage e negativo", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: -1 }, user: adminUser };
    const res = makeRes();
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 quando adminPercentage e negativo", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3, adminPercentage: -1 }, user: adminUser };
    const res = makeRes();
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404 quando pedido nao existe", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Pedido n\u00e3o encontrado" });
  });

  it("cria comissao com adminPercentage padrao de 5 quando nao informado", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(makeOrder());
    Commission.create.mockResolvedValue(makeCommission());
    await createCommission(req, res);
    expect(Commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ adminPercentage: 5 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("cria comissao usando realReceivedValue como base de calculo", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 10, realReceivedValue: 500 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(makeOrder());
    Commission.create.mockResolvedValue(makeCommission());
    await createCommission(req, res);
    expect(Commission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        representativeCommission: 50,
        adminCommission: 25,
        realReceivedValue: 500,
      })
    );
  });

  it("cria comissao usando subtotal do pedido quando realReceivedValue nao informado", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 10, adminPercentage: 5 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(makeOrder({ subtotal: 1000 }));
    Commission.create.mockResolvedValue(makeCommission());
    await createCommission(req, res);
    expect(Commission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        representativeCommission: 100,
        adminCommission: 50,
      })
    );
  });

  it("determina periodo a partir da deliveryDate do pedido", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(makeOrder({ deliveryDate: new Date("2026-06-20T00:00:00.000Z") }));
    Commission.create.mockResolvedValue(makeCommission());
    await createCommission(req, res);
    expect(Commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ period: { month: 6, year: 2026 } })
    );
  });

  it("usa createdAt como fallback quando deliveryDate nao existe", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(makeOrder({ deliveryDate: null, createdAt: new Date("2026-03-10T00:00:00.000Z") }));
    Commission.create.mockResolvedValue(makeCommission());
    await createCommission(req, res);
    expect(Commission.create).toHaveBeenCalledWith(
      expect.objectContaining({ period: { month: 3, year: 2026 } })
    );
  });

  it("500 em caso de erro", async () => {
    const req = { body: { orderId: "orderId", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await createCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getCommissions ──────────────────────────────────────────────────────────
describe("getCommissions", () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
    };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(results.length);
  }

  it("representante ve apenas seus proprios registros", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: repUser.id })
    );
  });

  it("admin ve todos os registros sem filtro de representante", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ representativeId: expect.anything() })
    );
  });

  it("admin pode filtrar por representativeId", async () => {
    const req = { query: { representativeId: "repId" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ representativeId: "repId" })
    );
  });

  it("filtra por month e year", async () => {
    const req = { query: { month: "4", year: "2026" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ "period.month": 4, "period.year": 2026 })
    );
  });

  it("filtra por projected=true", async () => {
    const req = { query: { projected: "true" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ projected: true })
    );
  });

  it("filtra por projected=false", async () => {
    const req = { query: { projected: "false" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ projected: false })
    );
  });

  it("retorna paginacao correta", async () => {
    const req = { query: { page: "2", limit: "5" }, user: adminUser };
    const res = makeRes();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(15);
    await getCommissions(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, total: 15, totalPages: 3 })
    );
  });

  it("representante nao recebe campos sensiveis na listagem", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    const comm = makeCommission({ representativeId: { toString: () => repUser.id } });
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([comm]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(1);
    await getCommissions(req, res);
    const returned = res.json.mock.calls[0][0].commissions[0];
    expect(returned).not.toHaveProperty("realReceivedValue");
    expect(returned).not.toHaveProperty("adminCommission");
    expect(returned).not.toHaveProperty("adminPercentage");
  });

  it("admin recebe todos os campos", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    const comm = makeCommission();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([comm]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(1);
    await getCommissions(req, res);
    const returned = res.json.mock.calls[0][0].commissions[0];
    expect(returned).toHaveProperty("adminCommission");
  });

  it("500 em caso de erro", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Commission.find.mockImplementation(() => { throw new Error("DB"); });
    await getCommissions(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getCommissionById ───────────────────────────────────────────────────────
describe("getCommissionById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando comissao nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(null);
    await getCommissionById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403 quando representante tenta acessar comissao de outro", async () => {
    const req = { params: { id: "commId" }, user: repUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ representativeId: { toString: () => "outroRepId" } }));
    await getCommissionById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("representante acessa sua propria comissao sem campos sensiveis", async () => {
    const req = { params: { id: "commId" }, user: repUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ representativeId: { toString: () => repUser.id } }));
    await getCommissionById(req, res);
    expect(res.json).toHaveBeenCalled();
    const returned = res.json.mock.calls[0][0];
    expect(returned).not.toHaveProperty("realReceivedValue");
    expect(returned).not.toHaveProperty("adminCommission");
    expect(returned).not.toHaveProperty("adminPercentage");
  });

  it("admin acessa qualquer comissao com todos os campos", async () => {
    const req = { params: { id: "commId" }, user: adminUser };
    const res = makeRes();
    const comm = makeCommission();
    Commission.findById.mockResolvedValue(comm);
    await getCommissionById(req, res);
    expect(res.json).toHaveBeenCalledWith(comm);
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "commId" }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockRejectedValue(new Error("DB"));
    await getCommissionById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateCommission ────────────────────────────────────────────────────────
describe("updateCommission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando comissao nao existe", async () => {
    const req = { params: { id: "x" }, body: {}, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(null);
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400 quando representativePercentage e invalido", async () => {
    const req = { params: { id: "commId" }, body: { representativePercentage: -5 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission());
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 quando adminPercentage e invalido", async () => {
    const req = { params: { id: "commId" }, body: { adminPercentage: -1 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission());
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("recalcula comissoes ao alterar representativePercentage", async () => {
    const comm = makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: null, adminPercentage: 5 });
    const req = { params: { id: "commId" }, body: { representativePercentage: 10 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.representativeCommission).toBe(100);
    expect(comm.adminCommission).toBe(50);
    expect(comm.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Comiss\u00e3o atualizada com sucesso" }));
  });

  it("recalcula comissoes ao alterar realReceivedValue", async () => {
    const comm = makeCommission({ orderValueWithoutIpi: 1000, representativePercentage: 3, adminPercentage: 5 });
    const req = { params: { id: "commId" }, body: { realReceivedValue: 800 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.representativeCommission).toBe(24);
    expect(comm.adminCommission).toBe(40);
  });

  it("usa realReceivedValue como base quando definido", async () => {
    const comm = makeCommission({ orderValueWithoutIpi: 1000, representativePercentage: 10, adminPercentage: 5, realReceivedValue: 600 });
    const req = { params: { id: "commId" }, body: { adminPercentage: 10 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.adminCommission).toBe(60);
  });

  it("atualiza realDeliveryDate sem recalcular comissoes", async () => {
    const comm = makeCommission();
    const originalRepComm = comm.representativeCommission;
    const req = { params: { id: "commId" }, body: { realDeliveryDate: "2026-04-20" }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.representativeCommission).toBe(originalRepComm);
    expect(comm.save).toHaveBeenCalled();
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "commId" }, body: {}, user: adminUser };
    const res = makeRes();
    Commission.findById.mockRejectedValue(new Error("DB"));
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deleteCommission ────────────────────────────────────────────────────────
describe("deleteCommission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando comissao nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Commission.findByIdAndDelete.mockResolvedValue(null);
    await deleteCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("remove comissao com sucesso", async () => {
    const req = { params: { id: "commId" }, user: adminUser };
    const res = makeRes();
    Commission.findByIdAndDelete.mockResolvedValue(makeCommission());
    await deleteCommission(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Comiss\u00e3o removida com sucesso" });
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "commId" }, user: adminUser };
    const res = makeRes();
    Commission.findByIdAndDelete.mockRejectedValue(new Error("DB"));
    await deleteCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── createInstallments ──────────────────────────────────────────────────────
describe("createInstallments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 quando intervals e array vazio", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "intervals deve ser uma lista n\u00e3o vazia" });
  });

  it("400 quando intervals nao e array", async () => {
    const req = { params: { id: "commId" }, body: { intervals: "28", representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 quando intervals contem valor nao positivo", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28, 0], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Todos os intervalos devem ser inteiros positivos" });
  });

  it("400 quando intervals contem valor negativo", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28, -5], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 quando representativePercentage esta ausente", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28, 35] }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "representativePercentage \u00e9 obrigat\u00f3rio" });
  });

  it("404 quando comissao pai nao existe", async () => {
    const req = { params: { id: "x" }, body: { intervals: [28], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(null);
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Comiss\u00e3o n\u00e3o encontrada" });
  });

  it("404 quando pedido original nao existe", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission());
    Order.findById.mockResolvedValue(null);
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Pedido original n\u00e3o encontrado" });
  });

  it("cria parcelas projetadas com datas corretas", async () => {
    const req = {
      params: { id: "commId" },
      body: { intervals: [28, 56], representativePercentage: 10, adminPercentage: 5 },
      user: adminUser,
    };
    const res = makeRes();
    const comm = makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: null });
    Commission.findById.mockResolvedValue(comm);
    Order.findById.mockResolvedValue(makeOrder({ deliveryDate: new Date("2026-04-15T00:00:00.000Z") }));
    Commission.insertMany.mockResolvedValue([
      { ...comm, projected: true, installmentIndex: 1 },
      { ...comm, projected: true, installmentIndex: 2 },
    ]);
    await createInstallments(req, res);
    const insertArg = Commission.insertMany.mock.calls[0][0];
    expect(insertArg).toHaveLength(2);
    expect(insertArg[0].installmentIndex).toBe(1);
    expect(insertArg[1].installmentIndex).toBe(2);
    expect(insertArg[0].projected).toBe(true);
    expect(insertArg[0].orderValueWithoutIpi).toBe(500);
    expect(insertArg[0].representativeCommission).toBe(50);
    expect(insertArg[0].adminCommission).toBe(25);
    const dueDate1 = new Date("2026-04-15T00:00:00.000Z");
    dueDate1.setUTCDate(dueDate1.getUTCDate() + 28);
    expect(insertArg[0].dueDate.toISOString()).toBe(dueDate1.toISOString());
  });

  it("usa adminPercentage padrao de 5 quando nao informado nas parcelas", async () => {
    const req = {
      params: { id: "commId" },
      body: { intervals: [28], representativePercentage: 10 },
      user: adminUser,
    };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: null }));
    Order.findById.mockResolvedValue(makeOrder());
    Commission.insertMany.mockResolvedValue([{}]);
    await createInstallments(req, res);
    const insertArg = Commission.insertMany.mock.calls[0][0];
    expect(insertArg[0].adminPercentage).toBe(5);
  });

  it("desconta realReceivedValue do saldo pendente", async () => {
    const req = {
      params: { id: "commId" },
      body: { intervals: [28], representativePercentage: 10 },
      user: adminUser,
    };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: 400 }));
    Order.findById.mockResolvedValue(makeOrder());
    Commission.insertMany.mockResolvedValue([{}]);
    await createInstallments(req, res);
    const insertArg = Commission.insertMany.mock.calls[0][0];
    expect(insertArg[0].orderValueWithoutIpi).toBe(600);
  });

  it("retorna 201 com parcelas criadas", async () => {
    const req = {
      params: { id: "commId" },
      body: { intervals: [28, 35, 42], representativePercentage: 3 },
      user: adminUser,
    };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ orderValueWithoutIpi: 900, realReceivedValue: null }));
    Order.findById.mockResolvedValue(makeOrder());
    Commission.insertMany.mockResolvedValue([{}, {}, {}]);
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "3 parcela(s) projetada(s) com sucesso" })
    );
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockRejectedValue(new Error("DB"));
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
