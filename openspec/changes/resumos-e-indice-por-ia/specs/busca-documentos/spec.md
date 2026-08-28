# Especificação — Busca de documentos

**Issue:** #65

## MODIFIED Requirements

### Requirement: Busca por termo

O sistema SHALL permitir que o usuário informe um termo e retorne os documentos cujo **nome, autor ou assunto** corresponda a esse termo.

A correspondência SHALL considerar, além do nome do arquivo e do autor da última alteração, o assunto, o tipo e as etiquetas registrados no índice pela classificação por IA. Restringir a correspondência ao nome deixava de fora documentos que tratam exatamente do assunto procurado, apenas por não o citarem no nome.

A correspondência por autor é acrescentada pela mudança `melhorar-busca-e-apresentacao` e está reproduzida aqui porque um bloco MODIFIED substitui o requisito inteiro: omiti-la desfaria aquela mudança no momento do arquivamento.

O conteúdo integral dos documentos NÃO SHALL ser percorrido a cada busca: a correspondência por assunto se dá sobre a classificação já registrada no índice.

Documentos ainda não classificados SHALL permanecer encontráveis pelo nome.

#### Scenario: Termo com correspondência

- **GIVEN** que existem documentos cujo nome contém o termo informado
- **WHEN** o usuário informa o termo e confirma a busca
- **THEN** o sistema apresenta os documentos correspondentes
- **AND** cada resultado exibe nome completo, extensão, data e fonte

#### Scenario: Termo sem correspondência

- **GIVEN** que nenhum documento possui nome ou autor correspondente ao termo
- **AND** que nenhum documento possui assunto ou etiqueta correspondente
- **WHEN** a busca é concluída
- **THEN** o sistema informa que nenhum documento foi encontrado

#### Scenario: Busca em andamento

- **GIVEN** que o usuário confirmou uma busca
- **WHEN** o sistema aguarda a resposta das fontes
- **THEN** o sistema apresenta um indicador de carregamento
- **AND** o indicador é removido quando os resultados são apresentados

#### Scenario: Correspondência por assunto e não por nome

- **GIVEN** que um documento trata do assunto procurado mas não o cita no nome
- **AND** que sua classificação registra esse assunto
- **WHEN** o usuário busca pelo termo
- **THEN** o documento aparece entre os resultados

#### Scenario: Correspondência pelo autor

- **GIVEN** que um documento foi alterado por uma pessoa cujo nome contém o termo
- **AND** que o nome do arquivo não contém o termo
- **WHEN** a busca é realizada
- **THEN** o documento aparece entre os resultados

#### Scenario: Acervo maior que o alcance da autoria

- **GIVEN** que o acervo excede o limite de documentos cuja autoria é obtida por busca
- **WHEN** o usuário realiza uma busca
- **THEN** o sistema informa que a correspondência por autor cobriu parte do acervo
- **AND** os documentos além do limite continuam sendo procurados pelo nome

#### Scenario: Documento ainda não classificado

- **GIVEN** que um documento consta do índice sem classificação
- **WHEN** o usuário busca por um termo contido em seu nome
- **THEN** o documento aparece entre os resultados
