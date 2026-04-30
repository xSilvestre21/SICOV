const Client = require('../models/client');

function onlyNumbers(value) {
  return value ? value.replace(/\D/g, '') : '';
}

async function createClient(req, res) {
  try {
    const {
      name,
      tradeName,
      email,
      phone,
      address,
      city,
      state,
      district,
      zipCode,
      cnpj,
      stateRegistration,
      paymentTerm,
      billingAddress,
      carrier,
      notes,
      representativeId,
    } = req.body;
    if (!name) {
      return res.status(400).json({
        message: 'Nome é obrigatório',
      });
    }

    const client = await Client.create({
      name,
      tradeName,
      email,
      phone: onlyNumbers(phone),
      address,
      city,
      state: state ? state.toUpperCase() : '',
      district,
      zipCode: onlyNumbers(zipCode),
      cnpj: onlyNumbers(cnpj),
      stateRegistration: onlyNumbers(stateRegistration),
      paymentTerm,
      billingAddress,
      carrier,
      notes,
      representativeId: representativeId || req.user.id,
      active: true,
    });

    return res.status(201).json({
      message: 'Cliente criado com sucesso',
      client,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Falha ao criar o cliente',
      error: err.message,
    });
  }
}

async function getClients(req, res) {
  try {
    const {
      active,
      representativeId,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (req.user.profile !== 'admin') {
      filter.representativeId = req.user.id;
    }

    if (req.user.profile === 'admin' && representativeId) {
      filter.representativeId = representativeId;
    }

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      filter.$or = [
        { name: searchRegex },
        { tradeName: searchRegex },
        { cnpj: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
      ];
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ name: 1 }).skip(skip).limit(limitNumber),

      Client.countDocuments(filter),
    ]);

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      clients,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao obter clientes',
      error: err.message,
    });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;

    let client;

    if (req.user.profile === 'admin') {
      client = await Client.findById(id);
    } else {
      client = await Client.findOne({
        _id: id,
        representativeId: req.user.id,
      });
    }

    if (!client) {
      return res.status(404).json({
        message: 'Cliente não encontrado',
      });
    }

    return res.json(client);
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao buscar cliente',
      error: err.message,
    });
  }
}

async function updateClient(req, res) {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        message: 'Cliente não encontrado.',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      client.representativeId.toString() !== req.user.id
    ) {
      return res.status(404).json({
        message: 'Acesso negado.',
      });
    }

    const {
      name,
      tradeName,
      email,
      phone,
      address,
      city,
      state,
      district,
      zipCode,
      cnpj,
      stateRegistration,
      paymentTerm,
      billingAddress,
      carrier,
      notes,
    } = req.body;

    client.name = name !== undefined ? name : client.name;
    client.tradeName = tradeName !== undefined ? tradeName : client.tradeName;
    client.email = email !== undefined ? email : client.email;
    client.phone = phone !== undefined ? onlyNumbers(phone) : client.phone;
    client.address = address !== undefined ? address : client.address;
    client.city = city !== undefined ? city : client.city;
    client.state = state !== undefined ? state.toUpperCase() : client.state;
    client.district = district !== undefined ? district : client.district;
    client.zipCode =
      zipCode !== undefined ? onlyNumbers(zipCode) : client.zipCode;
    client.cnpj = cnpj !== undefined ? onlyNumbers(cnpj) : client.cnpj;
    client.stateRegistration =
      stateRegistration !== undefined
        ? onlyNumbers(stateRegistration)
        : client.stateRegistration;
    client.paymentTerm =
      paymentTerm !== undefined ? paymentTerm : client.paymentTerm;
    client.billingAddress =
      billingAddress !== undefined ? billingAddress : client.billingAddress;
    client.carrier = carrier !== undefined ? carrier : client.carrier;
    client.notes = notes !== undefined ? notes : client.notes;

    await client.save();

    return res.json({
      message: 'Cliente atualizado com sucesso.',
      client,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar o cliente',
      error: err.message,
    });
  }
}

async function deleteClient(req, res) {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        message: 'Cliente não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      client.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    await Client.findByIdAndDelete(id);

    return res.json({
      message: `Cliente ${client.name} excluído com sucesso`,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao excluir cliente',
      error: err.message,
    });
  }
}

async function toggleClientActive(req, res) {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        message: 'Cliente não encontrado',
      });
    }

    if (
      req.user.profile !== 'admin' &&
      client.representativeId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Acesso negado',
      });
    }

    client.active = !client.active;

    await client.save();

    return res.json({
      message: client.active
        ? 'Cliente reativado com sucesso'
        : 'Cliente desativado com sucesso',
      client,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao alterar status do cliente',
      error: err.message,
    });
  }
}

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  toggleClientActive,
};
