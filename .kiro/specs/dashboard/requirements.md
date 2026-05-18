# Requirements Document

## Introduction

Este documento define os requisitos para a criação de uma página de Dashboard interativa no sistema SICOV. O Dashboard fornecerá visualizações gráficas abrangentes sobre clientes, pedidos, comissões e desempenho de representantes, permitindo que o administrador analise dados financeiros e operacionais com diferentes granularidades temporais (mensal e anual) e estilos de gráficos variados (pizza, barras, linhas, entre outros).

## Glossary

- **Dashboard**: Página do sistema que exibe gráficos e indicadores visuais interativos para análise de dados.
- **Sistema_Dashboard**: Módulo frontend responsável por renderizar a página de Dashboard com gráficos interativos.
- **API_Dashboard**: Endpoints do backend que fornecem dados agregados para os gráficos do Dashboard.
- **Administrador**: Usuário com perfil "admin" que possui acesso completo a todos os dados e gráficos.
- **Representante**: Usuário com perfil "representative" que possui acesso restrito aos seus próprios dados.
- **Comissão_Admin**: Valor de comissão retido pelo administrador (adminCommission).
- **Comissão_Representante**: Valor de comissão destinado ao representante (representativeCommission).
- **Período**: Intervalo temporal (mês/ano) utilizado para agrupar dados de comissões e pedidos.
- **Filtro_Temporal**: Controle que permite ao usuário selecionar a granularidade de análise (mensal ou anual).
- **Seletor_Gráfico**: Controle que permite ao usuário alternar entre estilos de gráfico disponíveis.

## Requirements

### Requirement 1: Navegação e Acesso ao Dashboard

**User Story:** Como administrador, quero acessar uma página de Dashboard dedicada a gráficos interativos, para que eu possa analisar visualmente os dados do sistema.

#### Acceptance Criteria

1. THE Sistema_Dashboard SHALL exibir um item de navegação "Dashboard" no menu lateral da aplicação, visível para usuários com perfil Administrador e Representante
2. WHEN o Administrador clicar no item "Dashboard", THE Sistema_Dashboard SHALL renderizar a página de Dashboard contendo as seções de gráficos: Faturamento por Cliente, Receita e Comissão do Administrador, Variação de Comissões por Período, Desempenho dos Representantes, Top Clientes por Receita e Pedidos Cancelados
3. WHEN o Representante clicar no item "Dashboard", THE Sistema_Dashboard SHALL renderizar a página de Dashboard exibindo apenas as seções de gráficos cujos dados são filtrados para clientes e comissões vinculados ao próprio Representante, ocultando as seções de Desempenho comparativo entre Representantes e valores de Comissão_Admin
4. WHILE a página de Dashboard estiver carregando dados, THE Sistema_Dashboard SHALL exibir um skeleton placeholder em cada seção de gráfico com as dimensões aproximadas do gráfico final
5. IF uma ou mais requisições de dados do Dashboard falharem, THEN THE Sistema_Dashboard SHALL exibir uma mensagem de erro na seção do gráfico afetado, mantendo as demais seções funcionando independentemente
6. IF o usuário não estiver autenticado ao tentar acessar a página de Dashboard, THEN THE Sistema_Dashboard SHALL redirecionar o usuário para a página de login

### Requirement 2: Gráfico de Faturamento por Cliente

**User Story:** Como administrador, quero visualizar quanto cada cliente compra, para que eu possa identificar os clientes mais valiosos.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint que retorne o valor total de pedidos (campo subtotal, sem IPI) agrupado por cliente, excluindo pedidos com status "cancelled", ordenado do maior valor para o menor
2. WHEN o endpoint de faturamento por cliente for chamado com um Período, THE API_Dashboard SHALL retornar os dados filtrados pelo Período informado, limitados aos 20 clientes com maior valor total
3. THE Sistema_Dashboard SHALL renderizar um gráfico exibindo o valor total de compras por cliente, identificando cada cliente pelo nome fantasia (tradeName), ordenado do maior para o menor valor
4. WHEN o Administrador selecionar um estilo de gráfico diferente no Seletor_Gráfico, THE Sistema_Dashboard SHALL re-renderizar os dados no estilo selecionado (barras, pizza ou barras horizontais) sem recarregar os dados da API
5. IF nenhum dado estiver disponível para o Período selecionado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando "Nenhum dado disponível para o período selecionado"
6. IF a chamada ao endpoint de faturamento por cliente falhar, THEN THE Sistema_Dashboard SHALL exibir uma mensagem de erro indicando falha ao carregar os dados e permitir ao Administrador tentar novamente

