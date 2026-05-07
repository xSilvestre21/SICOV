# Design — Módulo de Comissões

## Visão Geral

O módulo de comissões é implementado como um conjunto de novos arquivos seguindo exatamente os padrões já estabelecidos no projeto: modelo Mongoose, controller com funções nomeadas, rotas Express com middlewares `authMiddleware` e `isAdmin`.

Os percentuais de comissão são armazenados **diretamente em cada `Registro_Comissao`**. Alterar o percentual de um registro afeta apenas aquele registro — não existe propagação em massa para outros pedidos do mesmo período.

---

## Estrutura de Arquivos

```
src/
  models/
    commission.js           ← Registro_Comissao
  controllers/
    commissionController.js
  routes/
    commissionRoutes.js
```

O arquivo `app.js` receberá o registro da nova rota `/api/commissions`.

---

## Modelo de Dados

### `commission.js` — Registro_Comissao

```js
{
  orderId:              ObjectId → Order   // pedido de referência (obrigatório)
  representativeId:     ObjectId → User    // representante do pedido (obrigatório)

  // Valores base
  orderValueWithoutIpi: Number             // Valor_Pedido_Sem_IPI (snapshot do pedido no momento da criação)
  realReceivedValue:    Number | null      // Valor_Real_Recebido (preenchido pelo Admin; null = não informado)

  // Percentuais aplicados (editáveis individualmente pelo Admin)
  representativePercentage: Number         // Percentual_Comissao_Representante (obrigatório na criação)
  adminPercentage:          Number         // Percentual_Comissao_Admin (padrão: 5)

  // Comissões calculadas (derivadas automaticamente)
  representativeCommission: Number         // Comissao_Calculada do Representante
  adminCommission:          Number         // Comissao_Calculada do Admin

  // Período (mês/ano derivado da deliveryDate do pedido ou da dueDate da parcela)
  period: {
    month: Number   // 1–12
    year:  Number
  }

  // Data de entrega real (opcional, preenchida pelo Admin)
  realDeliveryDate: Date | null

  // Parcelamento projetado
  projected:        Boolean        // true = parcela projetada
  dueDate:          Date | null    // data de vencimento da parcela (apenas projected: true)
  parentOrderId:    ObjectId | null // pedido original (apenas projected: true)
  installmentIndex: Number | null  // índice da parcela, 1-based (apenas projected: true)

  timestamps: createdAt, updatedAt
}
```

**Índices:**
- `{ representativeId: 1, 'period.year': -1, 'period.month': -1 }`
- `{ orderId: 1 }`

---

## Endpoints

### Registros de Comissão

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `POST` | `/api/commissions` | Admin | Cria um Registro_Comissao para um pedido |
| `GET` | `/api/commissions` | Admin + Representante | Lista registros (Admin vê todos; Representante vê os seus) |
| `GET` | `/api/commissions/:id` | Admin + Representante | Busca um registro por ID |
| `PUT` | `/api/commissions/:id` | Admin | Atualiza campos editáveis do registro |
| `DELETE` | `/api/commissions/:id` | Admin | Remove um registro |
| `POST` | `/api/commissions/:id/installments` | Admin | Projeta parcelas a partir de `Intervalos_Parcelamento` |

> Não existe endpoint separado de configuração de percentuais. Os percentuais são informados na criação e editados via `PUT /:id`.

---

## Lógica de Negócio

### Criação de um Registro_Comissao (`POST /api/commissions`)

**Payload:**
```json
{
  "orderId": "<ObjectId>",
  "representativePercentage": 50,
  "adminPercentage": 5,          // opcional — padrão: 5
  "realReceivedValue": 1500.00,  // opcional
  "realDeliveryDate": "2026-04-10" // opcional
}
```

**Fluxo:**
1. Busca o pedido (`Order`) pelo `orderId`. Retorna 404 se não encontrado.
2. Extrai `subtotal` (= `Valor_Pedido_Sem_IPI`) e `representativeId` do pedido.
3. Valida que `representativePercentage` foi informado e é um número ≥ 0. Retorna 400 se inválido.
4. Determina a base de cálculo: `realReceivedValue` se informado, senão `subtotal`.
5. Calcula o pool: `pool = base × adminPercentage / 100`.
6. Calcula `representativeCommission = pool × representativePercentage / 100`.
7. Calcula `adminCommission = pool − representativeCommission`.
8. Determina o `period` a partir da `deliveryDate` do pedido.
9. Persiste o `Registro_Comissao` com `projected: false`.

**Exemplo:** pedido R$10.000, adminPercentage=5%, representativePercentage=50%
- pool = R$500
- representativeCommission = R$250
- adminCommission = R$250

---

### Atualização de um Registro_Comissao (`PUT /api/commissions/:id`)

