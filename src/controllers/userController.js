const argon2 = require('argon2');
const User = require('../models/user');
const Client = require('../models/client');

async function createRepresentative(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Nome, email e senha são obrigatórios',
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: 'Já existe um usuário com esse email',
      });
    }

    const hashedPassword = await argon2.hash(password);

    const newRepresentative = await User.create({
      name,
      email,
      password: hashedPassword,
      profile: 'representative',
      active: true,
    });

    return res.status(201).json({
      message: 'Representante criado com sucesso',
      user: {
        id: newRepresentative._id,
        name: newRepresentative.name,
        email: newRepresentative.email,
        profile: newRepresentative.profile,
        active: newRepresentative.active,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao criar representante',
      error: err.message,
    });
  }
}

async function getRepresentatives(req, res) {
  try {
    const { active } = req.query;

    const filter = {
      profile: 'representative',
    };

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    const representatives = await User.find(filter).select(
      '_id name email profile active createdAt updatedAt',
    );

    return res.json(representatives);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao listar representantes',
      error: err.message,
    });
  }
}

async function getRepresentativeById(req, res) {
  try {
    const { id } = req.params;

    const representative = await User.findOne({
      _id: id,
      profile: 'representative',
    }).select('_id name email profile active createdAt updatedAt');

    if (!representative) {
      return res.status(404).json({
        message: 'Representante não encontrado',
      });
    }

    return res.json(representative);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao buscar representante',
      error: err.message,
    });
  }
}

async function updateRepresentative(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const representative = await User.findOne({
      _id: id,
      profile: 'representative',
    });

    if (!representative) {
      return res.status(404).json({
        message: 'Representante não encontrado',
      });
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (existingUser) {
        return res.status(409).json({
          message: 'Já existe um usuário com esse email',
        });
      }

      representative.email = normalizedEmail;
    }

    if (name !== undefined) {
      representative.name = name;
    }

    if (password !== undefined && password !== '') {
      representative.password = await argon2.hash(password);
    }

    await representative.save();

    return res.json({
      message: 'Representante atualizado com sucesso',
      user: {
        id: representative._id,
        name: representative.name,
        email: representative.email,
        profile: representative.profile,
        active: representative.active,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar representante',
      error: err.message,
    });
  }
}

async function deleteRepresentative(req, res) {
  try {
    const { id } = req.params;

    const representative = await User.findOne({
      _id: id,
      profile: 'representative',
    });

    if (!representative) {
      return res.status(404).json({
        message: 'Representante não encontrado',
      });
    }

    const linkedClient = await Client.findOne({
      representativeId: id,
    }).select('_id name');

    if (linkedClient) {
      return res.status(400).json({
        message:
          'Não é possível excluir este representante porque ele possui vínculos no sistema. Desative-o em vez de excluir.',
      });
    }

    await User.deleteOne({ _id: id });

    return res.json({
      message: `Representante ${representative.name} excluído com sucesso`,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao excluir representante',
      error: err.message,
    });
  }
}

async function toggleRepresentativeActive(req, res) {
  try {
    const { id } = req.params;

    const representative = await User.findOne({
      _id: id,
      profile: 'representative',
    });

    if (!representative) {
      return res.status(404).json({
        message: 'Representante não encontrado',
      });
    }

    representative.active = !representative.active;

    await representative.save();

    return res.json({
      message: representative.active
        ? 'Representante reativado com sucesso'
        : 'Representante desativado com sucesso',
      user: {
        id: representative._id,
        name: representative.name,
        email: representative.email,
        profile: representative.profile,
        active: representative.active,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao alterar status do representante',
      error: err.message,
    });
  }
}

module.exports = {
  createRepresentative,
  getRepresentatives,
  getRepresentativeById,
  updateRepresentative,
  deleteRepresentative,
  toggleRepresentativeActive,
};
