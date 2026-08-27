# Especificação — Configuração de credenciais

**Issue:** #65

## Requirement: Configuração do acesso pela interface

O sistema SHALL disponibilizar uma tela de configurações, acessível a partir da tela principal, para que o usuário configure o acesso a cada fonte.

O GitHub SHALL ser configurado por um campo de token. O Google Drive SHALL ser configurado por um campo de identificação do cliente OAuth somado a uma ação de autorização, porque uma chave de acesso isolada não alcança documentos privados naquela fonte.

#### Scenario: Token do GitHub informado pela primeira vez

- **GIVEN** que nenhuma credencial do GitHub está configurada
- **WHEN** o usuário informa um token e confirma
- **THEN** o sistema valida o token antes de persistí-lo
- **AND** passa a considerar a fonte disponível para consultas

#### Scenario: Token do GitHub recusado na validação

- **GIVEN** que o usuário informou um token inválido
- **WHEN** confirma a gravação
- **THEN** o sistema apresenta o motivo da recusa
- **AND** não persiste o token informado

## Requirement: Autorização do Google Drive

O acesso ao Google Drive SHALL ser concedido por meio de autorização explícita do usuário, realizada fora da aplicação, e SHALL permanecer válido entre execuções sem exigir nova autorização a cada abertura.

#### Scenario: Autorização concedida

- **GIVEN** que o usuário informou a identificação do cliente OAuth
- **WHEN** aciona a ação de conexão e concede o consentimento
- **THEN** o sistema persiste a autorização de forma protegida
- **AND** passa a apresentar a fonte como conectada

#### Scenario: Autorização recusada ou abandonada

- **GIVEN** que o usuário acionou a ação de conexão
- **WHEN** recusa o consentimento ou não o conclui
- **THEN** o sistema informa que a autorização não foi concluída
- **AND** a fonte permanece como não conectada

#### Scenario: Autorização expirada

- **GIVEN** que a fonte estava conectada
- **WHEN** a autorização deixa de ser aceita pelo provedor
- **THEN** o sistema informa que é necessário conectar novamente
- **AND** não consulta essa fonte nas buscas

#### Scenario: Conexão sem identificação do cliente

- **GIVEN** que a identificação do cliente OAuth não foi informada
- **WHEN** o usuário aciona a ação de conexão
- **THEN** o sistema orienta a informar a identificação antes de autorizar

#### Scenario: Credencial substituída

- **GIVEN** que já existe uma credencial configurada para uma fonte
- **WHEN** o usuário informa uma nova credencial para a mesma fonte
- **THEN** o sistema substitui a credencial anterior
- **AND** revalida a fonte com a nova credencial

#### Scenario: Credencial removida

- **GIVEN** que existe uma credencial configurada
- **WHEN** o usuário limpa o campo e confirma
- **THEN** o sistema descarta a credencial armazenada
- **AND** a fonte deixa de ser consultada nas buscas

## Requirement: Proteção da credencial armazenada

A credencial SHALL ser armazenada de forma protegida pelo mecanismo de proteção de segredos do sistema operacional.

A credencial NÃO SHALL ser exposta à camada de interface após ter sido informada, nem ser exibida novamente em texto legível.

#### Scenario: Credencial já configurada é reaberta

- **GIVEN** que uma credencial está configurada
- **WHEN** o usuário abre a tela de configurações
- **THEN** o sistema indica que a fonte possui credencial configurada
- **AND** não apresenta o valor da credencial

#### Scenario: Consulta a uma fonte externa

- **GIVEN** que uma busca requer acesso a uma fonte
- **WHEN** a requisição é realizada
- **THEN** a credencial é utilizada fora da camada de interface
- **AND** a camada de interface recebe apenas os resultados já tratados

## Requirement: Validação das credenciais

O sistema SHALL verificar se cada credencial configurada é válida, apresentando o resultado dessa verificação ao usuário.

O resultado da verificação SHALL ser reaproveitado entre execuções, evitando repetir a verificação a cada abertura do sistema.

#### Scenario: Credencial válida

- **GIVEN** que o usuário informou uma credencial válida
- **WHEN** a verificação é concluída
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
