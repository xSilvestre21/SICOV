# Documento de Requisitos — Comissões

## Introdução

Este documento descreve os requisitos para o módulo de comissões do sistema. O módulo permite que o Admin registre e gerencie comissões sobre pedidos, configure percentuais de comissão para o Admin e para Representantes, visualize projeções de parcelas futuras e controle o acesso às informações de comissão por perfil de usuário.

As comissões incidem sobre o `Valor_Pedido_Sem_IPI` de cada pedido. Tanto o Admin quanto o Representante associado ao pedido recebem comissão: o Representante possui um percentual configurável pelo Admin, e o Admin possui um percentual padrão de 5%, também configurável por exceção. O sistema suporta parcelamento projetado, onde o Admin informa uma lista de intervalos em dias e o sistema calcula as datas de vencimento de cada parcela somando esses intervalos à `deliveryDate` do pedido original.

---

## Glossário

- **Sistema_Comissoes**: O módulo de comissões do sistema, responsável por registrar, calcular e exibir comissões.
- **Admin**: Usuário com perfil administrativo, com permissão de leitura e escrita em todos os dados de comissão.
- **Representante**: Usuário com perfil de representante comercial, com acesso somente leitura às suas próprias comissões.
- **Registro_Comissao**: Entidade que representa a comissão de um pedido (ou parcela projetada) em um determinado período, contendo os valores calculados para o Representante e para o Admin.
- **Valor_Pedido_Sem_IPI**: Valor total do pedido excluindo IPI — base de cálculo para todas as comissões.
- **Valor_Real_Recebido**: Valor efetivamente recebido pelo pedido, informado manualmente pelo Admin no `Registro_Comissao`. Pode diferir do `Valor_Pedido_Sem_IPI` original.
- **Comissao_Calculada**: Valor monetário da comissão calculado aplicando o percentual configurado sobre o `Valor_Pedido_Sem_IPI` (ou `Valor_Real_Recebido`, quando informado).
- **Percentual_Comissao_Representante**: Percentual (%) de comissão do Representante para um período, configurável pelo Admin.
- **Percentual_Comissao_Admin**: Percentual (%) de comissão do Admin para um período; padrão de 5%, configurável pelo próprio Admin por exceção.
- **Periodo**: Referência de mês/ano de um `Registro_Comissao`, determinada pela data de vencimento da parcela (ou pela `deliveryDate` do pedido, para registros não parcelados).
- **Saldo_Pendente**: Valor ainda não recebido de um pedido, base para o cálculo de parcelas projetadas.
- **Parcela_Projetada**: Fração do `Saldo_Pendente` projetada em um período futuro, calculada a partir de um intervalo em dias somado à `deliveryDate` do pedido original.
- **Intervalos_Parcelamento**: Lista de inteiros em dias informada pelo Admin para definir as datas de vencimento de cada parcela (ex: `[28, 35, 42]`).
- **Data_Entrega_Real**: Data efetiva em que o pedido foi entregue ao cliente, preenchida manualmente pelo Admin no `Registro_Comissao`. Difere da `deliveryDate` do pedido, que representa a data prevista de entrega.

---

## Requisitos

### Requisito 1: Registro de Comissão do Representante

**User Story:** Como Admin, quero registrar o valor real recebido de um pedido associado a um Representante, para que a comissão do Representante seja calculada corretamente.

#### Critérios de Aceitação

1. WHEN o Admin registra o `Valor_Real_Recebido` para um pedido, THE Sistema_Comissoes SHALL persistir o `Registro_Comissao` associando-o ao Representante e ao período (mês/ano).
2. WHEN o Admin registra o `Valor_Real_Recebido`, THE Sistema_Comissoes SHALL calcular a `Comissao_Calculada` do Representante aplicando o `Percentual_Comissao_Representante` sobre o `Valor_Real_Recebido`.
3. IF um Representante tentar registrar ou editar o `Valor_Real_Recebido`, THEN THE Sistema_Comissoes SHALL retornar erro 403.
4. IF o `Valor_Real_Recebido` não for informado, THEN THE Sistema_Comissoes SHALL utilizar o `Valor_Pedido_Sem_IPI` como base de cálculo da comissão.

---

