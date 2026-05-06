jest.mock("../../src/models/order");
jest.mock("../../src/models/product");
jest.mock("../../src/models/client");
jest.mock("../../src/models/supplier");
jest.mock("../../src/utils/orderPdfGenerator");

const Order    = require("../../src/models/order");
const Product  = require("../../src/models/product");
const Client   = require("../../src/models/client");
const Supplier = require("../../src/models/supplier");
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

  it("representante ve apenas seus pedidos", async () => {
    const req = { query: {}, user: repUser };
    const res = makeRes();
    mockFind();
    await getOrders(req, res);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ representativeId: repUser.id }));
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
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => "outroRepId" } });
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
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => "outroRepId" }, status: "active", sentToSupplier: false, supplierId: { toString: () => "s1" } });
    await updateOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
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
    Order.findById.mockResolvedValue({ _id: "o1", representativeId: { toString: () => "outroRepId" }, items: [] });
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

