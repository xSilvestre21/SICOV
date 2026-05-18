# Implementation Plan: Dashboard

## Overview

Implementação do Dashboard interativo do SICOV com endpoints de API dedicados (Express + MongoDB Aggregation Pipeline) e componentes frontend (React 19 + Recharts). O plano segue uma abordagem incremental: primeiro a infraestrutura backend (validação, service, controller, rotas), depois o frontend (contexto de filtros, componentes de gráfico, controle de acesso).

## Tasks

- [x] 1. Backend: Infraestrutura e validação de parâmetros
  - [x] 1.1 Criar helper de validação de parâmetros do Dashboard
    - Criar arquivo `src/utils/dashboardValidation.js`
    - Implementar `validateDashboardParams(query)` que valida month (1-12) e year (2000-2100)
    - Implementar `getDefaultPeriod()` que retorna mês e ano atuais
    - Retornar array de erros para parâmetros inválidos
    - _Requirements: 13.7, 13.11_

  - [x] 1.2 Write property test for parameter validation
    - **Property 10: Invalid parameter validation**
    - **Validates: Requirements 13.11**
    - Gerar valores de month fora de [1,12] e year fora de [2000,2100] com fast-check
    - Verificar que validateDashboardParams retorna erros para todos os casos inválidos

  - [x] 1.3 Criar Dashboard Service com funções de agregação
    - Criar arquivo `src/services/dashboardService.js`
    - Implementar `buildPeriodFilter(month, year, granularity)` para Orders (usa createdAt) e Commissions (usa period)
    - Implementar `buildRepresentativeFilter(user)` que retorna filtro por representativeId se perfil != admin
    - Implementar `zeroFillMonths(data, year)` e `zeroFillYears(data, endYear)` para preenchimento de períodos vazios
    - Implementar `sanitizeForRepresentative(data, profile)` para remover campos de adminCommission
    - _Requirements: 3.2, 3.3, 4.1, 12.4, 13.7_

  - [x] 1.4 Write property test for zero-fill and period completeness
    - **Property 2: Commissions-overview aggregation with granularity completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 13.2**
    - Gerar commissions esparsas com fast-check e verificar que zeroFillMonths retorna exatamente 12 entries e zeroFillYears retorna exatamente 5 entries

  - [x] 1.5 Write property test for admin commission sanitization
    - **Property 7: Admin commission sanitization for representatives**
    - **Validates: Requirements 12.4**
    - Gerar objetos com campos adminCommission/totalAdminCommission e verificar que sanitizeForRepresentative remove todos esses campos quando profile é "representative"

- [x] 2. Backend: Implementar endpoints de agregação
  - [x] 2.1 Implementar aggregateClientsRevenue no Dashboard Service
    - Pipeline: match orders (status active) → group by clientId → sum subtotal → sort desc → limit 20
    - Aplicar filtro de período e filtro de representante
    - Retornar array com clientId, tradeName, totalRevenue
    - _Requirements: 2.1, 2.2, 13.1_

  - [x] 2.2 Write property test for clients-revenue aggregation
    - **Property 1: Clients-revenue aggregation excludes cancelled orders**
    - **Validates: Requirements 2.1, 2.2, 6.1, 13.1, 13.4**
    - Gerar orders com statuses mistos (active/cancelled) e verificar que apenas active são somados

  - [x] 2.3 Implementar aggregateCommissionsOverview no Dashboard Service
    - Pipeline: match commissions (status != cancelled, installmentsCreated != true) → group by period → sum adminCommission e representativeCommission
    - Aplicar zero-fill conforme granularidade (monthly: 12 meses, annual: 5 anos)
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 13.2_

  - [x] 2.4 Implementar aggregateRepresentativesPerformance no Dashboard Service
    - Pipeline: match orders (status active) → group by representativeId → count orders, sum subtotal → lookup user name → sum representativeCommission
    - _Requirements: 5.1, 5.2, 13.3_

  - [x] 2.5 Write property test for representatives-performance aggregation
    - **Property 3: Representatives-performance aggregation correctness**
    - **Validates: Requirements 5.1, 5.2, 13.3**
    - Gerar orders/commissions para múltiplos representantes e verificar métricas individuais

  - [x] 2.6 Implementar aggregateTopClients no Dashboard Service
    - Pipeline: match orders (status active) → group by clientId → sort desc → limit (default 10, max 50)
    - _Requirements: 6.1, 6.6, 13.4_

  - [x] 2.7 Implementar aggregateClientDetail no Dashboard Service
    - Pipeline: match orders for clientId → aggregate totals (orderCount, totalRevenue, totalCommissions) e evolution por período
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 13.5_

  - [x] 2.8 Write property test for per-client aggregation
    - **Property 4: Per-client aggregation correctness**
    - **Validates: Requirements 10.5, 13.5**
    - Gerar orders/commissions para 1 cliente e verificar que totais batem com soma da evolução

  - [x] 2.9 Implementar aggregateCancelledOrders no Dashboard Service
    - Contar total de orders no período, pipeline para cancelled: count, sum subtotal, calcular rate
    - Suportar groupBy: 'period', 'client', 'representative'
    - _Requirements: 11.1, 11.3, 13.6_

  - [x] 2.10 Write property test for cancelled-orders metrics
    - **Property 5: Cancelled-orders metrics correctness**
    - **Validates: Requirements 11.1, 11.3, 13.6**
    - Gerar orders com statuses mistos e verificar cancelledCount, cancelledValue e cancellationRate

