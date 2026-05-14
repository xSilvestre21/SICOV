const Client = require('../models/client');
const { onlyNumbers } = require('../utils/numberParsers');

/** Valida formato básico de email. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
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

    if (email !== undefined && email !== null && email !== '' && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    // Apenas admins podem criar clientes vinculados a outro representante.
    // Representantes sempre ficam vinculados a si mesmos.
    const resolvedRepresentativeId =
      req.user.profile === 'admin' && representativeId
        ? representativeId
        : req.user.id;

    const normalizedCnpj = onlyNumbers(cnpj);

    if (normalizedCnpj) {
      const existing = await Client.findOne({ cnpj: normalizedCnpj });
      if (existing) {
        return res.status(409).json({ message: 'Já existe um cliente com esse CNPJ' });
      }
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
      cnpj: normalizedCnpj,
      stateRegistration: stateRegistration !== undefined ? stateRegistration : '',
      paymentTerm,
      billingAddress,
      carrier,
      notes,
      representativeId: resolvedRepresentativeId,
      active: true,
    });

    return res.status(201).json({
      message: 'Cliente criado com sucesso',
      client,
    });
  } catch (err) {
    console.error('[createClient]', err.message);
    return res.status(500).json({
      message: 'Falha ao criar o cliente',
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
    console.error('[getClients]', err.message);
    return res.status(500).json({
      message: 'Erro ao obter clientes',
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
    console.error('[getClientById]', err.message);
    return res.status(500).json({
      message: 'Erro ao buscar cliente',
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
      return res.status(403).json({
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
      representativeId,
    } = req.body;

    client.name = name !== undefined ? name : client.name;
    client.tradeName = tradeName !== undefined ? tradeName : client.tradeName;

    if (email !== undefined) {
      if (email !== null && email !== '' && !isValidEmail(email)) {
        return res.status(400).json({ message: 'Email inválido' });
      }
      client.email = email;
    }

    client.phone = phone !== undefined ? onlyNumbers(phone) : client.phone;
    client.address = address !== undefined ? address : client.address;
    client.city = city !== undefined ? city : client.city;
    client.state = state !== undefined ? (state ? state.toUpperCase() : '') : client.state;
    client.district = district !== undefined ? district : client.district;
    client.zipCode =
      zipCode !== undefined ? onlyNumbers(zipCode) : client.zipCode;

    if (cnpj !== undefined) {
      const normalizedCnpj = onlyNumbers(cnpj);
      if (normalizedCnpj) {
        const existing = await Client.findOne({ cnpj: normalizedCnpj, _id: { $ne: id } });
        if (existing) {
          return res.status(409).json({ message: 'Já existe um cliente com esse CNPJ' });
        }
      }
      client.cnpj = normalizedCnpj;
    }

    client.stateRegistration =
      stateRegistration !== undefined
        ? stateRegistration
        : client.stateRegistration;
    client.paymentTerm =
      paymentTerm !== undefined ? paymentTerm : client.paymentTerm;
    client.billingAddress =
      billingAddress !== undefined ? billingAddress : client.billingAddress;
    client.carrier = carrier !== undefined ? carrier : client.carrier;
    client.notes = notes !== undefined ? notes : client.notes;

    // Apenas admin pode trocar o representante
    if (representativeId !== undefined && req.user.profile === 'admin') {
      client.representativeId = representativeId;
    }

    await client.save();

    return res.json({
      message: 'Cliente atualizado com sucesso.',
      client,
    });
  } catch (err) {
    console.error('[updateClient]', err.message);
    return res.status(500).json({
      message: 'Erro ao atualizar o cliente',
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
    console.error('[deleteClient]', err.message);
    return res.status(500).json({
      message: 'Erro ao excluir cliente',
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
    console.error('[toggleClientActive]', err.message);
    return res.status(500).json({
      message: 'Erro ao alterar status do cliente',
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
