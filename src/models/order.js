const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    productSnapshot: {
      name: String,
      description: String,
      productType: String,
      material: String,
      saleMode: String,
      calculationMode: String,
      unitLabel: String,
      technicalData: Object,
      commercialData: Object,
      selectedExtras: Array,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      unique: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },

    representativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    deliveryDate: {
      type: Date,
    },

    customerPurchaseOrder: {
      type: String,
      trim: true,
    },

    paymentTerm: {
      type: String,
      trim: true,
    },

    sellerName: {
      type: String,
      trim: true,
      default: 'Valquiria Silvestre',
    },

    clientSnapshot: {
      name: String,
      tradeName: String,
      cnpj: String,
      stateRegistration: String,
      address: String,
      city: String,
      state: String,
      district: String,
      zipCode: String,
      phone: String,
      email: String,
      paymentTerm: String,
      billingAddress: String,
      carrier: String,
      notes: String,
    },

    supplierSnapshot: {
      name: String,
      tradeName: String,
      cnpj: String,
      stateRegistration: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      phone: String,
      email: String,
      ipi: Number,
      logoUrl: String,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },

    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },

    ipiValue: {
      type: Number,
      required: true,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },

    sentToSupplier: {
      type: Boolean,
      default: false,
    },

    sentToSupplierAt: {
      type: Date,
    },

    sentToSupplierBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

orderSchema.index({ supplierId: 1, orderNumber: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