**Payload (todos opcionais):**
```json
{
  "representativePercentage": 60.0,
  "adminPercentage": 6.0,
  "realReceivedValue": 1400.00,
  "realDeliveryDate": "2026-04-15"
}
```

**Fluxo:**
1. Busca o registro pelo `id`. Retorna 404 se não encontrado.
2. Aplica os campos informados.
3. Se qualquer um dos campos `representativePercentage`, `adminPercentage` ou `realReceivedValue` for alterado, recalcula usando a lógica de dois níveis:
   - `base = realReceivedValue ?? orderValueWithoutIpi`
   - `pool = base × adminPercentage / 100`
   - `representativeCommission = pool × representativePercentage / 100`
   - `adminCommission = pool − representativeCommission`
4. A alteração afeta **somente este registro** — nenhum outro registro é tocado.
5. Persiste.

---

### Parcelamento Projetado (`POST /api/commissions/:id/installments`)

**Payload:**
```json
{
  "intervals": [28, 35, 42],
  "representativePercentage": 50,   // percentual do representante sobre o pool
  "adminPercentage": 5              // opcional — padrão: 5
}
```

**Validações:**
- `intervals` não pode ser vazio → 400.
- Todos os valores de `intervals` devem ser inteiros positivos → 400.
- `representativePercentage` é obrigatório → 400 se ausente.

**Fluxo:**
1. Busca o `Registro_Comissao` pai pelo `id`. Retorna 404 se não encontrado.
2. Busca o pedido original para obter a `deliveryDate`.
3. Calcula o `Saldo_Pendente`: `orderValueWithoutIpi - (realReceivedValue ?? 0)`. Se `realReceivedValue` não foi informado, o saldo é o valor total do pedido.
4. Divide o `Saldo_Pendente` igualmente: `valorParcela = saldo / intervals.length`.
5. Para cada intervalo:
   - `dueDate = deliveryDate do pedido + intervalo em dias`
   - `period = { month: dueDate.getMonth()+1, year: dueDate.getFullYear() }`
   - `pool = valorParcela × adminPercentage / 100`
   - `representativeCommission = pool × representativePercentage / 100`
   - `adminCommission = pool − representativeCommission`
   - Cria um `Registro_Comissao` com `projected: true`, `parentOrderId`, `installmentIndex` e `dueDate`.
6. Retorna os registros criados.

---

### Listagem (`GET /api/commissions`)

**Query params suportados:**
- `representativeId` (Admin apenas — ignorado para Representante)
- `month`, `year` — filtra por período
- `projected` — `true` | `false`
- `page`, `limit` — paginação (padrão: page=1, limit=20)

**Controle de acesso:**
- Admin: sem restrição de `representativeId` (a menos que filtre explicitamente).
- Representante: `representativeId` é forçado para o próprio ID; campos `realReceivedValue`, `adminCommission` e `adminPercentage` são omitidos da resposta.

---

## Controle de Acesso — Resumo

| Operação | Admin | Representante |
|----------|-------|---------------|
| Criar Registro_Comissao | ✅ | ❌ 403 |
| Editar Registro_Comissao (incluindo percentuais) | ✅ | ❌ 403 |
| Excluir Registro_Comissao | ✅ | ❌ 403 |
| Listar próprios registros | ✅ | ✅ (somente leitura, campos restritos) |
| Listar registros de outro Representante | ✅ | ❌ 403 |
| Projetar parcelas | ✅ | ❌ 403 |

---

## Campos Retornados por Perfil

### Admin
Todos os campos:
`orderId`, `representativeId`, `period`, `orderValueWithoutIpi`, `realReceivedValue`, `representativePercentage`, `adminPercentage`, `representativeCommission`, `adminCommission`, `realDeliveryDate`, `projected`, `dueDate`, `parentOrderId`, `installmentIndex`

### Representante
Campos visíveis:
`orderId`, `period`, `orderValueWithoutIpi`, `representativePercentage`, `representativeCommission`, `realDeliveryDate`, `projected`, `dueDate`, `parentOrderId`, `installmentIndex`

Campos **omitidos**: `realReceivedValue`, `adminPercentage`, `adminCommission`

---

## Integração com `app.js`

```js
const commissionRoutes = require('./src/routes/commissionRoutes');
app.use('/api/commissions', commissionRoutes);
```

---

## Considerações de Consistência

- **Percentuais são por registro, não por período.** Alterar o percentual de um `Registro_Comissao` afeta apenas aquele registro. Não existe propagação automática para outros pedidos.
- O `Periodo` é sempre derivado da `deliveryDate` do pedido (registros normais) ou da `dueDate` calculada (parcelas projetadas). O `realDeliveryDate` não afeta o período.
- `orderValueWithoutIpi` é um snapshot do `subtotal` do pedido no momento da criação do registro — não muda se o pedido for editado depois.
- Parcelas projetadas mantêm `parentOrderId` e `installmentIndex` para rastreabilidade completa.