### Requisito 2: Registro de Comissão do Admin

**User Story:** Como Admin, quero registrar minha própria comissão sobre um pedido, para que o valor da minha comissão seja calculado e armazenado corretamente.

#### Critérios de Aceitação

1. WHEN o Admin registra o `Valor_Real_Recebido` para um pedido, THE Sistema_Comissoes SHALL calcular a `Comissao_Calculada` do Admin aplicando o `Percentual_Comissao_Admin` sobre o `Valor_Real_Recebido`.
2. THE Sistema_Comissoes SHALL inicializar o `Percentual_Comissao_Admin` com o valor padrão de 5% para cada novo `Registro_Comissao`, sem exigir configuração manual.
3. IF um Representante tentar registrar ou editar o `Valor_Real_Recebido` de qualquer `Registro_Comissao`, THEN THE Sistema_Comissoes SHALL retornar erro 403.

---

### Requisito 3: Configuração de Percentuais de Comissão

**User Story:** Como Admin, quero configurar os percentuais de comissão do Representante e do Admin por período, para que os cálculos reflitam os acordos comerciais vigentes.

#### Critérios de Aceitação

1. WHEN o Admin configura o `Percentual_Comissao_Representante` para um período, THE Sistema_Comissoes SHALL persistir o percentual associado ao Representante e ao período (mês/ano).
2. WHEN o Admin configura o `Percentual_Comissao_Admin` para um período, THE Sistema_Comissoes SHALL persistir o percentual associado ao período (mês/ano).
3. THE Sistema_Comissoes SHALL aplicar o `Percentual_Comissao_Admin` padrão de 5% quando nenhuma configuração de exceção for informada para o período.
4. IF um Representante tentar configurar o `Percentual_Comissao_Representante` ou o `Percentual_Comissao_Admin`, THEN THE Sistema_Comissoes SHALL retornar erro 403.

---

### Requisito 4: Cálculo de Comissões

**User Story:** Como Admin, quero que o sistema calcule automaticamente as comissões do Representante e do Admin com base nos percentuais configurados, para que os valores sejam consistentes e auditáveis.

#### Critérios de Aceitação

1. THE Sistema_Comissoes SHALL calcular a `Comissao_Calculada` do Representante e a `Comissao_Calculada` do Admin, ambas calculadas sobre o `Valor_Pedido_Sem_IPI` (ou `Valor_Real_Recebido`, quando informado).
2. WHEN o `Percentual_Comissao_Representante` ou o `Percentual_Comissao_Admin` for alterado para um período, THE Sistema_Comissoes SHALL recalcular as `Comissao_Calculada` de todos os `Registro_Comissao` daquele período.
3. THE Sistema_Comissoes SHALL armazenar separadamente a `Comissao_Calculada` do Representante e a `Comissao_Calculada` do Admin em cada `Registro_Comissao`.

---

### Requisito 5: Parcelamento Projetado

**User Story:** Como Admin, quero informar intervalos de parcelamento em dias para um pedido, para que o sistema projete as parcelas futuras e distribua as comissões nos períodos corretos.

#### Critérios de Aceitação

1. WHEN o Admin informa os `Intervalos_Parcelamento` para um pedido, THE Sistema_Comissoes SHALL dividir o `Saldo_Pendente` em parcelas iguais, uma por intervalo informado.
2. WHEN o Sistema_Comissoes calcula a data de vencimento de cada parcela, THE Sistema_Comissoes SHALL somar o intervalo em dias à `deliveryDate` do pedido original para obter a data de vencimento da parcela.
3. WHEN o Sistema_Comissoes determina o `Periodo` de uma parcela, THE Sistema_Comissoes SHALL usar o mês e ano da data de vencimento calculada para atribuir a parcela ao `Periodo` correspondente.
4. THE Sistema_Comissoes SHALL criar um `Registro_Comissao` separado para cada parcela, com o valor da parcela como `Valor_Pedido_Sem_IPI` projetado, referência ao pedido original e indicador `projetado: true`.
5. IF os `Intervalos_Parcelamento` informados resultarem em lista vazia, THEN THE Sistema_Comissoes SHALL retornar erro de validação com mensagem descritiva.
6. IF os `Intervalos_Parcelamento` informados contiverem valores não positivos, THEN THE Sistema_Comissoes SHALL retornar erro de validação com mensagem descritiva.