### Requirement 3: Gráfico de Receita e Comissão do Administrador

**User Story:** Como administrador, quero visualizar quanto dinheiro e comissão os clientes geram para mim, para que eu possa acompanhar minha receita.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint que retorne o total de Comissão_Admin e o valor total de pedidos (receita bruta) agrupados por Período
2. WHEN o Administrador selecionar granularidade mensal no Filtro_Temporal, THE API_Dashboard SHALL retornar dados agrupados mês a mês dentro do ano selecionado, com um registro por mês (incluindo valor zero para meses sem dados)
3. WHEN o Administrador selecionar granularidade anual no Filtro_Temporal, THE API_Dashboard SHALL retornar dados agrupados por ano para os últimos 5 anos
4. THE Sistema_Dashboard SHALL renderizar um gráfico exibindo a evolução da Comissão_Admin ao longo do tempo, com o eixo X representando o Período e o eixo Y representando o valor monetário com 2 casas decimais
5. THE Sistema_Dashboard SHALL permitir alternar o estilo do gráfico entre linhas, barras e área empilhada por meio do Seletor_Gráfico
6. WHEN o Administrador passar o cursor sobre um ponto do gráfico, THE Sistema_Dashboard SHALL exibir um tooltip com o valor da Comissão_Admin formatado com 2 casas decimais e o Período correspondente (mês/ano ou ano, conforme a granularidade selecionada)
7. IF nenhum dado de comissão estiver disponível para o Período selecionado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando a ausência de dados para o período

### Requirement 4: Gráfico de Variação de Comissões por Período

**User Story:** Como administrador, quero analisar a variação das comissões por mês ou por ano, para que eu possa identificar tendências e sazonalidades.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint que retorne o valor total de Comissão_Admin e o valor total de Comissão_Representante agrupados por Período, onde cada item do resultado contém o período (mês/ano), o somatório de Comissão_Admin e o somatório de Comissão_Representante
2. WHEN o Administrador selecionar visualização mensal, THE Sistema_Dashboard SHALL exibir os últimos 12 meses de dados de comissão, com cada mês representado como um ponto ou barra no eixo horizontal
3. WHEN o Administrador selecionar visualização anual, THE Sistema_Dashboard SHALL exibir os dados de comissão dos últimos 5 anos, com cada ano representado como um ponto ou barra no eixo horizontal
4. THE Sistema_Dashboard SHALL exibir Comissão_Admin e Comissão_Representante como séries distintas no mesmo gráfico, diferenciadas por cores e identificadas em uma legenda visível
5. THE Sistema_Dashboard SHALL permitir alternar o estilo do gráfico entre barras agrupadas, barras empilhadas e linhas
6. WHEN o Administrador clicar em um período específico no gráfico, THE Sistema_Dashboard SHALL exibir um detalhamento contendo a lista de comissões daquele período com no mínimo: número do pedido, nome do representante, valor da Comissão_Admin, valor da Comissão_Representante e data do pedido
7. WHEN o Administrador passar o cursor sobre um período no gráfico, THE Sistema_Dashboard SHALL exibir um tooltip com o valor total de Comissão_Admin, o valor total de Comissão_Representante e o período correspondente
8. IF nenhum dado de comissão estiver disponível para o Período selecionado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando a ausência de dados para o período
9. WHEN o Administrador clicar em um período e a lista de detalhamento contiver mais de 20 registros, THE Sistema_Dashboard SHALL paginar os resultados exibindo 20 itens por página

