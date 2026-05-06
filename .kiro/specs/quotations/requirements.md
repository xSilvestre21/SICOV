# Documento de Requisitos — Orçamentos (Quotations)

## Introdução

Esta feature adiciona ao sistema a capacidade de gerar **orçamentos** para clientes cadastrados ou avulsos. Diferente de um pedido formal, o orçamento não incrementa o contador de pedidos do fornecedor, não precisa ser salvo permanentemente no banco de dados e pode ser gerado para clientes que não estão cadastrados no sistema. O resultado principal é um PDF formatado, similar ao PDF de pedido já existente, mas com o cabeçalho "ORÇAMENTO" e sem número sequencial de pedido.

## Glossário

- **Quotation_System**: O módulo de orçamentos do sistema, responsável por criar, calcular e exportar orçamentos.
- **Registered_Client**: Cliente previamente cadastrado no banco de dados com todos os seus dados (nome, CNPJ, endereço, prazo de pagamento, etc.).
- **Ad_Hoc_Client**: Cliente não cadastrado, cujos dados básicos (nome e, opcionalmente, outros campos) são informados diretamente no momento da criação do orçamento.
- **Quotation**: Documento de precificação de produtos para um cliente, gerado sem incrementar contadores de pedido e sem persistência obrigatória no banco.
- **Quotation_Item**: Linha de produto dentro de um orçamento, contendo produto, quantidade, preço unitário e subtotal.
- **PDF_Generator**: Componente responsável por gerar o arquivo PDF do orçamento.
- **Representative**: Usuário autenticado com perfil `representante` ou `admin` que cria orçamentos.
- **Supplier**: Fornecedor cadastrado no sistema, associado aos produtos do orçamento.
- **Price_Calculator**: Componente que calcula o preço unitário e subtotal de cada item com base no modo de cálculo do produto.

---

## Requisitos

### Requisito 1: Identificação do Cliente no Orçamento

**User Story:** Como representante, quero informar o cliente do orçamento digitando o nome, podendo escolher um cliente cadastrado ou preencher dados avulsos, para que o orçamento reflita corretamente os dados do destinatário.

#### Critérios de Aceitação

1. WHEN o representante informa um `clientId` válido, THE Quotation_System SHALL buscar os dados do Registered_Client no banco de dados e utilizá-los como snapshot do cliente no orçamento.
2. WHEN o representante não informa `clientId` e fornece um objeto `adHocClient` com o campo `name` preenchido, THE Quotation_System SHALL utilizar os dados do objeto `adHocClient` como snapshot do cliente no orçamento.
3. IF o representante não informa `clientId` e não fornece `adHocClient.name`, THEN THE Quotation_System SHALL retornar erro HTTP 400 com a mensagem "Nome do cliente é obrigatório".
4. IF o representante informa um `clientId` que não existe no banco de dados, THEN THE Quotation_System SHALL retornar erro HTTP 404 com a mensagem "Cliente não encontrado".
5. THE Quotation_System SHALL aceitar os seguintes campos opcionais em `adHocClient`: `tradeName`, `cnpj`, `stateRegistration`, `address`, `city`, `state`, `district`, `zipCode`, `phone`, `email`, `paymentTerm`, `notes`.

---

### Requisito 2: Composição de Itens do Orçamento

**User Story:** Como representante, quero adicionar produtos com fornecedor ao orçamento, para que o documento reflita os itens e preços corretos.

#### Critérios de Aceitação

1. WHEN o representante submete um orçamento, THE Quotation_System SHALL exigir ao menos um item na lista `items`.
2. IF a lista `items` estiver vazia ou ausente, THEN THE Quotation_System SHALL retornar erro HTTP 400 com a mensagem "Itens são obrigatórios".
3. WHEN o representante informa um `productId` em um item, THE Quotation_System SHALL buscar o produto no banco de dados e registrar um snapshot completo do produto no item do orçamento.
4. IF um `productId` informado não existir no banco de dados, THEN THE Quotation_System SHALL retornar erro HTTP 404 com a mensagem "Produto não encontrado".
5. IF os produtos informados pertencerem a fornecedores diferentes, THEN THE Quotation_System SHALL retornar erro HTTP 400 com a mensagem "Todos os produtos devem ser do mesmo fornecedor".
6. WHEN o representante informa um item com `productId` e `quantity`, THE Price_Calculator SHALL calcular o `unitPrice` e o `subtotal` do item usando o mesmo algoritmo de cálculo dos pedidos (`calculationMode` do produto).
7. IF um produto não possuir preço válido para o modo de cálculo configurado, THEN THE Quotation_System SHALL retornar erro HTTP 400 com a mensagem descritiva do erro de cálculo.
8. WHEN o representante informa um item com `productId` de um Registered_Client, THE Quotation_System SHALL aceitar o produto independentemente do `clientId` do produto cadastrado no banco.

