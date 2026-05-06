# Plano de Implementação — Orçamentos (Quotations)

## Visão Geral

Implementação incremental da feature de orçamentos seguindo os padrões já estabelecidos no projeto (controllers Express, modelos Mongoose, rotas separadas, PDFKit). A lógica de cálculo de preço `calculateProductPrice` será extraída do `orderController.js` para `src/utils/priceCalculator.js`, permitindo reutilização sem duplicação.

## Tarefas

- [x] 1. Extrair `calculateProductPrice` para utilitário compartilhado
  - Criar `src/utils/priceCalculator.js` exportando a função `calculateProductPrice` com a mesma implementação atual do `orderController.js`
  - Atualizar `src/controllers/orderController.js` para importar `calculateProductPrice` de `src/utils/priceCalculator.js` em vez de defini-la localmente
  - Verificar que todos os testes existentes do `orderController` continuam passando após a refatoração
  - _Requisitos: 2.6_

  - [x] 1.1 Atualizar testes unitários de `calculateProductPrice`
    - Mover `tests/controllers/calculateProductPrice.test.js` para `tests/utils/priceCalculator.test.js`
    - Ajustar o import para apontar para `src/utils/priceCalculator.js` diretamente (sem reimplementação local)
    - _Requisitos: 2.6_

- [x] 2. Criar o modelo Mongoose `Quotation`
  - Criar `src/models/quotation.js` com os schemas `quotationItemSchema` e `quotationSchema` conforme o design
  - `clientId` deve ser opcional (`default: null`) para suportar clientes avulsos
  - `clientSnapshot.name` deve ser `required: true`
  - `supplierSnapshot` deve incluir o campo `city` (necessário para o cabeçalho do PDF)
  - Campos adicionais em relação ao `Order`: `attn`, `observations`
  - Sem campos de pedido: `orderNumber`, `customerPurchaseOrder`, `sentToSupplier`, `sentToSupplierAt`, `sentToSupplierBy`
  - Adicionar índices: `{ representativeId: 1, createdAt: -1 }` e `{ supplierId: 1, createdAt: -1 }`
  - _Requisitos: 4.1, 4.2, 4.3, 4.4_

- [x] 3. Implementar `quotationController.js`
  - Criar `src/controllers/quotationController.js` importando `calculateProductPrice` de `src/utils/priceCalculator.js`

  - [x] 3.1 Implementar `createQuotation`
    - Validar cliente: se `clientId` fornecido → buscar `Client` no banco; se `adHocClient.name` fornecido → usar como snapshot; caso contrário → HTTP 400 "Nome do cliente é obrigatório"
    - Validar `items` não vazio (HTTP 400 "Itens são obrigatórios")
    - Para cada item: buscar `Product`, verificar mesmo `supplierId`, chamar `calculateProductPrice`, montar `productSnapshot`
    - Buscar `Supplier` para IPI e snapshot — **NÃO** incrementar `currentOrderNumber`
    - Calcular `subtotal`, `ipiValue`, `total`
    - Se `save === true`: `Quotation.create({...})` → HTTP 201; caso contrário → retornar objeto calculado → HTTP 200
    - Registrar `representativeId` do usuário autenticado quando `save === true`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Implementar `getQuotations`
    - Listagem paginada com filtros por `supplierId` e `search` (nome/tradeName do cliente no snapshot)
    - Representante vê apenas seus orçamentos (`filter.representativeId = req.user.id`)
    - Admin vê todos
    - Ordenar por `createdAt` decrescente
    - Retornar `{ page, limit, total, totalPages, quotations }`
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 3.3 Implementar `getQuotationById`
    - Buscar orçamento por ID; retornar HTTP 404 se não encontrado
    - Representante só acessa seus próprios orçamentos (HTTP 403 "Acesso negado")
    - Admin acessa qualquer orçamento
    - _Requisitos: 8.2, 8.3_

  - [x] 3.4 Implementar `getQuotationPdf`
    - Buscar orçamento salvo por ID; retornar HTTP 404 se não encontrado
    - Verificar acesso (representativeId ou admin)
    - Chamar `generateQuotationPdf(quotation, res)`
    - _Requisitos: 5.1, 8.2, 8.3_

  - [x] 3.5 Implementar `generateQuotationPdf`
    - Receber dados do orçamento diretamente no body (sem salvar no banco)
    - Montar objeto de orçamento a partir do body e chamar `generateQuotationPdf(quotationData, res)`
    - _Requisitos: 5.2_

  - [x] 3.6 Implementar `getClientProductsForQuotation`
    - Extrair `clientId` e `supplierId` (opcional) de `req.query`
    - Verificar que `Client` existe (HTTP 404 se não encontrado)
    - Montar filtro: `{ clientId, active: true, ...(supplierId && { supplierId }) }`
    - Retornar produtos com campos selecionados: `_id`, `name`, `description`, `supplierCode`, `clientCode`, `saleMode`, `calculationMode`, `unitLabel`, `supplierId`, `technicalData`, `commercialData`, `selectedExtras`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

