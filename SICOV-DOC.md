# SICOV - Sistema de Controle de Vendas
## Documentação Técnica Completa e Detalhada

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 O que é o SICOV

O SICOV (Sistema de Controle de Vendas) é uma aplicação web completa desenvolvida para automatizar e centralizar o processo comercial de uma empresa que atua como representante e revendedora de embalagens plásticas industriais. A empresa trabalha com múltiplos fornecedores de embalagens (sacos plásticos, filmes stretch, fitas adesivas, shrink, entre outros) e vende para diversos clientes industriais, tendo representantes comerciais que intermediam as negociações.

O sistema foi projetado para ser acessado de qualquer dispositivo com navegador (computadores, tablets e celulares), não exigindo instalação de software adicional nos dispositivos dos usuários finais.

### 1.2 Problema que o sistema resolve

Antes da implementação do SICOV, toda a gestão comercial era realizada manualmente através de planilhas eletrônicas e anotações. Isso gerava diversos problemas:

- **Erros de cálculo**: os preços dos produtos envolvem fórmulas complexas que consideram dimensões, densidade do material, fator por quilograma e extras, tornando o cálculo manual propenso a erros
- **Perda de informações**: orçamentos e pedidos ficavam dispersos em diferentes arquivos sem rastreabilidade
- **Dificuldade no controle de comissões**: calcular manualmente quanto cada representante deveria receber era trabalhoso e impreciso
- **Falta de visibilidade**: sem indicadores centralizados, era difícil saber quais clientes mais compravam, qual fornecedor gerava mais receita, ou qual representante tinha melhor desempenho
- **Retrabalho**: gerar PDFs de pedidos manualmente consumia tempo que poderia ser usado em vendas

### 1.3 Perfis de Usuário

O sistema possui dois perfis com permissões distintas:

**Administradora**: possui acesso irrestrito a todas as funcionalidades. Pode cadastrar e gerenciar clientes, fornecedores, produtos, pedidos, orçamentos e comissões. Visualiza o dashboard completo com todos os gráficos e indicadores. Pode criar e desativar representantes, configurar o sistema e realizar backups.

**Representante**: possui acesso limitado ao que lhe diz respeito. Visualiza apenas os clientes que estão vinculados a ele, os pedidos feitos para esses clientes (mesmo que tenham sido criados pela administradora), e suas próprias comissões em modo somente leitura. Pode visualizar fornecedores que estão liberados para ele, mas não pode editá-los. Não tem acesso a valores de comissão da administradora nem a dados de outros representantes.

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 O que é Arquitetura de Software

Arquitetura de software é a forma como os componentes de um sistema são organizados, como se comunicam entre si e quais responsabilidades cada um assume. Uma boa arquitetura facilita a manutenção, permite evolução do sistema e garante que problemas em uma parte não afetem as demais.

### 2.2 Arquitetura Cliente-Servidor

O SICOV utiliza a arquitetura cliente-servidor, que é o modelo mais comum na web moderna. Nesse modelo, existem dois componentes principais:

**Cliente (Frontend)**: é a interface que roda no navegador do usuário. Responsável por exibir informações, capturar interações (cliques, digitação) e enviar requisições ao servidor. No SICOV, o cliente é uma aplicação React que roda inteiramente no navegador.

**Servidor (Backend)**: é o programa que roda em um computador remoto (na nuvem). Responsável por receber requisições do cliente, processar regras de negócio, acessar o banco de dados e retornar respostas. No SICOV, o servidor é uma aplicação Node.js com Express.

A comunicação entre cliente e servidor acontece via protocolo HTTPS (HTTP seguro), usando o padrão REST (Representational State Transfer), onde cada recurso (clientes, pedidos, produtos) é acessado através de URLs específicas chamadas endpoints.

### 2.3 API REST

Uma API (Application Programming Interface) REST é uma forma padronizada de comunicação entre sistemas. No SICOV, funciona assim:

