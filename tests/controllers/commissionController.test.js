jest.mock("../../src/models/commission");
jest.mock("../../src/models/order");
jest.mock("../../src/models/user");

const Commission = require("../../src/models/commission");
const Order = require("../../src/models/order");
const User = require("../../src/models/user");
const {
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  createInstallments,
  getCommissionsSummary,
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

// ─── getCommissions ──────────────────────────────────────────────────────────
describe("getCommissions", () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(results),
    };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(results.length);
    // Mock User.find for representativeName enrichment
    const userQ = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    User.find.mockReturnValue(userQ);
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

  it("filtra por orderNumber", async () => {
    const req = { query: { orderNumber: "42" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 42 })
    );
  });

  it("filtra por customerPurchaseOrder (regex case-insensitive)", async () => {
    const req = { query: { customerPurchaseOrder: "PC-001" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    const callArg = Commission.find.mock.calls[0][0];
    expect(callArg.customerPurchaseOrder).toBeInstanceOf(RegExp);
    expect(callArg.customerPurchaseOrder.source).toBe("PC-001");
    expect(callArg.customerPurchaseOrder.flags).toContain("i");
  });

  it("filtra por status=cancelled", async () => {
    const req = { query: { status: "cancelled" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("filtra por status=all (sem filtro de status)", async () => {
    const req = { query: { status: "all" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    const callArg = Commission.find.mock.calls[0][0];
    expect(callArg).not.toHaveProperty("status");
  });

  it("por padrao retorna apenas comissoes ativas quando status nao e informado", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();
    await getCommissions(req, res);
    expect(Commission.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $ne: 'cancelled' } })
    );
  });

  it("retorna paginacao correta", async () => {
    const req = { query: { page: "2", limit: "5" }, user: adminUser };
    const res = makeRes();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(15);
    const userQ = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    User.find.mockReturnValue(userQ);
    await getCommissions(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, total: 15, totalPages: 3 })
    );
  });

  it("representante nao recebe campos sensiveis na listagem", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    const comm = { ...makeCommission(), representativeId: repUser.id, representativeName: 'Rep' };
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([comm]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(1);
    const userQ = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    User.find.mockReturnValue(userQ);
    await getCommissions(req, res);
    const returned = res.json.mock.calls[0][0].commissions[0];
    expect(returned).not.toHaveProperty("realReceivedValue");
    expect(returned).not.toHaveProperty("adminCommission");
    expect(returned).not.toHaveProperty("adminPercentage");
  });

  it("admin recebe todos os campos", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    const comm = { ...makeCommission(), representativeName: 'Rep' };
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([comm]) };
    Commission.find.mockReturnValue(q);
    Commission.countDocuments.mockResolvedValue(1);
    const userQ = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    User.find.mockReturnValue(userQ);
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

  it("400 quando realReceivedValue e negativo", async () => {
    const req = { params: { id: "commId" }, body: { realReceivedValue: -100 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission());
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "realReceivedValue deve ser um número >= 0" });
  });

  it("400 quando realReceivedValue nao e numero", async () => {
    const req = { params: { id: "commId" }, body: { realReceivedValue: "abc" }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission());
    await updateCommission(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("aceita realReceivedValue igual a zero (pagamento zerado)", async () => {
    const comm = makeCommission({ orderValueWithoutIpi: 1000, representativePercentage: 3, adminPercentage: 5 });
    const req = { params: { id: "commId" }, body: { realReceivedValue: 0 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Comissão atualizada com sucesso" }));
  });

  it("aceita realReceivedValue null (limpar valor real)", async () => {
    const comm = makeCommission({ realReceivedValue: 500 });
    const req = { params: { id: "commId" }, body: { realReceivedValue: null }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.realReceivedValue).toBeNull();
    expect(comm.realPool).toBeNull();
    expect(comm.realRepresentativeCommission).toBeNull();
    expect(comm.realAdminCommission).toBeNull();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Comissão atualizada com sucesso" }));
  });

  it("atualiza projected sem recalcular comissoes", async () => {
    const comm = makeCommission();
    const originalPool = comm.pool;
    const req = { params: { id: "commId" }, body: { projected: true }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.projected).toBe(true);
    expect(comm.pool).toBe(originalPool);
    expect(comm.save).toHaveBeenCalled();
  });

  it("atualiza installmentsCreated sem recalcular comissoes", async () => {
    const comm = makeCommission();
    const req = { params: { id: "commId" }, body: { installmentsCreated: true }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.installmentsCreated).toBe(true);
    expect(comm.save).toHaveBeenCalled();
  });

  it("recalcula comissoes ao alterar representativePercentage", async () => {
    // base=1000 (realReceivedValue=null), adminPercentage=5 → pool=50; representativePercentage=10 → rep=5, admin=45
    const comm = makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: null, adminPercentage: 5 });
    const req = { params: { id: "commId" }, body: { representativePercentage: 10 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.representativeCommission).toBe(5);
    expect(comm.adminCommission).toBe(45);
    expect(comm.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Comiss\u00e3o atualizada com sucesso" }));
  });

  it("recalcula comissoes ao alterar realReceivedValue", async () => {
    // pool/rep/admin continuam baseados no pedido (orderValueWithoutIpi=1000, adminPercentage=5, repPercentage=3)
    // pool=50, rep=1.50, admin=48.50
    // real: base=800, adminPercentage=5 → realPool=40; repPercentage=3 → realRep=1.20, realAdmin=38.80
    const comm = makeCommission({ orderValueWithoutIpi: 1000, representativePercentage: 3, adminPercentage: 5 });
    const req = { params: { id: "commId" }, body: { realReceivedValue: 800 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    // Valores baseados no pedido não mudam
    expect(comm.pool).toBe(50);
    expect(comm.representativeCommission).toBeCloseTo(1.5, 2);
    expect(comm.adminCommission).toBeCloseTo(48.5, 2);
    // Valores reais calculados
    expect(comm.realPool).toBe(40);
    expect(comm.realRepresentativeCommission).toBe(1.2);
    expect(comm.realAdminCommission).toBe(38.8);
  });

  it("usa orderValueWithoutIpi como base para pool mesmo quando realReceivedValue esta definido", async () => {
    // orderValueWithoutIpi=1000, adminPercentage=10 → pool=100; representativePercentage=10 → rep=10, admin=90
    // real: base=600, adminPercentage=10 → realPool=60; rep=10 → realRep=6, realAdmin=54
    const comm = makeCommission({ orderValueWithoutIpi: 1000, representativePercentage: 10, adminPercentage: 5, realReceivedValue: 600 });
    const req = { params: { id: "commId" }, body: { adminPercentage: 10 }, user: adminUser };
    const res = makeRes();
    Commission.findById.mockResolvedValue(comm);
    await updateCommission(req, res);
    expect(comm.pool).toBe(100);
    expect(comm.adminCommission).toBe(90);
    expect(comm.realPool).toBe(60);
    expect(comm.realAdminCommission).toBe(54);
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

  it("400 quando intervals contem valor nao inteiro (float)", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28, 3.5], representativePercentage: 3 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Todos os intervalos devem ser inteiros positivos" });
  });

  it("400 quando representativePercentage e null", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: null }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "representativePercentage \u00e9 obrigat\u00f3rio" });
  });

  it("400 quando representativePercentage e negativo", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: -1 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "representativePercentage deve ser um n\u00famero >= 0" });
  });

  it("400 quando representativePercentage nao e numero", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: "abc" }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "representativePercentage deve ser um n\u00famero >= 0" });
  });

  it("400 quando adminPercentage e negativo", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: 3, adminPercentage: -2 }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "adminPercentage deve ser um n\u00famero >= 0" });
  });

  it("400 quando adminPercentage nao e numero", async () => {
    const req = { params: { id: "commId" }, body: { intervals: [28], representativePercentage: 3, adminPercentage: "abc" }, user: adminUser };
    const res = makeRes();
    await createInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "adminPercentage deve ser um n\u00famero >= 0" });
  });

  it("usa createdAt como referencia quando deliveryDate esta ausente", async () => {
    const req = {
      params: { id: "commId" },
      body: { intervals: [28], representativePercentage: 10 },
      user: adminUser,
    };
    const res = makeRes();
    Commission.findById.mockResolvedValue(makeCommission({ orderValueWithoutIpi: 1000, realReceivedValue: null }));
    Order.findById.mockResolvedValue(makeOrder({ deliveryDate: null, createdAt: new Date("2026-04-01T00:00:00.000Z") }));
    Commission.insertMany.mockResolvedValue([{}]);
    await createInstallments(req, res);
    const insertArg = Commission.insertMany.mock.calls[0][0];
    // dueDate should be based on createdAt + 28 days
    const expectedDue = new Date("2026-04-01T00:00:00.000Z");
    expectedDue.setUTCDate(expectedDue.getUTCDate() + 28);
    expect(insertArg[0].dueDate.toISOString()).toBe(expectedDue.toISOString());
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
    // base=500 por parcela, adminPercentage=5 → pool=25; representativePercentage=10 → rep=2.50, admin=22.50
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
    expect(insertArg[0].representativeCommission).toBe(2.5);
    expect(insertArg[0].adminCommission).toBe(22.5);
    expect(insertArg[0].pool).toBe(25);
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

// ─── getCommissionsSummary ───────────────────────────────────────────────────
describe("getCommissionsSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  const summaryRow = (overrides = {}) => ({
    period: { month: 4, year: 2026 },
    representativeId: "repId",
    totalRepresentativeCommission: 100,
    totalAdminCommission: 50,
    totalPool: 150,
    totalRealRepresentativeCommission: 80,
    totalRealAdminCommission: 40,
    totalRealPool: 120,
    count: 2,
    ...overrides,
  });

  it("admin recebe totais de todos os representantes com adminCommission e paginação", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    const rows = [summaryRow(), summaryRow({ representativeId: "repId2", totalRepresentativeCommission: 200 })];
    // Primeira chamada: dados paginados; segunda: contagem
    Commission.aggregate
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ total: 2 }]);
    await getCommissionsSummary(req, res);
    const returned = res.json.mock.calls[0][0];
    expect(returned.summary).toHaveLength(2);
    expect(returned.total).toBe(2);
    expect(returned.summary[0]).toHaveProperty("totalAdminCommission");
    expect(returned.summary[1]).toHaveProperty("totalAdminCommission");
  });

  it("representante recebe apenas seus proprios totais sem totalAdminCommission e totalRealAdminCommission", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    const rows = [summaryRow({ representativeId: repUser.id })];
    Commission.aggregate
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ total: 1 }]);
    await getCommissionsSummary(req, res);
    const returned = res.json.mock.calls[0][0].summary;
    expect(returned[0]).not.toHaveProperty("totalAdminCommission");
    expect(returned[0]).not.toHaveProperty("totalRealAdminCommission");
    expect(returned[0]).toHaveProperty("totalRepresentativeCommission");
    expect(returned[0]).toHaveProperty("totalRealRepresentativeCommission");
    expect(returned[0]).toHaveProperty("totalPool");
    expect(returned[0]).toHaveProperty("totalRealPool");
    expect(returned[0]).toHaveProperty("count");
  });

  it("filtra corretamente por month e year no pipeline", async () => {
    const req = { query: { month: "3", year: "2025" }, user: adminUser };
    const res = makeRes();
    Commission.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    await getCommissionsSummary(req, res);
    const pipeline = Commission.aggregate.mock.calls[0][0];
    const matchStage = pipeline.find((s) => s.$match);
    expect(matchStage.$match["period.month"]).toBe(3);
    expect(matchStage.$match["period.year"]).toBe(2025);
  });

  it("admin pode filtrar por representativeId via query param", async () => {
    const req = { query: { representativeId: "507f1f77bcf86cd799439011" }, user: adminUser };
    const res = makeRes();
    Commission.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    await getCommissionsSummary(req, res);
    const pipeline = Commission.aggregate.mock.calls[0][0];
    const matchStage = pipeline.find((s) => s.$match);
    expect(matchStage.$match.representativeId).toBeDefined();
  });

  it("retorna paginação correta", async () => {
    const req = { query: { page: "2", limit: "5" }, user: adminUser };
    const res = makeRes();
    Commission.aggregate
      .mockResolvedValueOnce([summaryRow()])
      .mockResolvedValueOnce([{ total: 12 }]);
    await getCommissionsSummary(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, total: 12, totalPages: 3 }),
    );
  });

  it("500 em caso de erro", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Commission.aggregate.mockRejectedValue(new Error("DB"));
    await getCommissionsSummary(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Erro ao buscar resumo de comissões" });
  });

  it("retorna total 0 quando countResult esta vazio", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Commission.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); // empty count result
    await getCommissionsSummary(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 0, totalPages: 0 }),
    );
  });

  it("representante filtra por seu proprio id no pipeline", async () => {
    const req = { query: { month: "6", year: "2026" }, user: repUser };
    const res = makeRes();
    Commission.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    await getCommissionsSummary(req, res);
    const pipeline = Commission.aggregate.mock.calls[0][0];
    const matchStage = pipeline.find((s) => s.$match);
    expect(matchStage.$match.representativeId).toBeDefined();
    expect(matchStage.$match["period.month"]).toBe(6);
    expect(matchStage.$match["period.year"]).toBe(2026);
  });
});
