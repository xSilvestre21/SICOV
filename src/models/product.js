const mongoose = require('mongoose');

const selectedExtraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    chargeType: {
      type: String,
      enum: [
        'per_kg',
        'per_thousand',
        'per_unit',
        'per_box',
        'per_linear_meter',
        'fixed',
      ],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      enum: ['supplier', 'manual'],
      required: true,
      default: 'manual',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
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

    supplierCode: {
      type: String,
      trim: true,
    },

    clientCode: {
      type: String,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    productType: {
      type: String,
      enum: ['plastic_bag', 'tape', 'stretch', 'shrink', 'bobbin', 'custom'],
      required: true,
    },

    material: {
      type: String,
      trim: true,
    },

    saleMode: {
      type: String,
      enum: ['kg', 'thousand', 'unit', 'box', 'linear_meter', 'manual'],
      required: true,
    },

    calculationMode: {
      type: String,
      enum: [
        'dimensions_density_factor',
        'weight_times_price_per_kg',
        'quantity_times_unit_price',
        'boxes_times_units_per_box_times_unit_price',
        'boxes_times_box_price',
        'manual_price',
      ],
      required: true,
    },

    unitLabel: {
      type: String,
      trim: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    technicalData: {
      measurements: {
        width: { type: Number, min: 0 },
        length: { type: Number, min: 0 },
        thickness: { type: Number, min: 0 },
        gusset: { type: Number, min: 0 },
        height: { type: Number, min: 0 },
        diameter: { type: Number, min: 0 },
        weight: { type: Number, min: 0 },
      },

      unitsPerBox: {
        type: Number,
        min: 0,
      },
    },

    commercialData: {
      basePrice: {
        type: Number,
        min: 0,
      },
      density: {
        type: Number,
        min: 0,
      },
      factorKg: {
        type: Number,
        min: 0,
      },
      unitPrice: {
        type: Number,
        min: 0,
      },
      boxPrice: {
        type: Number,
        min: 0,
      },
    },

    selectedExtras: {
      type: [selectedExtraSchema],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Product', productSchema);