- [x] 4. Checkpoint — Verificar lógica do controller
  - Garantir que todos os testes unitários existentes passam após as mudanças. Perguntar ao usuário se houver dúvidas.

- [x] 5. Implementar `quotationPdfGenerator.js`
  - Criar `src/utils/quotationPdfGenerator.js` usando PDFKit, layout A4 portrait (595 x 842 pt), margens 40pt
  - Reutilizar as funções `resolveLogoPath`, `formatCurrency`, `sanitize` e `formatDateFile` do `orderPdfGenerator.js` (importar diretamente ou duplicar com ajuste de `PROJECT_ROOT`)

  - [x] 5.1 Implementar cabeçalho do PDF
    - Lado esquerdo: logo do fornecedor via `resolveLogoPath(supplierSnapshot.logoUrl)` ou nome textual como fallback
    - Lado direito: cidade e data por extenso no formato `"{Cidade}, {DD} de {Mês por extenso} de {AAAA}"`
    - Abaixo do cabeçalho: título "ORÇAMENTO" em destaque
    - _Requisitos: 5.3, 5.4, 5.5, 5.6_

  - [x] 5.2 Implementar seção do destinatário e introdução
    - Nome da empresa cliente em negrito (`clientSnapshot.name` ou `tradeName`)
    - Linha "A/C {attn}" apenas quando `attn` estiver preenchido
    - Texto fixo: "Segue abaixo nossa proposta com os valores e demais condições de fornecimento"
    - _Requisitos: 5.7, 5.8, 5.9_

  - [x] 5.3 Implementar tabela de itens
    - Colunas: QTDE (45pt), UN (40pt), ITEM (185pt), MILHEIRO (65pt), TOTAL S/IPI (65pt), VALOR IPI (55pt), TOTAL (60pt)
    - Para cada item: calcular `itemIpi = (item.subtotal / quotation.subtotal) * quotation.ipiValue` e `itemTotal = item.subtotal + itemIpi`
    - Usar `productSnapshot.unitLabel` ou `saleMode` para coluna UN
    - Usar `productSnapshot.description` ou `name` para coluna ITEM
    - _Requisitos: 5.10_

  - [x] 5.4 Implementar seção de totais
    - Exibir "Subtotal s/ IPI", "Total IPI (x%)" e "TOTAL GERAL" em destaque
    - _Requisitos: 5.11_

  - [x] 5.5 Implementar seção de observações e encerramento
    - Exibir campo de observações com `quotation.observations` ou texto padrão quando ausente
    - Texto padrão: `Pagamento: {paymentTerm}\nICMS incluso no preço.\nPIS/COFINS incluso no preço.\nPrazo de entrega: {deliveryDate}\nFrete: CIF\nValidade da proposta: 5 dias úteis.`
    - Texto fixo de encerramento: "No aguardo de um retorno positivo, coloco-me à disposição para maiores esclarecimentos"
    - Nome do representante como assinatura (`quotation.sellerName`)
    - _Requisitos: 5.12, 5.13, 5.14_

  - [x] 5.6 Implementar nome do arquivo PDF
    - Formato: `ORCAMENTO-{NOME_CLIENTE_SANITIZADO}-{DD-MM-AAAA}.pdf`
    - Usar `sanitize(clientSnapshot.tradeName || clientSnapshot.name)` e `formatDateFile(new Date())`
    - _Requisitos: 5.15_

- [x] 6. Criar rotas e registrar no `app.js`
  - Criar `src/routes/quotationRoutes.js` com as 6 rotas protegidas por `authMiddleware`
  - Registrar `/quotations/client-products` **antes** de `/quotations/:id` para evitar conflito de parâmetro
  - Atualizar `app.js`: adicionar `require('./src/routes/quotationRoutes')` e `app.use('/quotations', quotationRoutes)`
  - _Requisitos: 8.1_

  ```
  POST   /quotations                    → createQuotation
  POST   /quotations/pdf                → generateQuotationPdf
  GET    /quotations                    → getQuotations
  GET    /quotations/client-products    → getClientProductsForQuotation
  GET    /quotations/:id                → getQuotationById
  GET    /quotations/:id/pdf            → getQuotationPdf
  ```

- [x] 7. Checkpoint — Verificar integração básica
  - Garantir que todos os testes existentes continuam passando. Perguntar ao usuário se houver dúvidas.

