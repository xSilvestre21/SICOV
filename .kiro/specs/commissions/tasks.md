# Plano de Implementação: Comissões

## Visão Geral

A implementação principal do módulo de comissões já está concluída (modelo, controller, rotas e testes unitários). Este plano cobre o que ainda falta: testes de integração, verificação do campo `pool` no modelo e o endpoint de resumo por período.

## Tarefas

- [x] 1. Modelo de dados (`src/models/commission.js`)
  - Modelo Mongoose completo com todos os campos definidos no design
  - Índices em `representativeId + period` e `orderId`
  - _Requisitos: 1.1, 2.1, 4.3, 5.4, 6.1_

- [x] 2. Controller (`src/controllers/commissionController.js`)
  - [x] 2.1 Implementar `createCommission` (POST /commissions)
    - Validação de `orderId` e `representativePercentage`
    - Cálculo de comissões com lógica de dois níveis (pool → rep → admin)
    - Determinação de período a partir de `deliveryDate` ou `createdAt`
    - _Requisitos: 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1_
  - [x] 2.2 Implementar `getCommissions` (GET /commissions)
    - Filtros por `representativeId`, `month`, `year`, `projected`
    - Paginação com `page` e `limit`
    - Restrição de campos sensíveis para Representante
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 7.4_
  - [x] 2.3 Implementar `getCommissionById` (GET /commissions/:id)
    - Retorno 403 quando Representante acessa registro de outro
    - Restrição de campos sensíveis para Representante
    - _Requisitos: 6.1, 6.2, 7.4, 7.6_
  - [x] 2.4 Implementar `updateCommission` (PUT /commissions/:id)
    - Recálculo automático ao alterar percentuais ou `realReceivedValue`
    - Atualização de `realDeliveryDate` sem recalcular comissões
    - _Requisitos: 1.2, 2.1, 3.1, 3.2, 4.1, 4.2, 8.1_
  - [x] 2.5 Implementar `deleteCommission` (DELETE /commissions/:id)
    - _Requisitos: 7.1_
  - [x] 2.6 Implementar `createInstallments` (POST /commissions/:id/installments)
    - Validação de `intervals` (array não vazio, inteiros positivos)
    - Cálculo de `Saldo_Pendente` e divisão igualitária por parcela
    - Cálculo de `dueDate` somando intervalo à `deliveryDate` do pedido
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 3. Rotas (`src/routes/commissionRoutes.js`) e registro em `app.js`
  - Middlewares `authMiddleware` e `isAdmin` aplicados corretamente
  - Rota `/api/commissions` registrada no `app.js`
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4. Testes unitários (`tests/controllers/commissionController.test.js`)
  - 49 testes cobrindo todos os cenários do controller
  - _Requisitos: 1.1–8.1_

- [x] 5. Verificar persistência do campo `pool` no modelo
  - [x] 5.1 Decidir e implementar persistência do campo `pool`
    - Avaliar se `pool` deve ser salvo no `Registro_Comissao` para auditoria
    - Se sim: adicionar campo `pool: { type: Number, required: true, min: 0 }` em `src/models/commission.js`
    - Atualizar `createCommission` e `updateCommission` em `src/controllers/commissionController.js` para persistir `pool` junto com `representativeCommission` e `adminCommission`
    - Atualizar `createInstallments` da mesma forma
    - _Requisitos: 4.3_