### Requirement 5: Gráfico de Desempenho dos Representantes

**User Story:** Como administrador, quero analisar o desempenho de cada representante, para que eu possa avaliar a produtividade da equipe de vendas.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint que retorne métricas por representante (total de pedidos, valor total vendido, comissão gerada)
2. WHEN o endpoint de desempenho for chamado com um Período, THE API_Dashboard SHALL retornar os dados filtrados pelo Período informado
3. THE Sistema_Dashboard SHALL renderizar um gráfico comparativo entre representantes utilizando o valor total vendido como métrica principal de comparação
4. THE Sistema_Dashboard SHALL permitir alternar o estilo do gráfico entre barras, pizza e tabela ranking, onde a tabela ranking ordena os representantes por valor total vendido em ordem decrescente
5. THE Sistema_Dashboard SHALL exibir o nome do representante, quantidade de pedidos e valor total como informações no gráfico
6. WHEN o Administrador passar o cursor sobre a seção de um representante, THE Sistema_Dashboard SHALL exibir um tooltip com o total de pedidos, o valor total vendido e a comissão gerada daquele representante
7. IF nenhum dado de desempenho estiver disponível para o Período selecionado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando que não há dados disponíveis para o período selecionado

### Requirement 6: Gráfico de Top Clientes por Receita

**User Story:** Como administrador, quero identificar rapidamente os clientes que mais geram receita, para que eu possa priorizar o relacionamento com eles.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint que retorne os 10 clientes com maior valor total de pedidos no Período selecionado, ordenados de forma decrescente por valor, excluindo pedidos com status "cancelled"
2. THE Sistema_Dashboard SHALL renderizar um gráfico de ranking dos top clientes, exibindo os clientes em ordem decrescente de valor total de pedidos
3. THE Sistema_Dashboard SHALL permitir alternar o estilo do gráfico entre barras horizontais, pizza e treemap
4. WHEN o Administrador alterar o Período no Filtro_Temporal, THE Sistema_Dashboard SHALL atualizar o ranking de clientes em até 3 segundos após a resposta da API
5. THE Sistema_Dashboard SHALL exibir o nome fantasia do cliente e o valor total de pedidos formatado em moeda brasileira (R$) com duas casas decimais em cada elemento do gráfico
6. IF menos de 10 clientes possuírem pedidos no Período selecionado, THEN THE API_Dashboard SHALL retornar apenas os clientes existentes com pedidos no período
7. IF nenhum cliente possuir pedidos no Período selecionado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando a ausência de dados para o período selecionado no lugar do gráfico

### Requirement 7: Filtros Globais do Dashboard

**User Story:** Como administrador, quero aplicar filtros globais ao Dashboard, para que eu possa analisar dados de períodos específicos sem configurar cada gráfico individualmente.

#### Acceptance Criteria

1. THE Sistema_Dashboard SHALL exibir um painel de filtros globais no topo da página contendo o seletor de granularidade temporal, o seletor de mês e o seletor de ano
2. THE Sistema_Dashboard SHALL fornecer um seletor de granularidade temporal com as opções "Mensal" e "Anual"
3. WHEN a granularidade "Mensal" estiver selecionada, THE Sistema_Dashboard SHALL exibir um seletor de mês (janeiro a dezembro) e um seletor de ano (do ano do primeiro registro no sistema até o ano atual)
4. WHEN a granularidade "Anual" estiver selecionada, THE Sistema_Dashboard SHALL exibir apenas o seletor de intervalo de anos com valores entre o ano do primeiro registro no sistema e o ano atual
5. WHEN o Administrador alterar qualquer filtro global, THE Sistema_Dashboard SHALL disparar a atualização de todos os gráficos da página sem necessidade de ação adicional do usuário
6. THE Sistema_Dashboard SHALL inicializar os filtros com granularidade "Mensal", mês atual e ano atual como valores padrão
7. IF o mês e ano selecionados forem posteriores ao mês e ano atuais, THEN THE Sistema_Dashboard SHALL desabilitar a seleção e manter o último período válido selecionado

