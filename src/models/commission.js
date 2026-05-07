const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },

    representativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Snapshot do Valor_Pedido_Sem_IPI no momento da criação
    orderValueWithoutIpi: {
      type: Number,
      required: true,
      min: 0,
    },

    // Número do pedido (snapshot para facilitar localização e filtro)
    orderNumber: {
      type: Number,
      default: null,
    },

    // PC do cliente (customerPurchaseOrder — snapshot para facilitar localização e filtro)
    customerPurchaseOrder: {
      type: String,
      trim: true,
      default: null,
    },

    // Pool de comissão (base × adminPercentage / 100)
    pool: {
      type: Number,
      required: true,
      min: 0,
    },

    // Valor efetivamente recebido (informado manualmente pelo Admin)
    realReceivedValue: {
      type: Number,
      default: null,
      min: 0,
    },

    // Percentuais aplicados (editáveis individualmente por registro)
    representativePercentage: {
      type: Number,
      required: true,
      min: 0,
    },

    adminPercentage: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },

    // Comissões calculadas com base no valor do pedido (sempre preenchidas)
    representativeCommission: {
      type: Number,
      required: true,
      min: 0,
    },

    adminCommission: {
      type: Number,
      required: true,
      min: 0,
    },

    // Comissões calculadas com base no valor real recebido (preenchidas quando realReceivedValue é informado)
    realPool: {
      type: Number,
      default: null,
      min: 0,
    },

    realRepresentativeCommission: {
      type: Number,
      default: null,
      min: 0,
    },

    realAdminCommission: {
      type: Number,
      default: null,
      min: 0,
    },

    // Período (mês/ano) derivado da deliveryDate do pedido ou da dueDate da parcela
    period: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
    },

    // Data de entrega real (opcional, preenchida pelo Admin)
    realDeliveryDate: {
      type: Date,
      default: null,
    },

    // Parcelamento projetado
    projected: {
      type: Boolean,
      default: false,
    },

    // Data de vencimento da parcela (apenas quando projected: true)
    dueDate: {
      type: Date,
      default: null,
    },

    // Pedido original (apenas quando projected: true)
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    // Índice da parcela, 1-based (apenas quando projected: true)
    installmentIndex: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { timestamps: true },
);

commissionSchema.index({ representativeId: 1, 'period.year': -1, 'period.month': -1 });
commissionSchema.index({ orderId: 1 });
commissionSchema.index({ orderNumber: 1 });
commissionSchema.index({ customerPurchaseOrder: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