- [x] 3. Backend: Controller e Rotas
  - [x] 3.1 Criar Dashboard Controller
    - Criar arquivo `src/controllers/dashboardController.js`
    - Implementar handlers: getClientsRevenue, getCommissionsOverview, getRepresentativesPerformance, getTopClients, getClientDetail, getCancelledOrders
    - Cada handler: validar params → aplicar defaults → chamar service → sanitizar resposta → retornar JSON
    - Retornar 400 para params inválidos, 404 para clientId inexistente
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.10, 13.11_

  - [x] 3.2 Criar Dashboard Routes e registrar no app
    - Criar arquivo `src/routes/dashboardRoutes.js`
    - Aplicar authMiddleware em todas as rotas
    - Registrar rotas: GET /clients-revenue, /commissions-overview, /representatives-performance, /top-clients, /client/:clientId, /cancelled-orders
    - Registrar router no `app.js` com prefixo `/dashboard`
    - _Requirements: 1.6, 12.6, 12.8, 13.8_

  - [x] 3.3 Write property test for representative access control
    - **Property 6: Representative access control filtering**
    - **Validates: Requirements 10.8, 12.1, 12.2, 12.5, 12.6, 13.8**
    - Gerar dados para 2+ representantes, chamar endpoints como representante A e verificar que apenas dados de A são retornados

  - [x] 3.4 Write property test for cancelled commissions exclusion
    - **Property 8: Cancelled commissions excluded from all aggregations**
    - **Validates: Requirements 13.9**
    - Gerar commissions com status cancelled e active, verificar que apenas active são incluídas nas agregações

  - [x] 3.5 Write property test for default period parameters
    - **Property 9: Default period parameters**
    - **Validates: Requirements 13.7**
    - Chamar endpoints sem month/year e comparar resultado com chamada explícita usando mês/ano atual

