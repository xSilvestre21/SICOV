const mongoose = require('mongoose');

const priceTableItemSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      trim: true,
    },
    density: {
      type: Number,
      min: 0,
    },
    factorKg: {
      type: Number,
      min: 0,
    },
    weightFrom: {
      type: Number,
      min: 0,
    },
    weightTo: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const supplierExtraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    chargeType: {
      type: String,
      enum: ['per_kg', 'per_thousand', 'per_unit', 'per_box', 'per_linear_meter', 'fixed'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tradeName: {
      type: String,
      trim: true,
    },
    cnpj: {
      type: String,
      trim: true,
      unique: true,
    },
    stateRegistration: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
      maxlength: 2,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    currentOrderNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    ipi: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceTable: {
      type: [priceTableItemSchema],
      default: [],
    },
    extras: {
      type: [supplierExtraSchema],
      default: [],
    },
    minimumOrderTable: {
      type: [{
        measureFrom: { type: Number, min: 0 },
        measureTo: { type: Number, min: 0 },
        minimumKg: { type: Number, required: true, min: 0 },
      }],
      default: [],
    },
    allowedRepresentatives: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Supplier', supplierSchema);
