const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
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
    district: {
      type: String,
      trim: true,
    },
    zipCode: {
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
    paymentTerm: {
      type: String,
      trim: true,
    },
    billingAddress: {
      type: String,
      trim: true,
    },
    carrier: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    representativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Client', clientSchema);
