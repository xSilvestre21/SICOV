const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema(
  {
    // null quando o item é avulso (adHocProduct)
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    productSnapshot: {
      supplierCode: String,
      clientCode: String,
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

const quotationSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null, // opcional — null para clientes avulsos
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

    clientSnapshot: {
      name: { type: String, required: true },
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
      notes: String,
    },

    supplierSnapshot: {
      name: String,
      tradeName: String,
      cnpj: String,
      ipi: Number,
      logoUrl: String,
      city: String, // necessário para o cabeçalho do PDF
    },

    items: {
      type: [quotationItemSchema],
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

    attn: {
      type: String,
      trim: true,
    },

    observations: {
      type: String,
      trim: true,
    },

    sellerName: {
      type: String,
      trim: true,
      default: 'Valquiria Silvestre',
    },

    deliveryDate: {
      type: Date,
    },

    paymentTerm: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },

    // Histórico de edições — cada entrada registra quem editou, quando e o que mudou
    editHistory: [
      {
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
        // Resumo legível das alterações feitas nesta edição
        changes: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  { timestamps: true },
);

quotationSchema.index({ representativeId: 1, createdAt: -1 });
quotationSchema.index({ supplierId: 1, createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