---

### Requisito 6: Listagem de Comissões

**User Story:** Como usuário do sistema, quero visualizar a listagem de comissões com todos os campos relevantes, para que eu possa acompanhar os valores e períodos de cada registro.

#### Critérios de Aceitação

1. WHEN o Admin solicita a listagem de comissões, THE Sistema_Comissoes SHALL retornar todos os `Registro_Comissao` com os campos: pedido de referência, `Periodo`, `Valor_Pedido_Sem_IPI`, `Valor_Real_Recebido`, `Comissao_Calculada` do Representante, `Comissao_Calculada` do Admin, `Data_Entrega_Real` e indicador `projetado`.
2. WHEN o Representante solicita a listagem de comissões, THE Sistema_Comissoes SHALL retornar apenas os `Registro_Comissao` associados ao próprio Representante, com os campos: pedido de referência, `Periodo`, `Valor_Pedido_Sem_IPI`, `Comissao_Calculada` do Representante, `Data_Entrega_Real` e indicador `projetado`.
3. WHEN um item da lista for uma `Parcela_Projetada`, THE Sistema_Comissoes SHALL incluir também a referência ao pedido original e a data de vencimento da parcela.
4. THE Sistema_Comissoes SHALL exibir a `Comissao_Calculada` do Representante e a `Comissao_Calculada` do Admin em cada item da listagem.

---

### Requisito 7: Controle de Acesso

**User Story:** Como Admin, quero que o sistema restrinja as operações de escrita aos usuários com perfil Admin, para que os dados de comissão sejam protegidos contra alterações não autorizadas.

#### Critérios de Aceitação

1. THE Sistema_Comissoes SHALL permitir que apenas o Admin registre, edite ou exclua `Registro_Comissao`.
2. THE Sistema_Comissoes SHALL permitir que apenas o Admin configure o `Percentual_Comissao_Representante` e o `Percentual_Comissao_Admin`.
3. THE Sistema_Comissoes SHALL permitir que apenas o Admin informe ou altere o `Valor_Real_Recebido` em um `Registro_Comissao`.
4. THE Sistema_Comissoes SHALL conceder ao Representante acesso somente leitura aos seus próprios `Registro_Comissao`.
5. IF um Representante tentar criar, editar ou excluir qualquer `Registro_Comissao`, THEN THE Sistema_Comissoes SHALL retornar erro 403.
6. IF um Representante tentar acessar `Registro_Comissao` de outro Representante, THEN THE Sistema_Comissoes SHALL retornar erro 403.
7. IF um Representante tentar configurar o `Percentual_Comissao_Representante` ou o `Percentual_Comissao_Admin`, THEN THE Sistema_Comissoes SHALL retornar erro 403.

---

### Requisito 8: Data de Entrega Real

**User Story:** Como Admin, quero registrar a data efetiva de entrega de um pedido no `Registro_Comissao`, para que seja possível rastrear quando o pedido foi de fato entregue ao cliente, independentemente da data prevista.

#### Critérios de Aceitação

1. WHEN o Admin registra ou edita um `Registro_Comissao`, THE Sistema_Comissoes SHALL permitir o preenchimento opcional do campo `Data_Entrega_Real`.
2. THE Sistema_Comissoes SHALL permitir que um `Registro_Comissao` exista sem `Data_Entrega_Real` preenchida.
3. THE Sistema_Comissoes SHALL permitir que apenas o Admin preencha ou altere o campo `Data_Entrega_Real` em um `Registro_Comissao`.
4. IF um Representante tentar preencher ou alterar o campo `Data_Entrega_Real`, THEN THE Sistema_Comissoes SHALL retornar erro 403.
5. WHEN o Sistema_Comissoes exibe a listagem de comissões, THE Sistema_Comissoes SHALL incluir o campo `Data_Entrega_Real` junto aos demais campos do `Registro_Comissao`.
6. THE Sistema_Comissoes SHALL determinar o `Periodo` de um `Registro_Comissao` com base na `deliveryDate` prevista do pedido, independentemente do valor da `Data_Entrega_Real`.