- [x] 8. Escrever testes unitários do controller
  - Criar `tests/controllers/quotationController.test.js` seguindo o padrão de `orderController.test.js`
  - Mockar: `../../src/models/quotation`, `../../src/models/product`, `../../src/models/client`, `../../src/models/supplier`, `../../src/utils/quotationPdfGenerator`, `../../src/utils/priceCalculator`

  - [x] 8.1 Testes de `createQuotation`
    - HTTP 400 quando `clientId` ausente e `adHocClient.name` ausente
    - HTTP 404 quando `clientId` não existe no banco
    - HTTP 400 quando `items` está vazio ou ausente
    - HTTP 404 quando `productId` não existe
    - HTTP 400 quando produtos são de fornecedores diferentes
    - HTTP 400 quando produto não possui preço válido (erro de `calculateProductPrice`)
    - `save: true` → chama `Quotation.create`, retorna HTTP 201
    - `save: false` → não chama `Quotation.create`, retorna HTTP 200
    - `currentOrderNumber` do fornecedor **não** é incrementado (sem `Supplier.findByIdAndUpdate`)
    - `representativeId` é o `req.user.id` quando `save: true`
    - Criação com `adHocClient` → `clientSnapshot` usa dados do `adHocClient`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 2.5, 2.7, 4.1, 4.2, 4.3, 4.4_

  - [x] 8.2 Testes de `getQuotations`
    - Representante vê apenas seus orçamentos (filtro por `representativeId`)
    - Admin vê todos (sem filtro por `representativeId`)
    - Filtra por `supplierId` quando informado
    - Filtra por `search` (regex em `clientSnapshot.name` e `tradeName`)
    - _Requisitos: 7.2, 7.3, 7.4, 7.5_

  - [x] 8.3 Testes de `getQuotationById`
    - HTTP 404 quando orçamento não existe
    - HTTP 403 quando representante tenta acessar orçamento de outro
    - Representante acessa seu próprio orçamento com sucesso
    - Admin acessa qualquer orçamento
    - _Requisitos: 8.2, 8.3_

  - [x] 8.4 Testes de `getClientProductsForQuotation`
    - HTTP 404 quando `clientId` não existe
    - Retorna produtos filtrados por `clientId` e `active: true`
    - Filtra por `supplierId` quando informado
    - _Requisitos: 6.1, 6.2, 6.3_

- [x] 9. Escrever testes de propriedade (PBT)
  - Instalar `fast-check` como devDependency: `npm install --save-dev fast-check`
  - Criar `tests/controllers/quotationController.property.test.js`
  - Cada teste usa `fc.assert(fc.property(...), { numRuns: 100 })`
  - Cada teste inclui o comentário de tag: `// Feature: quotations, Property N: <texto>`

  - [x] 9.1 Property 1 — subtotal é soma dos itens
    - **Property 1: Invariante de cálculo — subtotal é soma dos itens**
    - Gerar array aleatório de itens com `subtotal` numérico positivo; verificar que a soma dos subtotais individuais é igual ao `subtotal` do orçamento calculado
    - **Validates: Requisito 3.1**

  - [x] 9.2 Property 2 — ipiValue e total
    - **Property 2: Invariante de cálculo — ipiValue e total**
    - Gerar `subtotal` e `ipi` aleatórios; verificar que `ipiValue = subtotal * (ipi / 100)` e `total = subtotal + ipiValue`; quando `ipi = 0`, verificar que `ipiValue = 0` e `total = subtotal`
    - **Validates: Requisitos 3.2, 3.3, 3.4**

  - [x] 9.3 Property 3 — snapshot do cliente é imutável após criação
    - **Property 3: Snapshot do cliente é imutável após criação**
    - Criar orçamento com `save: true`; modificar o cliente no banco; buscar o orçamento salvo; verificar que `clientSnapshot` permanece idêntico ao momento da criação
    - **Validates: Requisitos 1.1, 1.2**

  - [x] 9.4 Property 4 — snapshot do produto é fiel ao produto original
    - **Property 4: Snapshot do produto é fiel ao produto original**
    - Para qualquer produto com campos aleatórios válidos, verificar que `productSnapshot` no item do orçamento contém os mesmos valores de `supplierCode`, `clientCode`, `name`, `description`, `saleMode`, `calculationMode`, `unitLabel`, `technicalData`, `commercialData`
    - **Validates: Requisito 2.3**

  - [x] 9.5 Property 5 — cálculo de preço é consistente com `calculateProductPrice`
    - **Property 5: Cálculo de preço é consistente com calculateProductPrice**
    - Para qualquer produto com modo de cálculo válido e quantidade positiva, verificar que `unitPrice` e `subtotal` do item no orçamento são idênticos ao resultado direto de `calculateProductPrice(product, quantity)`
    - **Validates: Requisito 2.6**

  - [x] 9.6 Property 6 — `currentOrderNumber` nunca é incrementado
    - **Property 6: currentOrderNumber do fornecedor nunca é incrementado**
    - Verificar que `Supplier.findByIdAndUpdate` nunca é chamado com `$inc: { currentOrderNumber: 1 }` durante a criação de orçamento, independentemente do valor de `save`
    - **Validates: Requisito 4.3**

  - [x] 9.7 Property 7 — `representativeId` é sempre o usuário autenticado
    - **Property 7: representativeId é sempre o usuário autenticado**
    - Para qualquer usuário autenticado com `id` aleatório, verificar que o orçamento salvo com `save: true` tem `representativeId` igual ao `req.user.id`
    - **Validates: Requisito 4.4**

  - [x] 9.8 Property 8 — isolamento de acesso por representante
    - **Property 8: Isolamento de acesso por representante**
    - Para qualquer par de IDs de representantes distintos A e B, verificar que a tentativa de A acessar um orçamento de B retorna HTTP 403
    - **Validates: Requisito 8.2**

  - [x] 9.9 Property 9 — listagem filtra por representante autenticado
    - **Property 9: Listagem filtra por representante autenticado**
    - Para qualquer representante autenticado com perfil `representante`, verificar que todos os orçamentos retornados por `getQuotations` têm `representativeId` igual ao ID do usuário autenticado
    - **Validates: Requisito 7.2**

  - [x] 9.10 Property 10 — filtro de produtos por cliente e fornecedor
    - **Property 10: Filtro de produtos por cliente e fornecedor**
    - Para qualquer combinação de `clientId` e `supplierId` válidos, verificar que todos os produtos retornados por `getClientProductsForQuotation` têm `active: true`, `clientId` igual ao informado e, quando `supplierId` fornecido, `supplierId` igual ao informado
    - **Validates: Requisitos 6.1, 6.2**