- O frontend faz uma requisição HTTP para um endpoint (ex: `GET /api/orders` para listar pedidos)
- O backend recebe, processa (consulta o banco, aplica regras) e retorna uma resposta em formato JSON
- O frontend recebe o JSON e renderiza as informações na tela

Os métodos HTTP usados são:
- **GET**: buscar dados (listar, consultar)
- **POST**: criar novos registros
- **PUT**: atualizar registros existentes (substituição completa)
- **PATCH**: atualizar parcialmente (ex: mudar apenas o status)
- **DELETE**: remover registros

### 2.4 Padrão MVC (Model-View-Controller)

O backend do SICOV é organizado segundo o padrão MVC, que separa o código em três camadas com responsabilidades distintas:

**Model (Modelo)**: define a estrutura dos dados e as regras de validação. No SICOV, cada model corresponde a uma collection do MongoDB. Por exemplo, o model de Produto define que todo produto deve ter um nome, um cliente vinculado, um fornecedor, um modo de cálculo, entre outros campos. O Mongoose (biblioteca ORM) é responsável por garantir que os dados salvos no banco estejam de acordo com o schema definido no model.

**Controller (Controlador)**: contém a lógica de negócio. Recebe as requisições HTTP, valida os dados de entrada, executa as operações necessárias (criar pedido, calcular preço, gerar comissão) e retorna a resposta adequada. Cada entidade do sistema tem seu próprio controller (orderController, productController, etc.).

**View (Visão)**: no contexto de uma API REST, a "view" é a resposta JSON enviada ao cliente. O frontend React assume o papel de view ao renderizar os dados recebidos da API em componentes visuais.

Além dessas três camadas, o SICOV também utiliza:

**Routes (Rotas)**: arquivos que mapeiam cada URL para a função correspondente no controller. Por exemplo, a rota `GET /api/orders` é mapeada para a função `getOrders` do orderController.

**Services (Serviços)**: funções auxiliares que encapsulam lógicas complexas de agregação. O dashboardService, por exemplo, contém todas as queries de agregação do MongoDB usadas pelos gráficos do dashboard.

**Utils (Utilitários)**: funções genéricas reutilizáveis, como o motor de cálculo de preços (priceCalculator), os geradores de PDF (orderPdfGenerator, quotationPdfGenerator) e o serviço de email (mailer).

**Middlewares**: funções que interceptam a requisição antes dela chegar ao controller. O authMiddleware verifica se o token JWT é válido, o isAdmin verifica se o usuário tem perfil de administrador, e o rateLimiter controla a quantidade de requisições por IP.

### 2.5 Single Page Application (SPA)

O frontend do SICOV é uma SPA (Single Page Application). Diferente de sites tradicionais onde cada clique carrega uma página inteira do servidor, numa SPA o navegador carrega a aplicação uma única vez e, a partir daí, as navegações entre páginas acontecem instantaneamente no próprio navegador, sem recarregar a página.

Quando o usuário navega de "Pedidos" para "Clientes", o React simplesmente substitui os componentes na tela sem fazer uma nova requisição ao servidor para obter HTML. As únicas requisições feitas são para buscar dados (JSON) via API.

Isso resulta em uma experiência muito mais fluida e rápida para o usuário, similar a um aplicativo nativo.

---

## 3. TECNOLOGIAS UTILIZADAS E JUSTIFICATIVAS

### 3.1 Node.js (Runtime do Backend)

**O que é**: Node.js é um ambiente de execução que permite rodar JavaScript fora do navegador, no servidor. Tradicionalmente, JavaScript só funcionava dentro de navegadores web. O Node.js mudou isso ao incorporar o motor V8 do Google Chrome em um programa independente.

**Por que foi escolhido**:
- Permite usar JavaScript tanto no frontend quanto no backend (mesma linguagem em todo o projeto), reduzindo a complexidade e o tempo de desenvolvimento
- Possui o NPM (Node Package Manager), o maior repositório de bibliotecas de código aberto do mundo, com mais de 2 milhões de pacotes disponíveis
- Utiliza um modelo de I/O não-bloqueante baseado em eventos, ideal para aplicações web que fazem muitas operações de entrada/saída (leitura de banco de dados, chamadas de API), pois consegue atender muitas requisições simultâneas sem criar uma thread para cada uma
- É amplamente utilizado no mercado por empresas como Netflix, LinkedIn, Uber e PayPal

