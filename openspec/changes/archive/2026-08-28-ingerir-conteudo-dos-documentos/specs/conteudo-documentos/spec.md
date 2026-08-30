# Especificação — Conteúdo dos documentos

**Issue:** #65

## Purpose

Trazer para dentro do sistema o conteúdo dos documentos das fontes integradas, extraindo seu texto e mantendo-o no armazenamento local, de modo que os recursos que dependem do que está escrito no documento possam ser construídos sobre ele. O conteúdo fica disponível ao sistema e nunca ao usuário final.

## ADDED Requirements

### Requirement: Obtenção do conteúdo junto à fonte

O sistema SHALL ser capaz de obter, junto à fonte, o conteúdo de um documento já identificado no inventário.

A obtenção do conteúdo NÃO SHALL ser condição para que o documento apareça nos resultados: um documento cujo conteúdo não pôde ser obtido continua encontrável pelo nome e continua abrindo na fonte original.

#### Scenario: Conteúdo obtido com sucesso

- **GIVEN** que um documento consta do inventário da fonte
- **WHEN** o sistema solicita seu conteúdo
- **THEN** o conteúdo do arquivo é recebido pelo processo principal

#### Scenario: Documento inacessível na fonte

- **GIVEN** que um documento consta do inventário
- **WHEN** a fonte recusa ou falha ao entregar seu conteúdo
- **THEN** o sistema registra que o conteúdo não foi obtido e o motivo
- **AND** o documento continua sendo apresentado nos resultados da busca

### Requirement: Extração do texto do documento

O sistema SHALL extrair o texto dos documentos obtidos, para cada formato aceito em que a extração seja possível.

Documentos cujo formato não permita extração, ou dos quais não se obtenha texto algum, SHALL ser registrados com o motivo, e NÃO SHALL produzir erro apresentado ao usuário.

#### Scenario: Formato com texto extraível

- **GIVEN** que o conteúdo de um documento em formato textual foi obtido
- **WHEN** a extração é executada
- **THEN** o texto do documento é produzido

#### Scenario: Formato sem extração disponível

- **GIVEN** que o conteúdo de um documento em formato não extraível foi obtido
- **WHEN** a extração é tentada
- **THEN** o documento é registrado como sem texto disponível, com o motivo
- **AND** nenhum erro é apresentado ao usuário

#### Scenario: Documento sem texto útil

- **GIVEN** que um documento foi obtido e sua extração não produziu texto algum
- **WHEN** o resultado da extração é avaliado
- **THEN** o documento é registrado como sem texto disponível
- **AND** o sistema não repete a extração enquanto o documento não for alterado na fonte

### Requirement: Armazenamento local do texto extraído

O sistema SHALL armazenar o texto extraído no armazenamento local, associado ao documento de origem, junto da data da extração e do estado do resultado.

O sistema NÃO SHALL armazenar os bytes originais do arquivo: apenas o texto extraído dele é persistido.

O registro dos documentos acessados SHALL continuar guardando apenas identificação, nome, fonte, link e data do acesso. O texto é armazenado separadamente e não integra esse registro.

#### Scenario: Texto extraído é gravado

- **GIVEN** que o texto de um documento foi extraído
- **WHEN** a extração é concluída
- **THEN** o texto é gravado no armazenamento local associado ao documento
- **AND** a data da extração é gravada junto

#### Scenario: Arquivo original não é guardado

- **GIVEN** que o conteúdo de um documento foi obtido e seu texto extraído
- **WHEN** a gravação é concluída
- **THEN** apenas o texto extraído consta do armazenamento
- **AND** os bytes originais do arquivo não são persistidos

#### Scenario: Registro de acesso permanece inalterado

- **GIVEN** que o usuário acessou um documento cujo texto o sistema possui
- **WHEN** o registro do acesso é gravado
- **THEN** esse registro contém apenas identificação, nome, fonte, link e data do acesso

### Requirement: Conteúdo confinado ao processo principal

O conteúdo dos documentos SHALL permanecer acessível apenas ao processo principal do sistema.

Nenhum canal de comunicação com a camada de interface SHALL devolver o conteúdo ou o texto extraído de um documento. A restrição é a mesma aplicada às credenciais.

A forma de visualizar um documento SHALL permanecer inalterada: o usuário é direcionado ao documento em sua fonte original, e o sistema não apresenta o conteúdo que armazena.

#### Scenario: Nenhum canal devolve conteúdo