- [x] 10. Escrever testes de integração
  - Criar `tests/integration/quotations.test.js` seguindo o padrão de `orders.test.js`
  - Usar `connectDB`, `clearDB`, `disconnectDB` de `tests/integration/setup.js`
  - Adicionar helper `createQuotation` em `tests/integration/helpers.js` para reutilização

  - [x] 10.1 Testes de `POST /quotations`
    - `save: true` → documento persistido no banco, HTTP 201, `currentOrderNumber` não incrementado
    - `save: false` → sem documento no banco, HTTP 200
    - Com `clientId` válido → `clientSnapshot` correto
    - Com `adHocClient` → `clientSnapshot` usa dados avulsos
    - HTTP 400 sem cliente
    - HTTP 400 com `items` vazio
    - HTTP 401 sem autenticação
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2, 4.3, 8.1_

  - [x] 10.2 Testes de `POST /quotations/pdf`
    - Retorna PDF válido (`Content-Type: application/pdf`) sem salvar no banco
    - _Requisitos: 5.2_

  - [x] 10.3 Testes de `GET /quotations`
    - Paginação e campos de resposta corretos
    - Representante vê apenas seus orçamentos
    - Admin vê todos
    - Filtro por `supplierId`
    - Filtro por `search`
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 10.4 Testes de `GET /quotations/:id`
    - Retorna orçamento por ID
    - HTTP 403 quando representante tenta acessar orçamento de outro
    - Admin acessa qualquer orçamento
    - _Requisitos: 8.2, 8.3_

  - [x] 10.5 Testes de `GET /quotations/:id/pdf`
    - Retorna PDF válido (`Content-Type: application/pdf`)
    - HTTP 403 quando representante tenta acessar PDF de orçamento de outro
    - _Requisitos: 5.1, 8.2_

  - [x] 10.6 Testes de `GET /quotations/client-products`
    - Retorna produtos do cliente filtrados corretamente
    - Filtra por `supplierId` quando informado
    - HTTP 404 quando `clientId` não existe
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

- [x] 11. Checkpoint final — Garantir que todos os testes passam
  - Executar `npm test` e verificar que todos os testes (unitários, de propriedade e de integração) passam sem erros. Perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- A extração de `calculateProductPrice` (tarefa 1) é um pré-requisito para as tarefas 3 e 9.5
- O modelo `Quotation` (tarefa 2) é um pré-requisito para as tarefas 3, 8 e 10
- O gerador de PDF (tarefa 5) é um pré-requisito para as tarefas 6, 10.2 e 10.5
- `fast-check` deve ser instalado antes de executar os testes de propriedade (tarefa 9)
- Os testes de integração usam `mongodb-memory-server` já configurado no projeto