### 3.2 Express.js (Framework Web)

**O que é**: Express é um framework minimalista para Node.js que simplifica a criação de servidores HTTP e APIs REST. Ele fornece uma camada fina sobre o Node.js puro, adicionando funcionalidades como roteamento, middlewares e tratamento de erros.

**Por que foi escolhido**:
- É o framework Node.js mais popular e maduro, com mais de 15 anos de existência e comunidade ativa
- Minimalista e não-opinativo: não impõe uma estrutura rígida, permitindo organizar o código da forma mais adequada ao projeto
- Extensível via middlewares: funcionalidades como autenticação, CORS, rate limiting e logging são adicionadas como camadas independentes
- A versão 5 traz melhorias de performance e suporte nativo a async/await no tratamento de erros

### 3.3 MongoDB (Banco de Dados)

**O que é**: MongoDB é um banco de dados NoSQL orientado a documentos. Diferente dos bancos relacionais tradicionais (MySQL, PostgreSQL) que armazenam dados em tabelas com linhas e colunas, o MongoDB armazena dados em documentos flexíveis no formato JSON (tecnicamente BSON). Cada documento pode ter uma estrutura diferente dos demais na mesma collection.

**Por que foi escolhido**:
- **Flexibilidade de schema**: produtos no SICOV podem ter estruturas diferentes dependendo do tipo (saco plástico tem dimensões e densidade, fita adesiva tem apenas largura e comprimento, stretch tem peso por bobina). Com MongoDB, cada produto pode ter campos diferentes sem precisar de tabelas auxiliares
- **Snapshots naturais**: quando um pedido é criado, ele salva uma cópia completa dos dados do produto, cliente e fornecedor como um documento aninhado. Se alguém alterar o cadastro do produto depois, o pedido já emitido mantém os dados originais. Em bancos relacionais, isso exigiria tabelas de histórico complexas
- **Aggregation Pipeline**: MongoDB oferece um sistema poderoso de agregação de dados que funciona como uma linha de montagem, onde cada estágio transforma os dados. Isso é usado extensivamente no dashboard para calcular métricas como faturamento por cliente, desempenho de representantes e comparativo de fornecedores
- **MongoDB Atlas**: serviço de hospedagem gerenciada na nuvem que inclui backups automáticos, monitoramento, escalonamento e replicação sem necessidade de administrar servidores de banco

### 3.4 Mongoose (ODM)

**O que é**: Mongoose é uma biblioteca que funciona como intermediária entre o Node.js e o MongoDB. É classificada como ODM (Object Document Mapper) — análogo a um ORM (Object Relational Mapper) para bancos relacionais. Ela permite definir schemas (estruturas obrigatórias) para os documentos, adicionar validações, middlewares e métodos personalizados.

**Por que foi escolhido**:
- Define schemas que validam dados antes de salvar (ex: campo email deve ser string, campo ipi deve ser número >= 0)
- Previne erros ao rejeitar dados fora do formato esperado
- Facilita queries com uma API fluente (ex: `Product.find({ clientId, active: true }).populate('supplierId')`)
- Suporta population (equivalente a JOIN): ao buscar um produto, pode trazer automaticamente os dados do cliente e fornecedor vinculados

### 3.5 JWT - JSON Web Token (Autenticação)

**O que é**: JWT é um padrão aberto (RFC 7519) para transmissão segura de informações entre partes como um objeto JSON assinado digitalmente. No contexto de autenticação, funciona como um "crachá digital" que o servidor emite quando o usuário faz login, e que o cliente envia em todas as requisições seguintes para provar sua identidade.