- [x] 4. Checkpoint - Backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend: Contexto de filtros e infraestrutura
  - [x] 5.1 Criar DashboardFilterContext
    - Criar arquivo `SICOV-WEB/src/contexts/DashboardFilterContext.jsx`
    - Implementar context com estado: granularity ('monthly'|'annual'), month (1-12), year (2000-2100)
    - Inicializar com granularidade "monthly", mês atual e ano atual
    - Implementar validação para não permitir seleção de mês/ano futuro
    - Exportar Provider e hook `useDashboardFilters()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.2 Criar hook useDashboardData
    - Criar arquivo `SICOV-WEB/src/hooks/useDashboardData.js`
    - Implementar hook que recebe endpoint e params, gerencia estados loading/error/data
    - Configurar Axios com timeout de 5 segundos
    - Expor função retry para re-executar requisição em caso de erro
    - Re-fetch automático quando params mudam (filtros globais)
    - _Requirements: 1.4, 1.5, 9.2, 9.5_

  - [x] 5.3 Criar componente GlobalFilters
    - Criar arquivo `SICOV-WEB/src/components/dashboard/GlobalFilters.jsx`
    - Renderizar seletor de granularidade (Mensal/Anual)
    - Quando "Mensal": exibir seletor de mês + seletor de ano
    - Quando "Anual": exibir apenas seletor de ano
    - Desabilitar seleção de mês/ano futuro
    - Disparar atualização de todos os gráficos ao alterar filtro
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.4 Criar componente ChartStyleSelector
    - Criar arquivo `SICOV-WEB/src/components/dashboard/ChartStyleSelector.jsx`
    - Renderizar botões de ícone para cada estilo disponível (recebido via props)
    - Destacar estilo ativo
    - Chamar callback onChange sem re-fetch de dados
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Frontend: Componentes de gráfico
  - [x] 6.1 Criar ClientsRevenueChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/ClientsRevenueChart.jsx`
    - Consumir DashboardFilterContext para obter filtros
    - Usar useDashboardData para fetch de /dashboard/clients-revenue
    - Renderizar com Recharts: suportar Bar, Pie, HorizontalBar
    - Exibir skeleton durante loading, mensagem de erro com retry em caso de falha
    - Exibir mensagem "Nenhum dado disponível" quando data vazio
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 6.2 Criar CommissionsOverviewChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/CommissionsOverviewChart.jsx`
    - Renderizar evolução de Comissão_Admin ao longo do tempo
    - Suportar estilos: Line, Bar, Area
    - Tooltip com valor formatado (2 casas decimais) e período
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

  - [x] 6.3 Criar CommissionsVariationChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/CommissionsVariationChart.jsx`
    - Exibir Comissão_Admin e Comissão_Representante como séries distintas com cores e legenda
    - Suportar estilos: GroupedBar, StackedBar, Line
    - Implementar drill-down ao clicar em período (lista de comissões com paginação de 20 itens)
    - Tooltip com totais de ambas comissões e período
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 6.4 Criar RepresentativesPerformanceChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/RepresentativesPerformanceChart.jsx`
    - Renderizar gráfico comparativo entre representantes (valor total vendido como métrica principal)
    - Suportar estilos: Bar, Pie, RankingTable
    - Tooltip com total de pedidos, valor total vendido e comissão gerada
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.5 Criar TopClientsChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/TopClientsChart.jsx`
    - Renderizar ranking dos top 10 clientes por receita
    - Suportar estilos: HorizontalBar, Pie, Treemap
    - Exibir nome fantasia e valor em R$ com 2 casas decimais
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x] 6.6 Criar CancelledOrdersChart
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/CancelledOrdersChart.jsx`
    - Renderizar quantidade de pedidos cancelados por período
    - Exibir taxa de cancelamento como percentual (1 casa decimal)
    - Seletor de agrupamento: por período, por cliente, por representante
    - Suportar estilos: Bar, Line, Pie
    - Tooltip com quantidade, valor e taxa de cancelamento
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 6.7 Criar ClientIndividualView
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/charts/ClientIndividualView.jsx`
    - Exibir gráfico de evolução de pedidos, valor total de compras por período e total de comissões
    - Suportar estilos: Line, Bar
    - Exibir mensagem quando cliente não tem dados no período
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_

- [x] 7. Frontend: Página principal e controle de acesso
  - [x] 7.1 Criar DashboardPage
    - Criar arquivo `SICOV-WEB/src/pages/dashboard/DashboardPage.jsx`
    - Envolver com DashboardFilterContext Provider
    - Renderizar GlobalFilters no topo
    - Renderizar grid de gráficos: 2 colunas em viewport >= 768px, 1 coluna em < 768px
    - Para perfil admin: exibir todas as seções
    - Para perfil representante: ocultar RepresentativesPerformanceChart e valores de Comissão_Admin
    - Permitir seleção de cliente para abrir ClientIndividualView
    - _Requirements: 1.2, 1.3, 9.1, 12.3, 12.4_

  - [x] 7.2 Adicionar rota e navegação do Dashboard
    - Adicionar rota `/dashboard` no router da aplicação (SICOV-WEB)
    - Adicionar item "Dashboard" no menu lateral, visível para admin e representante
    - Proteger rota com autenticação (redirecionar para login se não autenticado)
    - _Requirements: 1.1, 1.6_

  - [x] 7.3 Write unit tests for frontend components
    - Testar GlobalFilters: renderização condicional por granularidade
    - Testar ChartStyleSelector: alternância de estilos sem re-fetch
    - Testar DashboardPage: renderização de seções por perfil (admin vs representante)
    - Testar useDashboardData: estados loading/error/retry
    - _Requirements: 7.1, 7.2, 8.3, 12.3_

- [x] 8. Checkpoint final - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses MongoDB Aggregation Pipeline for all data aggregation
- Frontend uses Recharts for all chart rendering
- Axios timeout set to 5 seconds for all dashboard API calls

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "5.2", "5.3", "5.4"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.1", "2.3", "2.4", "2.6", "2.7", "2.9"] },
    { "id": 3, "tasks": ["2.2", "2.5", "2.8", "2.10", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] }
  ]
}
```
