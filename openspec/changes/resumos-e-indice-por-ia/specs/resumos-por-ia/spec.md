# Especificação — Resumos por IA

**Issue:** #65

## Purpose

Gerar, armazenar e apresentar resumos dos documentos produzidos por um modelo de linguagem, de modo que o usuário compreenda o conteúdo de um documento sem precisar abri-lo.

## ADDED Requirements

### Requirement: Envio do conteúdo a serviço externo

O sistema SHALL enviar o conteúdo do documento a um serviço externo de modelo de linguagem para produzir o resumo e a classificação.

O usuário SHALL ser informado disso antes do primeiro envio, e a informação SHALL permanecer acessível na tela de configurações. O sistema até então mantinha todo conteúdo na máquina do usuário; a mudança dessa postura não pode ser silenciosa.

O conteúdo obtido para envio NÃO SHALL ser gravado no banco local. Apenas o resultado produzido pela LLM é persistido.

#### Scenario: Primeiro envio de conteúdo

- **GIVEN** que nenhum conteúdo foi enviado ao serviço externo ainda
- **WHEN** o usuário aciona a geração de um resumo
- **THEN** o sistema informa que o conteúdo será enviado a um serviço externo
- **AND** prossegue somente após a confirmação do usuário

#### Scenario: Conteúdo não é retido

- **GIVEN** que um documento foi submetido à LLM
- **WHEN** o resumo é recebido e gravado
- **THEN** apenas o resumo e sua data são persistidos
- **AND** o conteúdo do documento não é gravado no banco local

### Requirement: Instrução de redação versionada

A orientação enviada à LLM sobre como redigir o resumo SHALL residir em um arquivo de texto versionado no repositório, e não embutida no código.

O arquivo SHALL descrever a estrutura esperada do resumo e os pontos que ele deve cobrir, de modo que a equipe possa revisá-lo e alterá-lo como qualquer outro documento do projeto.

#### Scenario: Instrução aplicada à geração

- **GIVEN** que o arquivo de instrução define a estrutura do resumo
- **WHEN** um resumo é gerado
- **THEN** a instrução vigente no arquivo é enviada junto ao conteúdo do documento

#### Scenario: Instrução alterada

- **GIVEN** que a equipe alterou o arquivo de instrução
- **WHEN** um novo resumo é gerado
- **THEN** a nova instrução é aplicada
- **AND** os resumos já existentes permanecem inalterados até serem regerados

### Requirement: Armazenamento e reuso do resumo

O resumo produzido SHALL ser gravado no índice local, associado ao documento e à data de geração.

Uma consulta posterior ao mesmo documento SHALL reutilizar o resumo gravado, sem nova submissão à LLM.

O resumo SHALL ser assinalado como desatualizado quando o documento for alterado na fonte após a data de geração.

#### Scenario: Resumo reutilizado

- **GIVEN** que um documento já possui resumo gravado
- **WHEN** ele volta a aparecer em uma busca
- **THEN** o resumo gravado é apresentado
- **AND** nenhuma submissão à LLM é realizada

#### Scenario: Documento alterado após o resumo

- **GIVEN** que um documento possui resumo gravado
- **WHEN** a fonte informa alteração posterior à data do resumo
- **THEN** o resumo é apresentado assinalado como desatualizado
- **AND** o usuário pode solicitar a regeração

### Requirement: Painel de resumo

O sistema SHALL apresentar um painel à direita da lista de resultados, contendo o resumo do documento em foco, o nome do documento e sua fonte.

Ao concluir uma busca, o painel SHALL apresentar o resumo do **primeiro** documento do resultado.

Cada resultado SHALL oferecer uma ação de gerar o resumo. Acioná-la SHALL substituir o conteúdo do painel pelo resumo daquele documento, sem alterar a lista de resultados.

O painel NÃO SHALL ser apresentado quando não houver resultado em foco.

#### Scenario: Resumo do primeiro resultado

- **GIVEN** que uma busca retornou resultados
- **WHEN** a lista é apresentada
- **THEN** o painel apresenta o resumo do primeiro documento

#### Scenario: Resumo solicitado em outro documento

- **GIVEN** que o painel apresenta o resumo de um documento
- **WHEN** o usuário aciona a geração de resumo em outro resultado
- **THEN** o painel passa a apresentar o resumo do documento escolhido
- **AND** a lista de resultados permanece inalterada

#### Scenario: Geração em andamento

- **GIVEN** que o usuário solicitou um resumo ainda não gerado
- **WHEN** a submissão à LLM está em andamento
- **THEN** o painel apresenta indicação de carregamento
- **AND** a lista de resultados permanece utilizável

#### Scenario: Busca sem resultados

- **GIVEN** que a busca não retornou documentos
- **WHEN** a tela é apresentada
- **THEN** o painel de resumo não é apresentado

### Requirement: Falha na geração do resumo

A falha ao gerar um resumo NÃO SHALL impedir a apresentação dos resultados da busca.

O sistema SHALL distinguir credencial inválida, limite de requisições excedido e falha de comunicação, informando ao usuário qual ocorreu.

#### Scenario: Falha ao gerar o resumo

- **GIVEN** que uma busca retornou resultados
- **WHEN** a geração do resumo do primeiro documento falha
- **THEN** a lista de resultados permanece apresentada normalmente
- **AND** o painel informa o motivo da falha

#### Scenario: Cota da LLM excedida

- **GIVEN** que a cota da chave da LLM foi atingida
- **WHEN** o usuário solicita um resumo
- **THEN** o sistema informa que o limite foi excedido
- **AND** indica que a operação pode ser repetida mais tarde

#### Scenario: Chave da LLM não configurada

- **GIVEN** que nenhuma chave de LLM foi configurada
- **WHEN** os resultados da busca são apresentados
- **THEN** o painel informa que o recurso exige configuração
- **AND** oferece acesso à tela de configurações