**Como funciona no SICOV**:
1. Usuário envia email e senha para `/api/auth/login`
2. Servidor verifica credenciais e gera dois tokens: access token (válido por 4 horas) e refresh token (válido por 7 dias)
3. Frontend armazena os tokens no sessionStorage do navegador
4. Em toda requisição à API, o frontend envia o access token no header Authorization
5. Quando o access token expira, o frontend automaticamente usa o refresh token para obter um novo access token, sem que o usuário precise fazer login novamente
6. Quando o refresh token expira (ou a aba é fechada), o usuário precisa fazer login

**Por que JWT e não sessões tradicionais**: JWT é stateless — o servidor não precisa armazenar informações de sessão em memória ou banco. Toda a informação necessária (id do usuário, perfil) está dentro do próprio token. Isso simplifica o deploy e escalonamento.

### 3.6 Argon2 (Hash de Senhas)

**O que é**: Argon2 é um algoritmo de hash criptográfico projetado especificamente para senhas. Vencedor da Password Hashing Competition em 2015, é considerado o estado da arte em segurança de senhas.

**Por que foi escolhido em vez de bcrypt ou SHA-256**:
- Resistente a ataques de GPU e ASIC (hardware especializado para quebra de senhas)
- Configurável em memória e tempo de processamento
- Mais seguro que bcrypt (anterior estado da arte) contra ataques modernos
- Garante que mesmo que o banco de dados seja comprometido, as senhas não podem ser revertidas ao texto original

### 3.7 React (Frontend)

**O que é**: React é uma biblioteca JavaScript criada pelo Facebook (Meta) para construção de interfaces de usuário. Sua principal inovação é o conceito de componentes: blocos independentes e reutilizáveis que encapsulam estrutura (HTML), estilo (CSS) e comportamento (JavaScript).

**Por que foi escolhido**:
- **Componentização**: cada parte da interface é um componente isolado (Botão, Card, Sidebar, Gráfico). Isso permite reutilização e manutenção independente
- **Virtual DOM**: React mantém uma representação virtual da interface em memória e calcula a forma mais eficiente de atualizar o DOM real, resultando em performance superior
- **Estado reativo**: quando os dados mudam, a interface atualiza automaticamente (ex: ao marcar pedido como cancelado, o badge muda de cor instantaneamente)
- **Ecossistema**: maior comunidade de desenvolvedores frontend, com milhares de bibliotecas compatíveis
- **Mercado**: habilidade mais demandada para desenvolvedores frontend em 2024-2026

### 3.8 Vite (Build Tool)

**O que é**: Vite é uma ferramenta de build para projetos frontend que substitui o Webpack (anterior padrão). Utiliza ES Modules nativos do navegador durante o desenvolvimento, resultando em um servidor de desenvolvimento que inicia instantaneamente, independente do tamanho do projeto.

**Por que foi escolhido em vez de Webpack**:
- Servidor de desenvolvimento inicia em menos de 1 segundo (Webpack levaria 10-30 segundos)
- Hot Module Replacement (HMR) instantâneo: ao salvar um arquivo, a mudança aparece no navegador em milissegundos
- Build de produção otimizado com Rollup (tree-shaking, code splitting, minificação)

### 3.9 Tailwind CSS (Estilização)

**O que é**: Tailwind CSS é um framework CSS "utility-first" que fornece classes atômicas predefinidas para estilização. Em vez de escrever CSS customizado em arquivos separados, o desenvolvedor compõe estilos diretamente nos elementos usando classes como `flex`, `p-4`, `bg-blue-500`, `rounded-lg`.

**Por que foi escolhido em vez de CSS puro ou Bootstrap**:
- **Produtividade**: não é necessário inventar nomes de classes nem alternar entre arquivos CSS e HTML
- **Consistência**: classes padronizadas garantem espaçamentos, cores e tamanhos consistentes em todo o sistema
- **Responsividade integrada**: prefixos como `sm:`, `md:`, `lg:` permitem estilização condicional por tamanho de tela (ex: `grid-cols-1 md:grid-cols-2` = 1 coluna no celular, 2 no desktop)
- **Dark mode**: suporte nativo com prefixo `dark:` para estilos condicionais
- **Bundle otimizado**: em produção, apenas as classes efetivamente usadas são incluídas no CSS final, resultando em arquivos menores que frameworks como Bootstrap

