# Especificação — Configuração de credenciais

**Issue:** #65

## MODIFIED Requirements

### Requirement: Configuração do acesso pela interface

O sistema SHALL disponibilizar uma tela de configurações, acessível a partir da tela principal, para que o usuário configure o acesso a cada fonte e serviço.

O GitHub SHALL ser configurado por um campo de token. O serviço de modelo de linguagem SHALL ser configurado por um campo de chave de API.

A chave da LLM SHALL receber o mesmo tratamento das demais credenciais: protegida pelo mecanismo de segredos do sistema operacional, nunca reexibida depois de gravada e nunca devolvida à camada de interface.

A tela SHALL informar que o conteúdo dos documentos é enviado ao serviço externo quando o recurso de resumo é utilizado.

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

#### Scenario: Chave da LLM informada

- **GIVEN** que nenhuma chave de LLM está configurada
- **WHEN** o usuário informa a chave e confirma
- **THEN** o sistema valida a chave antes de persistí-la
- **AND** passa a oferecer a geração de resumos

#### Scenario: Chave da LLM recusada na validação

- **GIVEN** que o usuário informou uma chave inválida
- **WHEN** confirma a gravação
- **THEN** o sistema apresenta o motivo da recusa
- **AND** não persiste a chave informada

#### Scenario: Aviso sobre envio de conteúdo

- **GIVEN** que o usuário abriu a tela de configurações
- **WHEN** a seção do serviço de linguagem é apresentada
- **THEN** a tela informa que o conteúdo dos documentos é enviado ao serviço externo

#### Scenario: Sistema utilizável sem a chave da LLM

- **GIVEN** que apenas o token do GitHub está configurado
- **WHEN** o usuário realiza uma busca
- **THEN** a busca funciona normalmente
- **AND** apenas os recursos que dependem da LLM ficam indisponíveis