- **GIVEN** que o sistema armazenou o texto de documentos
- **WHEN** qualquer canal disponível à camada de interface é acionado
- **THEN** nenhuma resposta contém o conteúdo ou o texto extraído de um documento

#### Scenario: Visualização do documento inalterada

- **GIVEN** que um documento é apresentado como resultado e seu texto já está armazenado
- **WHEN** o usuário aciona o documento
- **THEN** ele é direcionado ao documento na fonte original, como antes
- **AND** o sistema não apresenta o texto armazenado

### Requirement: Revalidação do conteúdo armazenado

O sistema SHALL reaproveitar o texto já armazenado enquanto a fonte indicar que o conteúdo do documento não foi alterado desde a obtenção anterior.

O sistema SHALL obter e extrair o conteúdo novamente quando a fonte indicar que o documento foi alterado, substituindo o texto armazenado.

#### Scenario: Documento inalterado na fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** o sistema verifica o documento e a fonte indica que o conteúdo não mudou
- **THEN** o texto armazenado é reaproveitado
- **AND** o conteúdo não é obtido novamente

#### Scenario: Documento alterado na fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** a fonte indica que o conteúdo do documento mudou
- **THEN** o sistema obtém o conteúdo novamente e extrai o texto
- **AND** substitui o texto armazenado pelo novo

#### Scenario: Documento removido da fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** o documento deixa de constar do inventário da fonte
- **THEN** o texto armazenado correspondente é descartado

### Requirement: Ingestão sob demanda e em segundo plano

O sistema SHALL obter o conteúdo de um documento sob demanda, quando algum recurso do sistema precisar do seu texto e ele ainda não estiver armazenado.

O sistema SHALL executar, além disso, uma ingestão de segundo plano que percorre os documentos do inventário ainda sem texto armazenado.

A ingestão de segundo plano SHALL ser incremental e retomável: interrompê-la NÃO SHALL exigir recomeçar, e o que já foi extraído permanece utilizável.

A ingestão NÃO SHALL bloquear a busca nem atrasar uma consulta feita pelo usuário.

#### Scenario: Ingestão sob demanda

- **GIVEN** que um recurso do sistema precisa do texto de um documento ainda não armazenado
- **WHEN** o texto é solicitado
- **THEN** o sistema obtém o conteúdo, extrai o texto e o armazena
- **AND** entrega o texto ao recurso que o solicitou

#### Scenario: Ingestão de segundo plano retomada

- **GIVEN** que a ingestão de segundo plano processou parte dos documentos e foi interrompida
- **WHEN** ela é retomada
- **THEN** apenas os documentos ainda sem texto armazenado são processados
- **AND** o que já havia sido extraído permanece armazenado

#### Scenario: Busca durante a ingestão

- **GIVEN** que a ingestão de segundo plano está em andamento
- **WHEN** o usuário realiza uma busca
- **THEN** a busca é atendida normalmente
- **AND** o tempo de resposta da busca não depende do término da ingestão

#### Scenario: Limite de requisições da fonte atingido

- **GIVEN** que a ingestão está em andamento
- **WHEN** a fonte recusa uma requisição por limite de requisições excedido
- **THEN** a ingestão é suspensa sem perder o que já foi extraído
- **AND** a busca continua funcionando

### Requirement: Limites de tamanho da ingestão

O sistema SHALL respeitar um limite de tamanho por documento e um limite para o total de texto armazenado.

Um documento que exceda o limite por arquivo NÃO SHALL ser obtido, e SHALL ser registrado como excedente, com o motivo.

Quando o total armazenado atingir o limite, a ingestão de segundo plano SHALL ser suspensa, e os documentos já processados SHALL permanecer utilizáveis.

Documentos deixados de fora por limite SHALL continuar encontráveis pelo nome e continuar abrindo na fonte original.

#### Scenario: Documento acima do limite por arquivo

- **GIVEN** que um documento do inventário excede o limite de tamanho por arquivo
- **WHEN** a ingestão o alcança
- **THEN** seu conteúdo não é obtido
- **AND** ele é registrado como excedente, com o motivo
- **AND** continua sendo apresentado nos resultados da busca

#### Scenario: Total armazenado no limite

- **GIVEN** que o total de texto armazenado atingiu o limite definido
- **WHEN** a ingestão de segundo plano tenta processar mais um documento
- **THEN** a ingestão é suspensa
- **AND** o texto já armazenado permanece disponível ao sistema