### 3.10 Recharts (Gráficos)

**O que é**: Recharts é uma biblioteca de gráficos construída sobre React e D3.js. Fornece componentes React declarativos para criar visualizações de dados interativas (barras, linhas, pizza, áreas).

**Por que foi escolhido**: integração nativa com React (cada gráfico é um componente), responsivo por padrão, tooltips interativos, e suporte a múltiplos tipos de visualização necessários para o dashboard (barras verticais/horizontais, linhas, pizza).

### 3.11 Render (Hospedagem)

**O que é**: Render é uma plataforma de cloud computing que oferece hospedagem de aplicações web com deploy automático a partir do GitHub. Similar a Heroku, porém com melhor custo-benefício e infraestrutura mais moderna.

**Por que foi escolhido**:
- Deploy automático: cada push no GitHub dispara um novo build e deploy
- Zero-downtime deployment: no plano pago, a versão antiga continua rodando até a nova estar pronta
- SSL/HTTPS gratuito e automático
- Variáveis de ambiente configuráveis pelo painel
- Logs em tempo real para debugging
- Custo acessível para projetos iniciais

### 3.12 MongoDB Atlas (Banco na Nuvem)

**O que é**: Atlas é o serviço de banco de dados gerenciado da MongoDB Inc. Fornece clusters MongoDB na nuvem com backup automático, monitoramento, alertas e interface de administração.

**Por que foi escolhido em vez de hospedar o banco no próprio servidor**:
- Backups automáticos diários
- Monitoramento de performance
- Replicação para alta disponibilidade
- Escalonamento sem downtime
- Não requer conhecimento de administração de banco de dados

---

## 4. MODELO DE DADOS DETALHADO

### 4.1 O conceito de Schema e Collection

No MongoDB, os dados são organizados em **collections** (equivalente a tabelas em bancos relacionais). Cada collection armazena **documentos** (equivalente a linhas). Um documento é um objeto JSON com campos e valores.

O **schema** é a definição da estrutura que os documentos devem seguir. No SICOV, o Mongoose garante que documentos fora do schema sejam rejeitados.

### 4.2 Entidades do Sistema

**User (Usuário)**
Armazena dados de autenticação e perfil. Cada usuário é admin ou representante. O campo `password` armazena o hash Argon2 (nunca a senha em texto). O campo `themePreference` guarda a preferência de tema (claro/escuro/auto). Representantes têm `defaultCommissionPercentage` que define o percentual padrão de comissão.

**Client (Cliente)**
Representa uma empresa compradora. Vinculado a um representante via `representativeId`. Contém dados cadastrais completos (razão social, nome fantasia, CNPJ, endereço, contatos) e condições comerciais (`paymentTerm`). O campo `notes` armazena observações que aparecem automaticamente nos pedidos.

**Supplier (Fornecedor)**
Representa uma fábrica de embalagens. Contém a `priceTable` (tabela de preços por material com densidade, fator por kg e faixas de peso), `extras` (serviços adicionais como impressão), `minimumOrderTable` (pedido mínimo por faixa de medida), `ipi` (percentual de IPI específico), `allowedRepresentatives` (quais representantes podem ver este fornecedor) e `currentOrderNumber` (número sequencial do próximo pedido).

**Product (Produto)**
Representa um item específico vendido para um cliente. Está vinculado a um cliente E a um fornecedor. Possui `calculationMode` que define como o preço é calculado, `technicalData` com medidas físicas, `commercialData` com dados de preço, e `selectedExtras` com extras aplicados. O `supplierCode` e `clientCode` são códigos de referência para identificação nos documentos.

