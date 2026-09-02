## ADDED Requirements

### Requirement: Acesso às configurações pelo cabeçalho

O cabeçalho da tela principal SHALL apresentar um controle que abre o diálogo de configurações.

Esse controle SHALL ser identificado por um rótulo acessível, ser alcançável por teclado e assinalar o foco visualmente. Seu rótulo acessível SHALL ser distinto de qualquer outro controle que abra as configurações a partir de outra parte da tela.

Esse controle NÃO SHALL comunicar o estado de conexão da fonte nem o resultado da verificação de credenciais.

#### Scenario: Abertura das configurações pelo cabeçalho

- **GIVEN** que a tela principal está apresentada
- **WHEN** o usuário aciona o controle de configurações do cabeçalho
- **THEN** o diálogo de configurações é aberto

#### Scenario: Controle de configurações alcançado por teclado

- **GIVEN** que o cabeçalho da aplicação está apresentado
- **WHEN** o usuário percorre a tela pelo teclado
- **THEN** o controle de configurações recebe o foco
- **AND** o foco é assinalado visualmente e o controle é identificado por rótulo acessível

## MODIFIED Requirements

### Requirement: Validação das credenciais

O sistema SHALL verificar se cada credencial configurada é válida, apresentando o resultado dessa verificação ao usuário.

O resultado da verificação SHALL ser apresentado na tela de configurações, por fonte. O cabeçalho da tela principal NÃO SHALL comunicar o estado de conexão da fonte.

O resultado da verificação SHALL ser reaproveitado entre execuções, evitando repetir a verificação a cada abertura do sistema.

#### Scenario: Credencial válida

- **GIVEN** que o usuário informou uma credencial válida
- **WHEN** a verificação é concluída
- **AND** o usuário abre a tela de configurações
- **THEN** o sistema indica que a fonte está conectada

#### Scenario: Credencial inválida ou expirada

- **GIVEN** que o usuário informou uma credencial inválida
- **WHEN** a verificação é concluída
- **THEN** o sistema indica que a credencial não é válida
- **AND** orienta o usuário a informar uma nova credencial
- **AND** não consulta essa fonte nas buscas

#### Scenario: Credencial ausente

- **GIVEN** que nenhuma credencial foi informada para uma fonte
- **WHEN** o sistema é aberto
- **THEN** o sistema indica que a fonte não está configurada
- **AND** permanece utilizável para a fonte que estiver configurada

#### Scenario: Verificação impossível por falta de conexão

- **GIVEN** que existe credencial configurada
- **WHEN** não é possível alcançar a fonte para verificar a credencial
- **THEN** o sistema informa que não foi possível verificar a conexão
- **AND** distingue essa situação de uma credencial inválida

#### Scenario: Estado de conexão não aparece no cabeçalho

- **GIVEN** que existe credencial configurada e verificada
- **WHEN** a tela principal é apresentada sem o diálogo de configurações aberto
- **THEN** o cabeçalho não apresenta o estado de conexão da fonte