### Requirement 8: Seletor de Estilo de Gráfico

**User Story:** Como administrador, quero escolher diferentes estilos de gráfico para cada visualização, para que eu possa analisar os dados da forma mais adequada.

#### Acceptance Criteria

1. THE Sistema_Dashboard SHALL exibir um Seletor_Gráfico em cada seção de gráfico, apresentando os estilos disponíveis para aquela seção conforme definido nos requisitos de cada gráfico (Requisitos 2 a 6 e 11)
2. THE Sistema_Dashboard SHALL oferecer no mínimo três estilos de gráfico por seção, limitados aos estilos especificados para cada tipo de visualização nos respectivos requisitos
3. WHEN o Administrador selecionar um estilo diferente no Seletor_Gráfico, THE Sistema_Dashboard SHALL re-renderizar o gráfico no novo estilo em até 1 segundo, utilizando os dados já carregados sem realizar nova requisição à API_Dashboard
4. THE Sistema_Dashboard SHALL preservar o estilo selecionado pelo Administrador enquanto a aba do navegador permanecer aberta e o usuário não realizar logout
5. WHEN a seção de gráfico for carregada pela primeira vez, THE Sistema_Dashboard SHALL renderizar o gráfico utilizando o primeiro estilo listado no Seletor_Gráfico como estilo padrão
6. IF a renderização do gráfico no estilo selecionado falhar, THEN THE Sistema_Dashboard SHALL reverter para o estilo anterior e exibir uma mensagem de erro indicando que o estilo selecionado não pôde ser aplicado

### Requirement 9: Responsividade e Performance

**User Story:** Como administrador, quero que o Dashboard funcione bem em diferentes tamanhos de tela, para que eu possa acessá-lo de qualquer dispositivo.

#### Acceptance Criteria

1. WHEN a largura da viewport for igual ou superior a 768px, THE Sistema_Dashboard SHALL exibir os gráficos em um grid de 2 colunas, e WHEN a largura da viewport for inferior a 768px, THE Sistema_Dashboard SHALL exibir os gráficos em coluna única
2. THE Sistema_Dashboard SHALL renderizar todos os gráficos da página em até 3 segundos após o carregamento dos dados
3. WHILE os dados de um gráfico estiverem sendo carregados, THE Sistema_Dashboard SHALL exibir um skeleton placeholder que ocupe a mesma largura e altura reservada para o gráfico correspondente
4. THE API_Dashboard SHALL responder às requisições de dados agregados em até 2 segundos para conjuntos de até 10.000 registros
5. IF a API_Dashboard não responder dentro de 5 segundos, THEN THE Sistema_Dashboard SHALL exibir uma mensagem de erro indicando falha no carregamento dos dados e oferecer uma opção para tentar novamente
6. IF o conjunto de dados solicitado exceder 10.000 registros, THEN THE API_Dashboard SHALL aplicar paginação retornando no máximo 10.000 registros por requisição

### Requirement 10: Visão Individual por Cliente

**User Story:** Como administrador, quero visualizar gráficos detalhados de um cliente específico, para que eu possa analisar o histórico de compras e comissões geradas por aquele cliente.

#### Acceptance Criteria