**Order (Pedido)**
Documento central do sistema. Contém `items` com `productSnapshot` (cópia dos dados do produto no momento da criação), `clientSnapshot` e `supplierSnapshot`. Possui `status` (active/cancelled), `sentToSupplier` (flag de envio), `orderNumber` (sequencial por fornecedor), `subtotal`, `ipiValue` e `total`. O conceito de snapshot garante que alterações futuras no cadastro não afetem pedidos já emitidos.

**Quotation (Orçamento)**
Similar ao pedido, mas representa uma proposta comercial antes da confirmação. Pode conter itens "ad-hoc" (produtos não cadastrados, com dados preenchidos manualmente). Possui `sellerName` (quem fez), `attn` (aos cuidados de), `observations` e `editHistory` (histórico de alterações).

**Commission (Comissão)**
Gerada automaticamente quando um pedido é criado. Registra os percentuais e valores de comissão para admin e representante. Suporta `installmentIndex` para comissões parceladas. O campo `period` (mês/ano) determina em qual período a comissão se enquadra. Possui valores previstos e reais (`realAdminCommission`, `realRepresentativeCommission`).

### 4.3 O conceito de Snapshot

Um dos conceitos mais importantes do SICOV é o **snapshot**. Quando um pedido é criado, o sistema não apenas salva referências (IDs) para o produto, cliente e fornecedor — ele salva uma **cópia completa** dos dados relevantes naquele momento.

Isso significa que se amanhã o preço de um produto mudar, ou se o endereço do cliente for atualizado, os pedidos antigos continuam mostrando os dados corretos de quando foram emitidos. No PDF do pedido, aparece o endereço que o cliente tinha naquela data, não o endereço atual.

Sem snapshots, seria necessário manter um histórico complexo de todas as alterações em todas as entidades — algo muito mais difícil de implementar e consultar.

---

## 5. MOTOR DE CÁLCULO DE PREÇOS

### 5.1 Visão Geral

O SICOV possui um motor de cálculo sofisticado que suporta 6 modalidades diferentes de precificação, refletindo a diversidade de formas como embalagens plásticas são comercializadas na indústria.

### 5.2 Modos de Cálculo

**1. Dimensões × Densidade × Fator (dimensions_density_factor)**
Usado para sacos plásticos vendidos por milheiro ou quilo. A fórmula calcula o peso por milheiro multiplicando largura × comprimento × espessura × densidade do material. O preço unitário por milheiro é esse peso multiplicado pelo fator (preço por kg negociado com o fornecedor).

Exemplo: saco 90×145×0,06 em PEAD (densidade 0,1)
- Kg/mil = 90 × 145 × 0,06 × 0,1 = 78,3 kg por milheiro
- Preço/mil = 78,3 × R$ 21,00 (fator kg) = R$ 1.644,30

**2. Peso × Preço por Kg (weight_times_price_per_kg)**
Usado quando o produto é vendido por quilograma diretamente. O preço unitário é simplesmente o preço por kg.

**3. Quantidade × Preço Unitário (quantity_times_unit_price)**
Multiplicação simples da quantidade pelo preço unitário definido.

**4. Caixas × Preço por Caixa (boxes_times_box_price)**
Usado para produtos vendidos em caixas fechadas.

**5. Caixas × Unidades/Caixa × Preço Unitário (boxes_times_units_per_box_times_unit_price)**
Variação onde o preço é por unidade, mas a venda é em caixas.

**6. Palete (pallet)**
Fórmula: quantidade por palete × peso unitário × preço por kg. Usado para produtos vendidos em paletes fechados.

### 5.3 Faixas de Peso Automáticas

Alguns fornecedores praticam preços diferenciados conforme a quantidade comprada. O SICOV suporta faixas de peso na tabela de preços: o mesmo material pode ter fatores diferentes para faixas como 0-50kg, 51-100kg e acima de 100kg. No momento do cálculo, o sistema identifica automaticamente qual faixa se aplica baseado na quantidade do pedido.

### 5.4 Extras

Extras são custos adicionais que se somam ao preço base (ex: impressão, corte especial, tratamento corona). Cada extra tem um tipo de cobrança (por kg, por milheiro, por unidade, fixo) e é aplicado proporcionalmente ao preço unitário durante o cálculo.

