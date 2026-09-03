# configuracao-credenciais Specification

## Purpose
Configurar e verificar o acesso às fontes externas pela interface, mantendo as credenciais protegidas e fora da camada de apresentação.

## Requirements

### Requirement: Configuração do acesso pela interface

O sistema SHALL disponibilizar uma tela de configurações, acessível a partir da tela principal, para que o usuário configure o acesso a cada fonte e a cada serviço externo.

O GitHub SHALL ser configurado por um campo de token. O serviço de modelo de linguagem SHALL ser configurado por um campo de chave de API.

No MVP existe uma única **fonte** de documentos (ADR-0004). A chave da LLM não é uma fonte: ela não fornece documentos, e sua ausência NÃO SHALL impedir a busca.

A chave da LLM SHALL receber o mesmo tratamento da credencial do GitHub: protegida pelo mecanismo de segredos do sistema operacional, nunca reexibida depois de gravada e nunca devolvida à camada de interface.

A tela SHALL informar que o texto dos documentos é enviado ao serviço externo quando o recurso de resumo é utilizado.

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
- **THEN** a tela informa que o texto dos documentos é enviado ao serviço externo

#### Scenario: Sistema utilizável sem a chave da LLM

- **GIVEN** que apenas o token do GitHub está configurado
- **WHEN** o usuário realiza uma busca
- **THEN** a busca funciona normalmente
- **AND** apenas os recursos que dependem da LLM ficam indisponíveis

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

### Requirement: Operação do diálogo de configurações por teclado

O diálogo de configurações SHALL ser operável inteiramente por teclado: o foco SHALL entrar nele ao abrir, permanecer confinado enquanto estiver aberto, e retornar ao elemento que o acionou quando fechar.

O diálogo declara `aria-modal`, que afirma às tecnologias assistivas que o restante da tela está inerte. Sem o confinamento do foco, essa afirmação seria falsa.

#### Scenario: Diálogo aberto por teclado

- **GIVEN** que o usuário acionou a abertura das configurações
- **WHEN** o diálogo é apresentado
- **THEN** o foco passa para o primeiro elemento acionável dentro dele

#### Scenario: Tabulação confinada ao diálogo

- **GIVEN** que o diálogo está aberto
- **WHEN** o usuário tabula a partir do último elemento acionável
- **THEN** o foco retorna ao primeiro elemento do diálogo
- **AND** não alcança elementos da tela que está atrás

#### Scenario: Diálogo fechado pelo teclado

- **GIVEN** que o diálogo está aberto
- **WHEN** o usuário aciona a tecla Escape
- **THEN** o diálogo é fechado
- **AND** o foco retorna ao elemento que o abriu

### Requirement: Proteção da credencial armazenada

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