- [x] 6. Testes de integração (`tests/integration/commissions.test.js`)
  - [x] 6.1 Criar helper `createOrder` em `tests/integration/helpers.js`
    - Adicionar função `createOrder(adminToken, clientId, productId, overrides)` seguindo o padrão dos helpers existentes
    - _Requisitos: 1.1_
  - [x] 6.2 Escrever testes de integração para `POST /commissions`
    - Admin cria comissão com sucesso e verifica campos calculados (`representativeCommission`, `adminCommission`)
    - Admin cria comissão usando `realReceivedValue` como base de cálculo
    - Retorna 400 quando `orderId` está ausente
    - Retorna 400 quando `representativePercentage` está ausente
    - Retorna 404 quando pedido não existe
    - Retorna 401 sem autenticação
    - Representante não pode criar comissão (403)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 7.1, 7.5_
  - [x] 6.3 Escrever testes de integração para `GET /commissions`
    - Admin vê todos os registros
    - Representante vê apenas os seus próprios registros
    - Representante não recebe campos sensíveis (`realReceivedValue`, `adminCommission`, `adminPercentage`)
    - Filtra por `month` e `year`
    - Filtra por `projected=true`
    - Paginação retorna `page`, `limit`, `total`, `totalPages`
    - Retorna 401 sem autenticação
    - _Requisitos: 6.1, 6.2, 6.4, 7.4_
  - [x] 6.4 Escrever testes de integração para `GET /commissions/:id`
    - Admin acessa qualquer registro com todos os campos
    - Representante acessa seu próprio registro sem campos sensíveis
    - Representante recebe 403 ao acessar registro de outro
    - Retorna 404 quando ID não existe
    - _Requisitos: 6.1, 6.2, 7.4, 7.6_
  - [x] 6.5 Escrever testes de integração para `PUT /commissions/:id`
    - Admin atualiza `representativePercentage` e verifica recálculo
    - Admin atualiza `realReceivedValue` e verifica recálculo
    - Admin atualiza `realDeliveryDate` sem alterar comissões calculadas
    - Representante não pode atualizar (403)
    - Retorna 404 quando ID não existe
    - _Requisitos: 1.2, 2.1, 3.1, 3.2, 4.1, 4.2, 7.1, 8.1_
  - [x] 6.6 Escrever testes de integração para `DELETE /commissions/:id`
    - Admin remove comissão com sucesso
    - Representante não pode remover (403)
    - Retorna 404 quando ID não existe
    - _Requisitos: 7.1, 7.5_
  - [x] 6.7 Escrever testes de integração para `POST /commissions/:id/installments`
    - Admin projeta parcelas e verifica `dueDate`, `period`, `installmentIndex` e valores calculados
    - Verifica que `Saldo_Pendente` desconta `realReceivedValue` quando informado
    - Retorna 400 quando `intervals` é array vazio
    - Retorna 400 quando `intervals` contém valor não positivo
    - Representante não pode projetar parcelas (403)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1_

- [x] 7. Checkpoint — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 8. Endpoint de resumo por período (`GET /commissions/summary`)
  - [x] 8.1 Implementar `getCommissionsSummary` em `src/controllers/commissionController.js`
    - Agregar `Registro_Comissao` por mês/ano e por `representativeId`
    - Retornar totais de `representativeCommission`, `adminCommission` e contagem de registros por grupo
    - Suportar filtros opcionais: `month`, `year`, `representativeId` (Admin apenas)
    - Representante vê apenas o resumo dos seus próprios registros, sem campos de `adminCommission`
    - _Requisitos: 6.1, 6.2, 6.4, 7.4_
  - [x] 8.2 Registrar rota `GET /commissions/summary` em `src/routes/commissionRoutes.js`
    - Adicionar antes da rota `GET /:id` para evitar conflito de parâmetro
    - Aplicar `authMiddleware` (sem `isAdmin` — Representante também acessa com restrições)
    - _Requisitos: 7.4_
  - [ ]* 8.3 Escrever testes unitários para `getCommissionsSummary`
    - Admin recebe totais de todos os representantes
    - Representante recebe apenas seus próprios totais sem campos sensíveis
    - Filtra corretamente por `month` e `year`
    - _Requisitos: 6.1, 6.2, 7.4_
  - [ ]* 8.4 Escrever testes de integração para `GET /commissions/summary`
    - Criar comissões e verificar que os totais agregados estão corretos
    - Representante não recebe `adminCommission` no resumo
    - _Requisitos: 6.1, 6.2, 7.4_

- [x] 9. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- As tarefas 1–4 já estão concluídas e marcadas com `[x]`
- A tarefa 5 (campo `pool`) requer uma decisão de produto antes da implementação — se o `pool` não precisar de auditoria, pode ser omitida
- A tarefa 8 (endpoint de resumo) é uma melhoria mencionada no design; pode ser adiada se não for prioritária
- Todos os testes de integração devem seguir o padrão de `tests/integration/settings.test.js` e `tests/integration/orders.test.js`
- O helper `createOrder` deve ser adicionado em `tests/integration/helpers.js` antes de escrever os testes de integração de comissões

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["5.1", "6.1"] },
    { "id": 1, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7"] },
    { "id": 2, "tasks": ["8.1"] },
    { "id": 3, "tasks": ["8.2"] },
    { "id": 4, "tasks": ["8.3", "8.4"] }
  ]
}
```
