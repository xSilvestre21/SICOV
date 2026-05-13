const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profile: {
      type: String,
      enum: ['admin', 'representative'],
      required: true,
      default: 'representative',
    },
    active: {
      type: Boolean,
      default: true,
    },

    // Percentual padrão de comissão do representante (% da comissão total do admin)
    // Usado para criar automaticamente o Registro_Comissao ao criar um pedido
    defaultCommissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('User', userSchema);
