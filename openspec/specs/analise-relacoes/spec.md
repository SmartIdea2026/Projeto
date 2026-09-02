# analise-relacoes Specification

## Purpose

Relacionar documentos do acervo entre si pela sobreposição dos rótulos de classificação que a IA já produz — assuntos e tipo —, apresentando, a partir do documento em foco, uma pilha dos documentos mais próximos para que o usuário percorra o acervo pelo tema e não só pelo nome do arquivo.

## Requirements

### Requirement: Pilha de documentos relacionados ao documento em foco

Quando o painel apresenta um documento que possui classificação por IA (assuntos e tipo), o sistema SHALL montar uma pilha dos demais documentos do acervo ordenada por proximidade de assunto e apresentá-la no painel.

A pilha SHALL conter no máximo **5 documentos**. Cada item SHALL identificar o documento pelo nome.

A pilha SHALL ser montada **sob demanda**, no processo principal, sem ser persistida. Ela SHALL ser refeita quando o foco do painel muda e quando o resumo do documento em foco é regerado.

O documento em foco NÃO SHALL aparecer na própria pilha.

#### Scenario: Documento em foco com classificação

- **GIVEN** que o painel apresenta um documento com assuntos e tipo classificados
- **AND** que há outros documentos classificados no acervo
- **WHEN** o painel é apresentado
- **THEN** o painel apresenta uma pilha de até 5 documentos relacionados
- **AND** cada item traz o nome do documento

#### Scenario: Troca de foco refaz a pilha

- **GIVEN** que o painel apresenta a pilha de um documento
- **WHEN** o foco do painel passa a outro documento
- **THEN** a pilha é refeita para o novo documento em foco

#### Scenario: Regeração do resumo refaz a pilha

- **GIVEN** que o painel apresenta a pilha de um documento
- **WHEN** o resumo desse documento é regerado, mudando seus assuntos
- **THEN** a pilha é refeita a partir dos assuntos novos

#### Scenario: Documento em foco sem classificação

- **GIVEN** que o documento em foco ainda não tem assuntos classificados
- **WHEN** o painel é apresentado
- **THEN** nenhuma pilha é montada
- **AND** o painel informa que não há pilha enquanto o documento não tiver resumo

### Requirement: Critério de proximidade entre documentos

A proximidade entre dois documentos SHALL derivar da sobreposição dos seus conjuntos de assuntos. Assuntos **raros no acervo** SHALL pesar mais do que assuntos comuns, e dois documentos do **mesmo tipo** SHALL receber um acréscimo fixo de proximidade.

Os destaques do resumo NÃO SHALL entrar no cálculo.

Um documento SHALL entrar na pilha apenas quando compartilha **ao menos dois assuntos** com o documento em foco, ou **ao menos um assunto raro**. Documentos abaixo desse limiar NÃO SHALL ser apresentados, ainda que a pilha tenha menos de 5 itens.

A pilha SHALL ser ordenada por proximidade decrescente. O sistema NÃO SHALL usar embeddings, vetores ou similaridade semântica calculada por modelo.

#### Scenario: Ordenação por sobreposição

- **GIVEN** um documento em foco com os assuntos A, B e C
- **AND** um documento X que compartilha A e B, e um documento Y que compartilha apenas A e um assunto raro
- **WHEN** a pilha é montada
- **THEN** ambos aparecem na pilha
- **AND** sua ordem reflete o grau de sobreposição, com o assunto raro pesando mais que um assunto comum

#### Scenario: Documento abaixo do limiar

- **GIVEN** um documento que compartilha apenas um assunto comum com o documento em foco
- **WHEN** a pilha é montada
- **THEN** esse documento não aparece na pilha

#### Scenario: Mesmo tipo aproxima

- **GIVEN** dois documentos que compartilham os mesmos assuntos com o documento em foco
- **AND** apenas um deles é do mesmo tipo do documento em foco
- **WHEN** a pilha é montada
- **THEN** o do mesmo tipo aparece antes

### Requirement: A pilha não carrega conteúdo de documento

O canal que devolve a pilha ao renderer SHALL carregar apenas a identificação, o nome e o link de cada documento. Ele NÃO SHALL devolver o texto do documento, trecho dele ou qualquer rótulo de classificação.

#### Scenario: Resposta da pilha sem texto

- **WHEN** a pilha de um documento é solicitada
- **THEN** a resposta contém identificação, nome e link de cada item
- **AND** não contém texto de documento nem trecho

### Requirement: Cobertura parcial enquanto o acervo não está todo classificado

A pilha SHALL considerar apenas os documentos que já possuem classificação por IA. Quando houver documentos do acervo ainda sem classificação, o sistema SHALL acrescentar um **aviso** informando quantos documentos ficaram fora da análise, pelo mesmo canal de avisos usado para resultado parcial da busca.

O aviso SHALL deixar de ser emitido quando todos os documentos do acervo estiverem classificados.

#### Scenario: Acervo parcialmente classificado

- **GIVEN** que parte dos documentos do acervo ainda não foi classificada por IA
- **WHEN** a pilha de um documento é montada
- **THEN** apenas os documentos classificados são considerados
- **AND** um aviso informa quantos documentos ficaram fora da análise

#### Scenario: Acervo inteiramente classificado

- **GIVEN** que todos os documentos do acervo têm classificação por IA
- **WHEN** a pilha de um documento é montada
- **THEN** nenhum aviso de cobertura parcial é emitido

### Requirement: Apresentação da pilha no painel

O painel SHALL apresentar a pilha em um bloco próprio, abaixo do resumo, dos assuntos e dos destaques, com um título que a identifique.

O bloco SHALL cobrir os estados: **default** (pilha apresentada), **hover** e **focus** sobre um item, **loading** (pilha sendo montada, com indicação de progresso), **empty** (nenhum documento relacionado encontrado) e **error** (a montagem falhou).

Uma falha ao montar a pilha NÃO SHALL impedir a apresentação do resumo, dos assuntos, dos destaques nem da ação de abrir o documento.

Acionar um item da pilha SHALL passar o foco do painel para aquele documento — o mesmo efeito de acionar um resultado da lista. A ação de abrir o documento na fonte permanece separada, pela ação já existente no painel.

#### Scenario: Nenhum documento relacionado

- **GIVEN** que o documento em foco tem classificação, mas nenhum outro documento atinge o limiar de proximidade
- **WHEN** o painel é apresentado
- **THEN** o bloco informa que nenhum documento relacionado foi encontrado

#### Scenario: Montagem em andamento

- **GIVEN** que o foco do painel acabou de mudar
- **WHEN** a pilha ainda está sendo montada
- **THEN** o bloco apresenta indicação de progresso

#### Scenario: Falha ao montar a pilha

- **GIVEN** que o painel apresenta um documento
- **WHEN** a montagem da pilha falha
- **THEN** o bloco informa a falha
- **AND** o resumo, os assuntos, os destaques e a ação de abrir permanecem apresentados e utilizáveis

#### Scenario: Navegação por um item da pilha

- **GIVEN** que o painel apresenta a pilha de um documento
- **WHEN** o usuário aciona um item da pilha
- **THEN** o painel passa a apresentar o documento daquele item
- **AND** a lista de resultados permanece inalterada