---

### Requisito 3: Cálculo de Totais do Orçamento

**User Story:** Como representante, quero que o orçamento calcule automaticamente subtotal, IPI e total, para que os valores apresentados ao cliente sejam precisos.

#### Critérios de Aceitação

1. THE Quotation_System SHALL calcular o `subtotal` do orçamento como a soma dos `subtotal` de todos os itens.
2. THE Quotation_System SHALL calcular o `ipiValue` do orçamento como `subtotal * (ipi_do_fornecedor / 100)`.
3. THE Quotation_System SHALL calcular o `total` do orçamento como `subtotal + ipiValue`.
4. WHEN o fornecedor não possui IPI configurado, THE Quotation_System SHALL utilizar o valor `0` para o IPI no cálculo.

---

### Requisito 4: Persistência Opcional do Orçamento

**User Story:** Como representante, quero poder salvar um orçamento no banco de dados para consultá-lo posteriormente, mas também quero poder gerar apenas o PDF sem salvar, para ter flexibilidade no fluxo de trabalho.

#### Critérios de Aceitação

1. WHEN o representante cria um orçamento com `save: true`, THE Quotation_System SHALL persistir o orçamento no banco de dados e retornar o documento criado com HTTP 201.
2. WHEN o representante cria um orçamento com `save: false` ou sem o campo `save`, THE Quotation_System SHALL calcular o orçamento e retornar os dados calculados com HTTP 200, sem persistir no banco de dados.
3. THE Quotation_System SHALL nunca incrementar o `currentOrderNumber` do Supplier ao criar um orçamento, independentemente do valor de `save`.
4. WHEN um orçamento é salvo, THE Quotation_System SHALL registrar o `representativeId` do usuário autenticado no documento.

---

### Requisito 5: Geração de PDF do Orçamento

**User Story:** Como representante, quero gerar um PDF do orçamento com layout profissional específico — diferente do PDF de pedidos — para enviar propostas comerciais formatadas ao cliente.

#### Glossário adicional

- **Observations_Text**: Texto padrão editável com condições comerciais (pagamento, ICMS, PIS/COFINS, prazo de entrega, frete, validade da proposta) exibido abaixo dos totais.
- **Closing_Text**: Texto fixo de encerramento exibido após as observações ("No aguardo de um retorno positivo, coloco-me à disposição para maiores esclarecimentos").

#### Critérios de Aceitação

