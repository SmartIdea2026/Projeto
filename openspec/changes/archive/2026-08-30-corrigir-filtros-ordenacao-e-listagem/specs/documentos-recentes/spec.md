## MODIFIED Requirements

### Requirement: Critério de recência

Os documentos recentes SHALL ser ordenados pela data de modificação, do mais recente para o mais antigo, usando o nome em ordem A–Z como desempate.

Somente documentos dos tipos aceitos pelo sistema SHALL ser apresentados.

Esta ordenação é o **padrão inicial**, não uma imposição: quando o usuário escolher outro critério, a lista de recentes SHALL respeitá-lo. A redação anterior descrevia apenas o padrão, e a implementação passou a fixar a ordenação por data no código, descartando silenciosamente a escolha do usuário a cada recarga da lista.

Quando a lista for limitada a uma quantidade máxima de documentos, esse recorte SHALL ser feito **por recência**, antes de o critério escolhido pelo usuário ser aplicado. O critério de ordenação decide em que ordem os documentos recentes aparecem; ele NÃO SHALL decidir quais documentos são considerados recentes. Recortar depois de ordenar por nome faz "os mais recentes" significar "os primeiros em ordem alfabética", trocando o conteúdo da lista sem que nada na tela indique isso.

Na ausência de termo de busca e de filtro aplicado, a primeira página SHALL ser determinada exclusivamente pela data, do mais recente para o mais antigo, recorrendo aos demais critérios apenas para desempatar.

#### Scenario: Ordenação da lista de recentes

- **GIVEN** que documentos recentes foram obtidos das fontes configuradas
- **AND** que o usuário não alterou o critério de ordenação
- **WHEN** a lista é apresentada
- **THEN** os documentos aparecem do mais recentemente modificado para o mais antigo
- **AND** documentos com a mesma data aparecem entre si em ordem alfabética
- **AND** documentos de tipos não suportados não são apresentados

#### Scenario: Critério escolhido pelo usuário na tela inicial

- **GIVEN** que a lista de recentes está sendo apresentada
- **WHEN** o usuário escolhe ordenar por nome A–Z
- **THEN** a lista é reorganizada segundo o critério escolhido

#### Scenario: Critério preservado ao recarregar os recentes

- **GIVEN** que o usuário escolheu um critério de ordenação na tela inicial
- **WHEN** a lista de recentes é recarregada por alteração de tipo ou período
- **THEN** o critério escolhido continua aplicado
- **AND** a ordenação por data não é reimposta

#### Scenario: Recorte independente do critério escolhido

- **GIVEN** que as fontes devolveram mais documentos do que o limite da lista de recentes
- **WHEN** o usuário escolhe ordenar por nome A–Z
- **THEN** a lista contém os mesmos documentos que continha na ordenação por data
- **AND** apenas a ordem entre eles muda

#### Scenario: Primeira página sem termo nem filtro

- **GIVEN** que o campo de busca está vazio e nenhum filtro está aplicado
- **WHEN** a tela inicial é apresentada
- **THEN** o documento mais recentemente modificado aparece em primeiro lugar
- **AND** os demais o seguem em ordem decrescente de data

## ADDED Requirements

### Requirement: Período consulta o acervo

Definir um período na tela inicial SHALL fazer o sistema consultar o acervo dos documentos, e NÃO SHALL restringir a busca à janela de documentos recentes já obtida.

A lista de recentes cobre, por desenho, apenas a atividade mais recente das fontes. Aplicar um período sobre ela devolve uma lista vazia sempre que o intervalo escolhido for anterior a essa janela — e uma lista vazia é indistinguível, para quem observa a tela, de um acervo que realmente não tem documentos naquele intervalo.

#### Scenario: Período anterior à janela de recentes

- **GIVEN** que a tela inicial está apresentando os documentos recentes
- **WHEN** o usuário define um período anterior à atividade mais recente das fontes
- **THEN** o sistema consulta o acervo e apresenta os documentos daquele intervalo
- **AND** a lista não fica vazia por o intervalo estar fora da janela de recentes

#### Scenario: Período limpo volta aos recentes

- **GIVEN** que um período está aplicado sobre o acervo
- **AND** que o campo de busca está vazio
- **WHEN** o usuário limpa o período
- **THEN** a tela volta a apresentar os documentos recentes

#### Scenario: Consulta ao acervo em andamento

- **GIVEN** que o usuário definiu um período na tela inicial
- **WHEN** a consulta ao acervo está em andamento
- **THEN** o sistema apresenta o indicador de carregamento
- **AND** o indicador é removido quando os resultados são apresentados