1. WHEN o Administrador selecionar um cliente específico no Dashboard, THE Sistema_Dashboard SHALL exibir a visão individual contendo o gráfico de evolução de pedidos, o gráfico de valor total de compras por Período e o total de comissões geradas pelo cliente
2. WHILE a visão individual de um cliente estiver ativa, THE Sistema_Dashboard SHALL exibir um gráfico de evolução de pedidos do cliente selecionado considerando os últimos 12 meses (granularidade mensal) ou os últimos 5 anos (granularidade anual), conforme o Filtro_Temporal selecionado
3. WHILE a visão individual de um cliente estiver ativa, THE Sistema_Dashboard SHALL exibir um gráfico com o valor total de compras do cliente agrupado por Período (mensal ou anual), conforme o Filtro_Temporal selecionado
4. WHILE a visão individual de um cliente estiver ativa, THE Sistema_Dashboard SHALL exibir o valor numérico total de comissões geradas pelo cliente selecionado no Período filtrado, formatado em moeda (R$)
5. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/client/:clientId que retorne os dados de pedidos, valor total de compras e comissões do cliente especificado, agrupados por Período
6. IF o clientId informado não existir ou for inválido, THEN THE API_Dashboard SHALL retornar uma resposta de erro indicando que o cliente não foi encontrado
7. IF o cliente selecionado não possuir pedidos ou comissões no Período filtrado, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando que não há dados disponíveis para o período selecionado
8. WHEN um Representante acessar a visão individual de cliente, THE Sistema_Dashboard SHALL permitir acesso apenas a clientes vinculados ao próprio Representante
9. IF um Representante tentar acessar a visão individual de um cliente não vinculado a ele, THEN THE Sistema_Dashboard SHALL negar o acesso e exibir uma mensagem indicando que o usuário não possui permissão para visualizar dados daquele cliente

### Requirement 11: Gráfico de Pedidos Cancelados

**User Story:** Como administrador, quero visualizar dados sobre pedidos cancelados, para que eu possa identificar padrões de cancelamento e tomar ações corretivas.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/cancelled-orders que retorne a quantidade de pedidos cancelados, a soma dos valores dos pedidos cancelados e a taxa de cancelamento (pedidos cancelados / total de pedidos), filtrados pelo Período informado
2. THE Sistema_Dashboard SHALL renderizar um gráfico exibindo a quantidade de pedidos cancelados por Período
3. THE Sistema_Dashboard SHALL exibir a taxa de cancelamento (pedidos cancelados / total de pedidos) como percentual com até 1 casa decimal
4. THE Sistema_Dashboard SHALL fornecer um seletor de agrupamento que permita alternar a visualização de pedidos cancelados entre "por período", "por cliente" e "por representante"
5. THE Sistema_Dashboard SHALL permitir alternar o estilo do gráfico entre barras, linhas e pizza
6. WHEN o Administrador passar o cursor sobre um elemento no gráfico de cancelamentos, THE Sistema_Dashboard SHALL exibir um tooltip com a quantidade de pedidos cancelados, a soma dos valores dos pedidos cancelados e a taxa de cancelamento do agrupamento correspondente
7. IF nenhum pedido cancelado existir para o Período e agrupamento selecionados, THEN THE Sistema_Dashboard SHALL exibir uma mensagem informando que não há dados de cancelamento disponíveis para o período selecionado

### Requirement 12: Controle de Acesso do Representante

**User Story:** Como representante, quero acessar o Dashboard com dados filtrados para meus clientes e comissões, para que eu possa acompanhar meu próprio desempenho.

#### Acceptance Criteria

1. WHEN um Representante acessar o Dashboard, THE Sistema_Dashboard SHALL exibir apenas gráficos com dados de clientes vinculados ao Representante autenticado, excluindo dados de clientes pertencentes a outros representantes
2. WHEN um Representante acessar o Dashboard, THE Sistema_Dashboard SHALL exibir apenas valores de Comissão_Representante referentes ao próprio Representante autenticado
3. IF o usuário autenticado possuir perfil Representante, THEN THE Sistema_Dashboard SHALL ocultar o gráfico de desempenho comparativo entre representantes (Requisito 5)
4. IF o usuário autenticado possuir perfil Representante, THEN THE Sistema_Dashboard SHALL ocultar todos os valores de Comissão_Admin em qualquer gráfico ou tooltip exibido
5. WHEN um Representante acessar o gráfico de pedidos cancelados, THE Sistema_Dashboard SHALL exibir apenas cancelamentos de pedidos associados a clientes vinculados ao próprio Representante
6. THE API_Dashboard SHALL validar o perfil do usuário autenticado em cada requisição e filtrar todos os dados retornados para incluir apenas registros vinculados ao perfil identificado
7. IF um Representante realizar uma requisição direta a um endpoint solicitando dados de clientes não vinculados a ele, THEN THE API_Dashboard SHALL retornar uma resposta vazia sem expor dados de outros representantes
8. IF o token de autenticação for inválido ou ausente em uma requisição à API_Dashboard, THEN THE API_Dashboard SHALL rejeitar a requisição e retornar uma mensagem de erro indicando falha de autenticação

