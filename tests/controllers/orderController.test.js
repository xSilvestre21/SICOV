jest.mock("../../src/models/order");
jest.mock("../../src/models/product");
jest.mock("../../src/models/client");
jest.mock("../../src/models/supplier");
jest.mock("../../src/models/settings");
jest.mock("../../src/models/user");
jest.mock("../../src/models/commission");
jest.mock("../../src/utils/orderPdfGenerator");

const Order    = require("../../src/models/order");
const Product  = require("../../src/models/product");
const Client   = require("../../src/models/client");
const Supplier = require("../../src/models/supplier");
const Commission = require("../../src/models/commission");
const User     = require("../../src/models/user");
const generateOrderPdf = require("../../src/utils/orderPdfGenerator");
const {
  createOrder,
  cancelOrder,
  markAsSentToSupplier,
  getOrders,
  getOrderById,
  updateOrder,
  getDuplicateOrderTemplate,
  getOrderPdf,
} = require("../../src/controllers/orderController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const adminUser = { id: "adminId", profile: "admin" };
const repUser   = { id: "repId",   profile: "representative" };

// helpers
function makeProduct(supplierId = "s1") {
  return {
    _id: "p1", name: "Produto",
    supplierId: { toString: () => supplierId },
    calculationMode: "quantity_times_unit_price", saleMode: "unit",
    commercialData: { unitPrice: 5 }, technicalData: {},
    supplierCode: "SC", clientCode: "CC", description: "D",
    productType: "custom", material: "PVC", unitLabel: "UN", selectedExtras: [],
  };
}

function makeSupplier(ipi = 10) {
  return { _id: "s1", name: "Forn", ipi, currentOrderNumber: 1, cnpj: "456", tradeName: "F", logoUrl: null };
}

// createOrder
describe("createOrder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 quando clientId esta ausente", async () => {
    const req = { body: {}, user: repUser };
    const res = makeRes();
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Cliente \u00e9 obrigat\u00f3rio" });
  });

  it("400 quando items esta ausente", async () => {
    const req = { body: { clientId: "c1" }, user: repUser };
    const res = makeRes();
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Itens s\u00e3o obrigat\u00f3rios" });
  });

  it("400 quando items e array vazio", async () => {
    const req = { body: { clientId: "c1", items: [] }, user: repUser };
    const res = makeRes();
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404 quando cliente nao existe", async () => {
    const req = { body: { clientId: "c1", items: [{ productId: "p1", quantity: 10 }] }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue(null);
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Cliente n\u00e3o encontrado" });
  });

  it("500 quando produto nao e encontrado (erro no Promise.all)", async () => {
    const req = { body: { clientId: "c1", items: [{ productId: "p1", quantity: 10 }] }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: "c1", paymentTerm: "30 dias" });
    Product.findById.mockResolvedValue(null);
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("500 quando dois produtos têm fornecedores diferentes", async () => {
    const req = {
      body: {
        clientId: "c1",
        items: [
          { productId: "p1", quantity: 10 },
          { productId: "p2", quantity: 5 },
        ],
      },
      user: repUser,
    };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: "c1", paymentTerm: "30 dias" });
    // Primeiro produto define supplierId = "s1", segundo tem "s2"
    Product.findById
      .mockResolvedValueOnce({ ...makeProduct("s1"), _id: "p1" })
      .mockResolvedValueOnce({ ...makeProduct("s2"), _id: "p2" });
    Supplier.findById.mockResolvedValue(makeSupplier());
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("cria pedido com sucesso e calcula IPI", async () => {
    const req = {
      body: { clientId: "c1", items: [{ productId: "p1", quantity: 100 }], notes: "Obs", sellerName: "Vendedor" },
      user: repUser,
    };
    const res = makeRes();
    const mockClient = { _id: "c1", name: "Empresa", paymentTerm: "30 dias", cnpj: "123", tradeName: "Emp", stateRegistration: "456", address: "Rua", city: "SP", state: "SP", district: "Bairro", zipCode: "01310", phone: "11999", email: "e@e.com" };
    const mockProduct = makeProduct();
    const mockSupplier = makeSupplier(10);
    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    Supplier.findByIdAndUpdate.mockResolvedValue({ ...mockSupplier, currentOrderNumber: 2 });
    Order.create.mockResolvedValue({ _id: "o1", orderNumber: 2, subtotal: 500, ipiValue: 50, total: 550 });
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pedido criado com sucesso" }));
  });

  it("404 quando fornecedor nao e encontrado apos incremento", async () => {
    const req = { body: { clientId: "c1", items: [{ productId: "p1", quantity: 10 }] }, user: repUser };
    const res = makeRes();
    Client.findById.mockResolvedValue({ _id: "c1", paymentTerm: "30 dias" });
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue({ _id: "s1" });
    Supplier.findByIdAndUpdate.mockResolvedValue(null);
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Fornecedor n\u00e3o encontrado" });
  });

  it("cria pedido com deliveryDate definida e usa na comissao", async () => {
    const req = {
      body: { clientId: "c1", items: [{ productId: "p1", quantity: 100 }], deliveryDate: "2026-06-15T00:00:00.000Z" },
      user: repUser,
    };
    const res = makeRes();
    const mockClient = { _id: "c1", name: "Empresa", paymentTerm: "30 dias", cnpj: "123", tradeName: "Emp", representativeId: "repId" };
    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue(makeSupplier(10));
    Supplier.findByIdAndUpdate.mockResolvedValue({ ...makeSupplier(10), currentOrderNumber: 2 });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ defaultCommissionPercentage: 3, name: "Rep" }) });
    Commission.create.mockResolvedValue({});
    Order.create.mockResolvedValue({ _id: "o1", orderNumber: 2, subtotal: 500, ipiValue: 50, total: 550, createdAt: new Date() });
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Commission.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryDate: "2026-06-15T00:00:00.000Z" }));
  });

  it("cria pedido sem deliveryDate e usa createdAt na comissao", async () => {
    const req = {
      body: { clientId: "c1", items: [{ productId: "p1", quantity: 100 }] },
      user: repUser,
    };
    const res = makeRes();
    const mockClient = { _id: "c1", name: "Empresa", paymentTerm: "30 dias", cnpj: "123", tradeName: "Emp", representativeId: "repId" };
    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue(makeSupplier(10));
    Supplier.findByIdAndUpdate.mockResolvedValue({ ...makeSupplier(10), currentOrderNumber: 2 });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ defaultCommissionPercentage: 3, name: "Rep" }) });
    Commission.create.mockResolvedValue({});
    Order.create.mockResolvedValue({ _id: "o1", orderNumber: 2, subtotal: 500, ipiValue: 50, total: 550, createdAt: new Date("2026-04-01") });
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Commission.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryDate: null }));
  });

  it("cria pedido com item hasIpi=false (nao inclui no calculo de IPI)", async () => {
    const req = {
      body: { clientId: "c1", items: [{ productId: "p1", quantity: 100, hasIpi: false }] },
      user: repUser,
    };
    const res = makeRes();
    const mockClient = { _id: "c1", name: "Empresa", paymentTerm: "30 dias", cnpj: "123", tradeName: "Emp", representativeId: "repId" };
    Client.findById.mockResolvedValue(mockClient);
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue(makeSupplier(10));
    Supplier.findByIdAndUpdate.mockResolvedValue({ ...makeSupplier(10), currentOrderNumber: 2 });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ defaultCommissionPercentage: 3, name: "Rep" }) });
    Commission.create.mockResolvedValue({});
    // With hasIpi=false, ipiValue should be 0 since all items are excluded from IPI
    Order.create.mockImplementation((data) => {
      expect(data.ipiValue).toBe(0);
      return Promise.resolve({ _id: "o1", orderNumber: 2, ...data, createdAt: new Date() });
    });
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// cancelOrder
describe("cancelOrder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando pedido nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400 quando pedido ja esta cancelado", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ status: "cancelled" });
    await cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Pedido j\u00e1 est\u00e1 cancelado" });
  });

  it("cancela pedido ativo com sucesso e limpa sentToSupplier", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", status: "active", sentToSupplier: true, save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(mockOrder);
    await cancelOrder(req, res);
    expect(mockOrder.status).toBe("cancelled");
    expect(mockOrder.sentToSupplier).toBe(false);
    expect(mockOrder.sentToSupplierAt).toBeNull();
    expect(mockOrder.sentToSupplierBy).toBeNull();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pedido cancelado com sucesso" }));
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// markAsSentToSupplier
describe("markAsSentToSupplier", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando pedido nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await markAsSentToSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400 quando pedido esta cancelado", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ status: "cancelled" });
    await markAsSentToSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("marca como enviado ao fornecedor e registra data e usuario", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", status: "active", sentToSupplier: false, save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(mockOrder);
    await markAsSentToSupplier(req, res);
    expect(mockOrder.sentToSupplier).toBe(true);
    expect(mockOrder.sentToSupplierBy).toBe(adminUser.id);
    expect(mockOrder.sentToSupplierAt).toBeDefined();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pedido marcado como enviado ao fornecedor" }));
  });

  it("desmarca envio e limpa data e usuario", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", status: "active", sentToSupplier: true, save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(mockOrder);
    await markAsSentToSupplier(req, res);
    expect(mockOrder.sentToSupplier).toBe(false);
    expect(mockOrder.sentToSupplierAt).toBeNull();
    expect(mockOrder.sentToSupplierBy).toBeNull();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Envio desmarcado com sucesso" }));
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await markAsSentToSupplier(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// getOrders
describe("getOrders", () => {
  beforeEach(() => jest.clearAllMocks());

  function mockFind(results = []) {
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(results) };
    Order.find.mockReturnValue(q);
    Order.countDocuments.mockResolvedValue(results.length);
  }

  function mockClientFind(clients = [{ _id: "c1" }, { _id: "c2" }]) {
    Client.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(clients) }) });
  }

  it("representante ve apenas seus pedidos", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    // New logic: getOrders calls Client.find to get rep's clients, then filters by clientId $in
    Client.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "c1" }, { _id: "c2" }]) }) });
    mockFind();
    await getOrders(req, res);
    expect(Client.find).toHaveBeenCalledWith({ representativeId: repUser.id });
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ clientId: { $in: [{ _id: "c1" }, { _id: "c2" }].map(c => c._id) } }));
  });

  it("admin ve todos os pedidos", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.not.objectContaining({ representativeId: expect.anything() }));
  });

  it("filtra por status", async () => {
    const req = { query: { status: "cancelled" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
  });

  it("filtra por clientId", async () => {
    const req = { query: { clientId: "c1" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1" }));
  });

  it("filtra por supplierId", async () => {
    const req = { query: { supplierId: "s1" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ supplierId: "s1" }));
  });

  it("filtra por sentToSupplier=true", async () => {
    const req = { query: { sentToSupplier: "true" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ sentToSupplier: true }));
  });

  it("filtra por sentToSupplier=false", async () => {
    const req = { query: { sentToSupplier: "false" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ sentToSupplier: false }));
  });

  it("filtra por orderNumber", async () => {
    const req = { query: { orderNumber: "2018" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 2018 }));
  });

  it("busca por texto inclui orderNumber numerico no $or", async () => {
    const req = { query: { search: "2018" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    const callArg = Order.find.mock.calls[0][0];
    expect(callArg.$or).toEqual(expect.arrayContaining([expect.objectContaining({ orderNumber: 2018 })]));
  });

  it("busca por texto nao numerico usa apenas regex", async () => {
    const req = { query: { search: "empresa" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it("retorna paginacao correta", async () => {
    const req = { query: { page: "2", limit: "5" }, user: adminUser };
    const res = makeRes();
    const q = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
    Order.find.mockReturnValue(q);
    Order.countDocuments.mockResolvedValue(15);
    await getOrders(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5, total: 15, totalPages: 3 }));
  });

  it("representante filtra por clientId que pertence a ele", async () => {
    const req = { query: { clientId: "c1" }, user: repUser };
    const res = makeRes();
    mockClientFind([{ _id: "c1" }, { _id: "c2" }]);
    mockFind([]);
    await getOrders(req, res);
    // clientId is included in repClientIds, so filter.clientId stays as "c1"
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1" }));
  });

  it("representante filtra por clientId que NAO pertence a ele retorna vazio", async () => {
    const req = { query: { clientId: "c99" }, user: repUser };
    const res = makeRes();
    mockClientFind([{ _id: "c1" }, { _id: "c2" }]);
    mockFind([]);
    await getOrders(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0, orders: [] }));
  });

  it("busca por texto numerico inclui orderNumber no $or", async () => {
    const req = { query: { search: "123" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    const callArg = Order.find.mock.calls[0][0];
    expect(callArg.$or).toEqual(expect.arrayContaining([{ orderNumber: 123 }]));
  });

  it("busca por texto nao numerico nao inclui orderNumber no $or", async () => {
    const req = { query: { search: "abc" }, user: adminUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    const callArg = Order.find.mock.calls[0][0];
    const hasOrderNumber = callArg.$or.some(cond => cond.orderNumber !== undefined);
    expect(hasOrderNumber).toBe(false);
  });

  it("500 em caso de erro", async () => {
    const req = { query: {}, user: adminUser };
    const res = makeRes();
    Order.find.mockImplementation(() => { throw new Error("DB"); });
    await getOrders(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// getOrderById
describe("getOrderById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando pedido nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await getOrderById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403 quando representante tenta acessar pedido de outro", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", clientId: "c1", representativeId: { toString: () => "outroRepId" } });
    // Secondary check: Client.findById returns client belonging to another rep
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ representativeId: { toString: () => "outroRepId" } }) }) });
    await getOrderById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("representante acessa seu proprio pedido", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", representativeId: { toString: () => repUser.id } };
    Order.findById.mockResolvedValue(mockOrder);
    await getOrderById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockOrder);
  });

  it("representante acessa pedido de outro criador mas cujo cliente pertence a ele", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", clientId: "c1", representativeId: { toString: () => "outroRepId" } };
    Order.findById.mockResolvedValue(mockOrder);
    // Client belongs to the representative
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ representativeId: { toString: () => repUser.id } }) }) });
    await getOrderById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockOrder);
  });

  it("403 quando representante acessa pedido e client nao encontrado", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", clientId: "c1", representativeId: { toString: () => "outroRepId" } };
    Order.findById.mockResolvedValue(mockOrder);
    // Client not found
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    await getOrderById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("admin acessa qualquer pedido", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = { _id: "o1", representativeId: { toString: () => "qualquerRepId" } };
    Order.findById.mockResolvedValue(mockOrder);
    await getOrderById(req, res);
    expect(res.json).toHaveBeenCalledWith(mockOrder);
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await getOrderById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// updateOrder
describe("updateOrder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando pedido nao existe", async () => {
    const req = { params: { id: "x" }, body: { items: [{ productId: "p1", quantity: 1 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403 quando representante tenta editar pedido de outro", async () => {
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 1 }] }, user: repUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", clientId: "c1", representativeId: { toString: () => "outroRepId" }, status: "active", sentToSupplier: false, supplierId: { toString: () => "s1" } });
    // Secondary check: Client.findById returns client belonging to another rep
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ representativeId: { toString: () => "outroRepId" } }) }) });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("representante edita pedido de outro criador mas cujo cliente pertence a ele", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = {
      _id: "o1", representativeId: { toString: () => "outroRepId" },
      clientId: "c1",
      status: "active", sentToSupplier: false, supplierId,
      items: [], subtotal: 0, ipiValue: 0, total: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }] }, user: repUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    // Client belongs to the representative
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ representativeId: { toString: () => repUser.id } }) }) });
    Product.findById.mockResolvedValue(makeProduct("s1"));
    Supplier.findById.mockResolvedValue({ _id: "s1", ipi: 0, name: "Forn", cnpj: "123", tradeName: "F", logoUrl: null });
    await updateOrder(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pedido atualizado com sucesso" }));
  });

  it("400 quando pedido esta cancelado", async () => {
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 1 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => adminUser.id }, status: "cancelled", sentToSupplier: false });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Pedido cancelado n\u00e3o pode ser editado" });
  });

  it("400 quando pedido ja foi enviado ao fornecedor", async () => {
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 1 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => adminUser.id }, status: "active", sentToSupplier: true });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Pedido j\u00e1 enviado ao fornecedor n\u00e3o pode ser editado" });
  });

  it("400 quando items esta ausente", async () => {
    const req = { params: { id: "o1" }, body: {}, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => adminUser.id }, status: "active", sentToSupplier: false });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Itens s\u00e3o obrigat\u00f3rios" });
  });

  it("atualiza pedido com sucesso e recalcula totais", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = {
      _id: "o1", representativeId: { toString: () => adminUser.id },
      status: "active", sentToSupplier: false, supplierId,
      items: [], subtotal: 0, ipiValue: 0, total: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    const mockProduct = makeProduct();
    const mockSupplier = { _id: "s1", ipi: 0, name: "Forn", cnpj: "123", tradeName: "F", logoUrl: null };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }], notes: "Nova obs" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    Product.findById.mockResolvedValue(mockProduct);
    Supplier.findById.mockResolvedValue(mockSupplier);
    await updateOrder(req, res);
    expect(mockOrder.subtotal).toBe(25);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pedido atualizado com sucesso" }));
  });

  it("atualiza pedido e recalcula comissao quando subtotal muda", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = {
      _id: "o1", representativeId: { toString: () => adminUser.id },
      status: "active", sentToSupplier: false, supplierId,
      items: [], subtotal: 0, ipiValue: 0, total: 0,
      deliveryDate: new Date("2026-04-15"),
      customerPurchaseOrder: "PC-001",
      createdAt: new Date("2026-04-01"),
      save: jest.fn().mockResolvedValue(true),
    };
    const mockCommission = {
      orderId: "o1",
      orderValueWithoutIpi: 100, // different from new subtotal (25)
      period: { month: 4, year: 2026 },
      customerPurchaseOrder: "PC-001",
      deliveryDate: new Date("2026-04-15"),
      adminPercentage: 5,
      representativePercentage: 10,
      realReceivedValue: 80,
      save: jest.fn().mockResolvedValue(true),
    };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue({ _id: "s1", ipi: 0, name: "Forn", cnpj: "123", tradeName: "F", logoUrl: null });
    Commission.findOne.mockResolvedValue(mockCommission);
    await updateOrder(req, res);
    // Commission should be recalculated with new subtotal=25
    expect(mockCommission.orderValueWithoutIpi).toBe(25);
    expect(mockCommission.pool).toBeCloseTo(1.25, 2); // 25 * 5 / 100
    expect(mockCommission.realPool).toBeCloseTo(4, 2); // 80 * 5 / 100
    expect(mockCommission.save).toHaveBeenCalled();
  });

  it("atualiza pedido e recalcula comissao quando period muda (deliveryDate alterada)", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = {
      _id: "o1", representativeId: { toString: () => adminUser.id },
      status: "active", sentToSupplier: false, supplierId,
      items: [], subtotal: 0, ipiValue: 0, total: 0,
      deliveryDate: null,
      customerPurchaseOrder: null,
      createdAt: new Date("2026-04-01"),
      save: jest.fn().mockResolvedValue(true),
    };
    const mockCommission = {
      orderId: "o1",
      orderValueWithoutIpi: 25, // same as new subtotal
      period: { month: 3, year: 2026 }, // different from new period (April based on createdAt)
      customerPurchaseOrder: null,
      deliveryDate: null,
      adminPercentage: 5,
      representativePercentage: 10,
      realReceivedValue: null,
      save: jest.fn().mockResolvedValue(true),
    };
    // deliveryDate is set as a Date object in the body
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }], deliveryDate: new Date("2026-06-15T00:00:00.000Z") }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    Product.findById.mockResolvedValue(makeProduct());
    Supplier.findById.mockResolvedValue({ _id: "s1", ipi: 0, name: "Forn", cnpj: "123", tradeName: "F", logoUrl: null });
    Commission.findOne.mockResolvedValue(mockCommission);
    await updateOrder(req, res);
    // Period should be updated to June 2026
    expect(mockCommission.period).toEqual({ month: 6, year: 2026 });
    expect(mockCommission.save).toHaveBeenCalled();
  });

  it("500 quando produto nao encontrado no update", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = { _id: "o1", representativeId: { toString: () => adminUser.id }, status: "active", sentToSupplier: false, supplierId };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    Product.findById.mockResolvedValue(null);
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("500 quando produto tem fornecedor diferente do pedido no update", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = { _id: "o1", representativeId: { toString: () => adminUser.id }, status: "active", sentToSupplier: false, supplierId };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    // Produto com supplierId diferente do pedido
    Product.findById.mockResolvedValue({ ...makeProduct("s2"), supplierId: { toString: () => "s2" } });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("404 quando fornecedor do pedido nao encontrado no update", async () => {
    const supplierId = { toString: () => "s1" };
    const mockOrder = {
      _id: "o1", representativeId: { toString: () => adminUser.id },
      status: "active", sentToSupplier: false, supplierId,
      items: [], subtotal: 0, ipiValue: 0, total: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    const req = { params: { id: "o1" }, body: { items: [{ productId: "p1", quantity: 5 }] }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(mockOrder);
    Product.findById.mockResolvedValue(makeProduct("s1"));
    Supplier.findById.mockResolvedValue(null); // fornecedor não encontrado
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Fornecedor do pedido n\u00e3o encontrado" });
  });
});

// getDuplicateOrderTemplate
describe("getDuplicateOrderTemplate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 quando pedido original nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await getDuplicateOrderTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403 quando representante tenta duplicar pedido de outro", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    Order.findById.mockResolvedValue({ _id: "o1", clientId: "c1", representativeId: { toString: () => "outroRepId" }, items: [] });
    // Secondary check: Client.findById returns client belonging to another rep
    Client.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ representativeId: { toString: () => "outroRepId" } }) }) });
    await getDuplicateOrderTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retorna template com clientId, items e notes", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = {
      _id: "o1", clientId: "c1", notes: "Obs",
      representativeId: { toString: () => adminUser.id },
      items: [{ productId: "p1", quantity: 100 }, { productId: "p2", quantity: 200 }],
    };
    Order.findById.mockResolvedValue(mockOrder);
    await getDuplicateOrderTemplate(req, res);
    expect(res.json).toHaveBeenCalledWith({
      clientId: "c1",
      items: [{ productId: "p1", quantity: 100 }, { productId: "p2", quantity: 200 }],
      notes: "Obs",
    });
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await getDuplicateOrderTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// getOrderPdf
describe("getOrderPdf", () => {
  beforeEach(() => jest.clearAllMocks());

  it("403 quando usuario nao e admin", async () => {
    const req = { params: { id: "o1" }, user: repUser };
    const res = makeRes();
    await getOrderPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Apenas administradores podem gerar o PDF do pedido" });
  });

  it("404 quando pedido nao existe", async () => {
    const req = { params: { id: "x" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockResolvedValue(null);
    await getOrderPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("chama generateOrderPdf quando pedido existe", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    const mockOrder = { _id: "o1" };
    Order.findById.mockResolvedValue(mockOrder);
    generateOrderPdf.mockImplementation(() => {});
    await getOrderPdf(req, res);
    expect(generateOrderPdf).toHaveBeenCalledWith(mockOrder, res);
  });

  it("500 em caso de erro", async () => {
    const req = { params: { id: "o1" }, user: adminUser };
    const res = makeRes();
    Order.findById.mockRejectedValue(new Error("DB"));
    await getOrderPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

