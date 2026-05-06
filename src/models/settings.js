const mongoose = require('mongoose');

/**
 * Documento único de configurações globais do sistema.
 * Sempre existe apenas um registro — identificado por { singleton: true }.
 */
const settingsSchema = new mongoose.Schema(
  {
    // Garante que só existe um documento
    singleton: {
      type: Boolean,
      default: true,
      unique: true,
    },

    // Texto padrão de observações para orçamentos.
    // Suporta \n para quebras de linha.
    defaultObservations: {
      type: String,
      trim: true,
      default:
        'Condições de pagamento: A combinar\n' +
        'I.C.M.S.: 18% (Incluso no preço acima)\n' +
        'PIS e COFINS.: (Incluso no preço acima)\n' +
        'Prazo para entrega: A combinar\n' +
        'Frete: CIF',
    },

    // Nome padrão da vendedora/administradora — aparece na assinatura dos pedidos.
    defaultSellerName: {
      type: String,
      trim: true,
      default: 'Valquiria Silvestre',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Settings', settingsSchema);