### 5.5 Alerta de Limite

Fornecedores definem um fator mínimo (`limitFactorKg`). Quando a administradora negocia abaixo desse limite, o sistema exibe um alerta visual informando que a comissão será reduzida para 3%.

---

## 6. SEGURANÇA DETALHADA

### 6.1 Autenticação

O sistema nunca armazena senhas em texto plano. Ao cadastrar um usuário, a senha passa pelo algoritmo Argon2 que gera um hash irreversível. Na próxima vez que o usuário tentar logar, o sistema aplica o mesmo algoritmo na senha digitada e compara os hashes.

### 6.2 Proteção contra Brute Force

Dois níveis de proteção:

**Backend (express-rate-limit)**: limita a 30 tentativas de login por IP em 15 minutos. Protege contra scripts automatizados.

**Frontend (localStorage)**: controle por email por dispositivo. Após 5 tentativas erradas para o mesmo email, o dispositivo bloqueia aquela conta por 15 minutos com countdown visual. O bloqueio persiste mesmo recarregando a página. Outras contas continuam acessíveis no mesmo dispositivo.

### 6.3 Headers de Segurança (Helmet)

O Helmet configura diversos headers HTTP que protegem contra ataques comuns:
- X-Content-Type-Options: previne MIME sniffing
- X-Frame-Options: previne clickjacking (site dentro de iframe)
- Strict-Transport-Security: força HTTPS
- X-XSS-Protection: proteção adicional contra cross-site scripting

### 6.4 CORS (Cross-Origin Resource Sharing)

O CORS define quais domínios podem fazer requisições à API. Em produção, apenas `https://sicov-b3fg.onrender.com` é permitido. Isso impede que sites maliciosos façam requisições em nome do usuário.

### 6.5 Sessão e Inatividade

Os tokens de autenticação são armazenados no `sessionStorage` do navegador (não no `localStorage`). A diferença crucial é que o sessionStorage é limpo automaticamente quando a aba do navegador é fechada, encerrando a sessão.

Adicionalmente, um timer de inatividade monitora interações do usuário (cliques, digitação, scroll). Se passarem 4 horas sem nenhuma interação, o sistema faz logout automático.

---

## 7. GERAÇÃO DE PDF

### 7.1 Como Funciona

Os PDFs são gerados no servidor usando a biblioteca PDFKit. Quando o usuário clica em "PDF", o frontend faz uma requisição ao backend que monta o documento programaticamente (posicionando textos, linhas, imagens coordenada por coordenada) e retorna o arquivo binário para download.

### 7.2 Estrutura do PDF de Pedido

- **Cabeçalho**: logo do fornecedor (carregada do arquivo local), número do pedido e data
- **Dados do Cliente**: razão social, CNPJ, endereço, telefone, email, prazo de pagamento, data de entrega, pedido do cliente
- **Observações**: notas do pedido + notas padrão do cliente
- **Tabela de Itens**: código do fornecedor, código do cliente, descrição, quantidade, unidade, preço por milheiro, total sem IPI, IPI, total com IPI
- **Totais**: subtotal, IPI (%), total geral
- **Rodapé**: nome da vendedora

### 7.3 Adaptações Inteligentes

O gerador de PDF adapta-se a nomes longos: quando a razão social é muito grande para a coluna, o sistema reduz automaticamente o tamanho da fonte ou permite quebra de linha, aumentando o espaço vertical daquela linha.

---

## 8. DASHBOARD E VISUALIZAÇÕES

### 8.1 Arquitetura do Dashboard

Cada gráfico do dashboard segue o mesmo padrão:
1. Um **hook** (`useDashboardData`) faz a requisição à API com os filtros atuais
2. Um **contexto** (`DashboardFilterContext`) compartilha os filtros globais entre todos os gráficos
3. O **controller** no backend valida os parâmetros
4. O **service** executa a aggregation pipeline no MongoDB
5. Os dados retornados são renderizados pelo componente Recharts