### Requirement 13: Endpoints da API para o Dashboard

**User Story:** Como desenvolvedor, quero endpoints dedicados para o Dashboard, para que os dados sejam retornados de forma otimizada para visualização gráfica.

#### Acceptance Criteria

1. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/clients-revenue que aceite os parâmetros opcionais "month" (1-12) e "year" (inteiro de 4 dígitos) e retorne, para cada cliente com pedidos no Período, o nome fantasia do cliente, o clientId e o valor total de pedidos (campo subtotal, sem IPI) com status "active"
2. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/commissions-overview que aceite os parâmetros opcionais "month" (1-12), "year" (inteiro de 4 dígitos) e "granularity" ("monthly" ou "annual") e retorne, para cada Período, os totais de Comissão_Admin e Comissão_Representante agregados
3. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/representatives-performance que aceite os parâmetros opcionais "month" (1-12) e "year" (inteiro de 4 dígitos) e retorne, para cada representante, o nome, a quantidade de pedidos com status "active", o valor total vendido (subtotal) e o total de comissão gerada (representativeCommission)
4. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/top-clients que aceite os parâmetros opcionais "month" (1-12), "year" (inteiro de 4 dígitos) e "limit" (inteiro entre 1 e 50, padrão 10) e retorne os clientes ordenados por valor total de pedidos (subtotal) em ordem decrescente, limitado ao valor de "limit"
5. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/client/:clientId que aceite os parâmetros opcionais "month" (1-12) e "year" (inteiro de 4 dígitos) e retorne os dados agregados do cliente: total de pedidos, valor total (subtotal), total de comissões geradas e evolução por Período
6. THE API_Dashboard SHALL fornecer um endpoint GET /dashboard/cancelled-orders que aceite os parâmetros opcionais "month" (1-12) e "year" (inteiro de 4 dígitos) e retorne a quantidade de pedidos cancelados, o valor total perdido (subtotal dos pedidos cancelados) e a taxa de cancelamento (pedidos cancelados / total de pedidos × 100) no Período
7. WHEN qualquer endpoint do Dashboard for chamado sem os parâmetros "month" e "year", THE API_Dashboard SHALL utilizar o mês e ano atuais (baseados na data do servidor no momento da requisição) como valores padrão para filtragem
8. WHEN um Representante autenticado chamar qualquer endpoint do Dashboard, THE API_Dashboard SHALL filtrar os dados para retornar apenas registros vinculados ao representativeId do token de autenticação
9. THE API_Dashboard SHALL excluir comissões com status "cancelled" de todas as agregações de comissão nos endpoints /dashboard/clients-revenue, /dashboard/commissions-overview, /dashboard/representatives-performance e /dashboard/top-clients
10. IF o parâmetro "clientId" informado no endpoint GET /dashboard/client/:clientId não corresponder a um cliente existente, THEN THE API_Dashboard SHALL retornar status 404 com uma mensagem de erro indicando que o cliente não foi encontrado
11. IF os parâmetros "month" ou "year" informados em qualquer endpoint do Dashboard estiverem fora dos intervalos válidos (month: 1-12, year: 2000-2100), THEN THE API_Dashboard SHALL retornar status 400 com uma mensagem de erro indicando o parâmetro inválido
12. THE API_Dashboard SHALL responder a cada requisição dos endpoints do Dashboard em no máximo 2 segundos para conjuntos de até 10.000 registros na base de dados
