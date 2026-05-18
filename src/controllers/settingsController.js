const Settings = require('../models/settings');
const User = require('../models/user');

/**
 * Retorna (ou cria) o documento de configurações + nome do usuário autenticado.
 *
 * Resposta:
 * {
 *   defaultObservations: string,
 *   sellerName: string   ← nome do usuário autenticado, para pré-preencher o campo
 * }
 */
async function getSettings(req, res) {
  try {
    const settings = await Settings.findOneAndUpdate(
      { singleton: true },
      { $setOnInsert: { singleton: true } },
      { upsert: true, returnDocument: 'after' },
    );

    return res.json({
      defaultObservations: settings.defaultObservations,
      defaultSellerName: settings.defaultSellerName,
      sellerName: req.user.name, // nome do usuário autenticado para pré-preencher cotações
    });
  } catch (err) {
    console.error('[getSettings]', err.message);
    return res.status(500).json({ message: 'Erro ao buscar configurações' });
  }
}

/**
 * Atualiza o texto padrão de observações.
 * Apenas admins podem alterar — representantes só lêem.
 *
 * Body: { defaultObservations: string }
 */
async function updateSettings(req, res) {
  try {
    const { defaultObservations, defaultSellerName } = req.body;

    if (defaultObservations === undefined && defaultSellerName === undefined) {
      return res.status(400).json({ message: 'Informe ao menos defaultObservations ou defaultSellerName' });
    }

    const update = {};
    if (defaultObservations !== undefined) update.defaultObservations = defaultObservations;
    if (defaultSellerName   !== undefined) update.defaultSellerName   = defaultSellerName;

    const settings = await Settings.findOneAndUpdate(
      { singleton: true },
      update,
      { upsert: true, returnDocument: 'after' },
    );

    return res.json({
      message: 'Configurações atualizadas com sucesso',
      defaultObservations: settings.defaultObservations,
      defaultSellerName: settings.defaultSellerName,
    });
  } catch (err) {
    console.error('[updateSettings]', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar configurações' });
  }
}

/**
 * Atualiza a preferência de tema do usuário autenticado.
 * Disponível para todos os perfis (admin e representante).
 *
 * Body: { themePreference: 'light' | 'dark' | 'auto' }
 */
async function updateThemePreference(req, res) {
  try {
    const { themePreference } = req.body;

    if (!['light', 'dark', 'auto'].includes(themePreference)) {
      return res.status(400).json({ message: 'themePreference deve ser "light", "dark" ou "auto"' });
    }

    await User.findByIdAndUpdate(req.user.id, { themePreference });

    return res.json({ message: 'Preferência de tema atualizada', themePreference });
  } catch (err) {
    console.error('[updateThemePreference]', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar preferência de tema' });
  }
}

module.exports = { getSettings, updateSettings, updateThemePreference };