### 8.2 Gráficos Disponíveis

1. **Faturamento por Cliente**: barras mostrando quanto cada cliente comprou no período
2. **Comissões Overview**: evolução mensal/anual das comissões (admin e representante)
3. **Variação de Comissões**: comparativo entre períodos
4. **Desempenho dos Representantes**: pedidos, valor vendido e comissão de cada representante
5. **Top Clientes**: ranking por receita
6. **Pedidos Cancelados**: agrupados por cliente, com taxa de cancelamento
7. **Comparativo de Fornecedores**: receita, comissão e percentual por fornecedor

---

## 9. TESTES AUTOMATIZADOS

### 9.1 Por que Testar

Testes automatizados são programas que verificam se o sistema funciona corretamente. Após cada alteração no código, os testes são executados para garantir que nada quebrou. Sem testes, bugs podem ser introduzidos inadvertidamente e só descobertos em produção.

### 9.2 Tipos de Testes no SICOV

**Testes Unitários (587)**: testam funções isoladamente. Exemplo: verificar se o `calculateProductPrice` retorna o valor correto para cada modo de cálculo.

**Testes de Integração (210)**: testam fluxos completos via HTTP usando Supertest. Exemplo: criar um pedido, verificar que a comissão foi gerada corretamente, cancelar o pedido e verificar que a comissão foi cancelada.

**Testes de Propriedade**: usam a biblioteca fast-check para gerar dados aleatórios e verificar se invariantes são mantidas (ex: a taxa de cancelamento nunca pode ser maior que 100%).

### 9.3 Banco em Memória

Os testes usam o `mongodb-memory-server`, que cria um banco MongoDB temporário em memória. Isso garante que testes não dependam de um banco externo e possam rodar de forma isolada e paralela.

---

## 10. DEPLOY E ENTREGA CONTÍNUA

### 10.1 Fluxo de Deploy

1. Desenvolvedor faz alterações no código local
2. Commit via Git e push para o GitHub (branch main)
3. GitHub notifica o Render via webhook
4. Render clona o repositório e executa o build command:
   - Instala dependências do backend (`npm install`)
   - Instala dependências do frontend (`cd SICOV-WEB && npm install`)
   - Compila o frontend (`npx vite build`) gerando a pasta `dist`
5. Render inicia o servidor: `node server.js`
6. Express serve os arquivos estáticos do frontend E responde à API
7. No plano pago, a versão anterior continua rodando até a nova estar healthy (zero-downtime)

### 10.2 Configuração de Produção

Em produção, o Express:
- Serve os arquivos compilados do React (HTML, JS, CSS) em `SICOV-WEB/dist`
- Responde à API sob o prefixo `/api`
- Qualquer requisição GET que não seja `/api/*` serve o `index.html` (SPA fallback)
- Aplica rate limiting global de 500 req/min por IP
- Usa trust proxy para identificar o IP real dos usuários atrás do load balancer do Render

---

## 11. OTIMIZAÇÕES DE PERFORMANCE

### 11.1 Code Splitting

O frontend utiliza React.lazy para carregar páginas sob demanda. Em vez de enviar todo o código JavaScript de uma vez (968KB), apenas o código da página atual é carregado (bundle inicial de ~250KB). As demais páginas são carregadas conforme o usuário navega.

### 11.2 Paginação

Todas as listagens (pedidos, produtos, clientes, comissões) utilizam paginação no backend. Isso significa que ao listar produtos, o banco retorna apenas 10-20 registros por vez, não todos os milhares que possam existir.

### 11.3 Índices MongoDB

Campos frequentemente consultados possuem índices no banco (como cnpj, email, representativeId, status), acelerando drasticamente as buscas.

### 11.4 Skeleton Loading

Enquanto os dados do dashboard estão sendo carregados, são exibidos componentes visuais de placeholder (skeleton) que simulam a estrutura dos gráficos. Isso evita "pulos" de layout e dá feedback visual ao usuário de que os dados estão sendo carregados.