1. WHEN o representante solicita o PDF de um orçamento salvo via `GET /quotations/:id/pdf`, THE PDF_Generator SHALL gerar e retornar o arquivo PDF com `Content-Type: application/pdf`.
2. WHEN o representante submete os dados de um orçamento via `POST /quotations/pdf`, THE PDF_Generator SHALL gerar e retornar o PDF diretamente sem salvar o orçamento no banco de dados.
3. THE PDF_Generator SHALL utilizar o layout A4 portrait (vertical), distinto do layout landscape utilizado no PDF de pedidos.
4. THE PDF_Generator SHALL exibir no cabeçalho, no lado esquerdo, o logo do fornecedor quando o `logoUrl` do fornecedor estiver disponível e apontar para um arquivo válido.
5. IF o `logoUrl` do fornecedor não for um caminho relativo válido dentro do diretório do projeto, THEN THE PDF_Generator SHALL exibir o nome textual do fornecedor no lado esquerdo do cabeçalho, no lugar da logo.
6. THE PDF_Generator SHALL exibir no cabeçalho, no lado direito, a cidade e a data de geração por extenso no formato "{Cidade}, {DD} de {Mês por extenso} de {AAAA}".
7. THE PDF_Generator SHALL exibir, abaixo do cabeçalho, o nome da empresa cliente em destaque (negrito).
8. WHERE o campo `attn` (aos cuidados de) estiver preenchido no orçamento, THE PDF_Generator SHALL exibir a linha "A/C {nome do contato}" abaixo do nome da empresa cliente.
9. THE PDF_Generator SHALL exibir o texto introdutório fixo "Segue abaixo nossa proposta com os valores e demais condições de fornecimento" abaixo da seção do destinatário.
10. THE PDF_Generator SHALL exibir a tabela de itens com as colunas: QTDE, UN, ITEM (descrição do produto), MILHEIRO, TOTAL S/IPI, VALOR IPI, TOTAL.
11. THE PDF_Generator SHALL exibir, abaixo da tabela de itens, os totais: Subtotal s/ IPI, Total IPI e TOTAL GERAL em destaque.
12. THE PDF_Generator SHALL exibir, abaixo dos totais, o campo de observações contendo o Observations_Text com as condições comerciais do orçamento.
13. WHEN o orçamento não possuir um Observations_Text personalizado, THE PDF_Generator SHALL preencher o campo de observações com o texto padrão configurado no sistema, contendo as condições comerciais padrão do fornecedor.
14. THE PDF_Generator SHALL exibir, após o campo de observações, o Closing_Text fixo seguido do nome do representante como assinatura.
15. THE PDF_Generator SHALL nomear o arquivo PDF no formato `ORCAMENTO-{NOME_CLIENTE}-{DATA}.pdf`.

---

### Requisito 6: Busca de Produtos de Cliente Cadastrado

**User Story:** Como representante, quero buscar os produtos cadastrados de um cliente existente ao montar o orçamento, para agilizar o preenchimento dos itens.

#### Critérios de Aceitação

1. WHEN o representante informa um `clientId` e um `supplierId` válidos, THE Quotation_System SHALL retornar a lista de produtos ativos cadastrados para aquele cliente e fornecedor.
2. WHEN o representante informa apenas um `clientId` válido, THE Quotation_System SHALL retornar todos os produtos ativos cadastrados para aquele cliente, independentemente do fornecedor.
3. IF o `clientId` informado não existir no banco de dados, THEN THE Quotation_System SHALL retornar erro HTTP 404 com a mensagem "Cliente não encontrado".
4. THE Quotation_System SHALL retornar os campos necessários para montagem do orçamento: `_id`, `name`, `description`, `supplierCode`, `clientCode`, `saleMode`, `calculationMode`, `unitLabel`, `supplierId`, `technicalData`, `commercialData`, `selectedExtras`.

---

### Requisito 7: Listagem e Consulta de Orçamentos Salvos

**User Story:** Como representante, quero consultar os orçamentos que salvei anteriormente, para acompanhar propostas enviadas a clientes.

#### Critérios de Aceitação

1. WHEN o representante acessa `GET /quotations`, THE Quotation_System SHALL retornar a lista paginada de orçamentos com os campos `page`, `limit`, `total`, `totalPages` e `quotations`.
2. WHILE o usuário autenticado possui perfil `representante`, THE Quotation_System SHALL retornar apenas os orçamentos criados pelo próprio representante.
3. WHILE o usuário autenticado possui perfil `admin`, THE Quotation_System SHALL retornar todos os orçamentos do sistema.
4. WHEN o representante informa o parâmetro `search`, THE Quotation_System SHALL filtrar orçamentos pelo nome ou nome fantasia do cliente no snapshot.
5. WHEN o representante informa o parâmetro `supplierId`, THE Quotation_System SHALL filtrar orçamentos pelo fornecedor informado.
6. THE Quotation_System SHALL ordenar os resultados por data de criação decrescente.

---

### Requisito 8: Controle de Acesso

**User Story:** Como administrador do sistema, quero que apenas usuários autenticados possam criar e acessar orçamentos, para garantir a segurança das informações comerciais.

#### Critérios de Aceitação

1. IF uma requisição para qualquer rota de orçamentos não contiver um token JWT válido, THEN THE Quotation_System SHALL retornar erro HTTP 401.
2. WHEN um representante tenta acessar um orçamento salvo de outro representante via `GET /quotations/:id`, THE Quotation_System SHALL retornar erro HTTP 403 com a mensagem "Acesso negado".
3. WHILE o usuário autenticado possui perfil `admin`, THE Quotation_System SHALL permitir acesso a qualquer orçamento salvo.
