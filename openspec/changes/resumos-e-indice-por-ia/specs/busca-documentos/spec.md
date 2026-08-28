# Especificação — Busca de documentos

**Issue:** #65

## MODIFIED Requirements

### Requirement: Busca por termo

O sistema SHALL permitir que o usuário informe um termo e retorne os documentos cujo **nome ou assunto** corresponda a esse termo.

A correspondência SHALL considerar, além do nome do arquivo, o assunto, o tipo e as etiquetas registrados no índice pela classificação por IA. Restringir a correspondência ao nome deixava de fora documentos que tratam exatamente do assunto procurado, apenas por não o citarem no nome.

O conteúdo integral dos documentos NÃO SHALL ser percorrido a cada busca: a correspondência por assunto se dá sobre a classificação já registrada no índice.

Documentos ainda não classificados SHALL permanecer encontráveis pelo nome.

#### Scenario: Termo com correspondência

- **GIVEN** que existem documentos cujo nome contém o termo informado
- **WHEN** o usuário informa o termo e confirma a busca
- **THEN** o sistema apresenta os documentos correspondentes
- **AND** cada resultado exibe nome completo, extensão, data e fonte

#### Scenario: Termo sem correspondência

- **GIVEN** que nenhum documento possui nome correspondente ao termo
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

#### Scenario: Documento ainda não classificado

- **GIVEN** que um documento consta do índice sem classificação
- **WHEN** o usuário busca por um termo contido em seu nome
- **THEN** o documento aparece entre os resultados
