## MODIFIED Requirements

### Requirement: Painel de resumo

O sistema SHALL apresentar um painel à direita da lista de resultados, contendo o nome do documento, a fonte de onde ele vem, o resumo em prosa, os destaques principais, a pilha de documentos relacionados e uma ação que abre o documento na fonte original.

Ao concluir uma busca com resultados, o painel SHALL passar a apresentar o **primeiro** documento da página.

Cada resultado SHALL oferecer uma ação de gerar o resumo. Acioná-la SHALL substituir o conteúdo do painel pelo daquele documento, **sem alterar a lista de resultados** nem a posição de rolagem dela.

Acionar um item da pilha de documentos relacionados SHALL ter o mesmo efeito: substituir o conteúdo do painel pelo daquele documento, sem alterar a lista de resultados nem a posição de rolagem dela.

O painel NÃO SHALL ser apresentado quando não houver documento em foco.

A ação de abrir o documento SHALL ter o mesmo efeito do link no resultado: redirecionar o usuário à fonte original. O painel NÃO SHALL apresentar o texto integral do documento.

#### Scenario: Resumo do primeiro resultado

- **GIVEN** que uma busca retornou resultados
- **WHEN** a lista é apresentada
- **THEN** o painel passa a apresentar o primeiro documento da página

#### Scenario: Resumo solicitado em outro documento

- **GIVEN** que o painel apresenta um documento
- **WHEN** o usuário aciona a geração de resumo em outro resultado
- **THEN** o painel passa a apresentar o documento escolhido
- **AND** a lista de resultados permanece inalterada

#### Scenario: Navegação por um documento relacionado

- **GIVEN** que o painel apresenta um documento e sua pilha de relacionados
- **WHEN** o usuário aciona um item da pilha
- **THEN** o painel passa a apresentar o documento daquele item
- **AND** a lista de resultados permanece inalterada

#### Scenario: Painel identifica a origem do documento

- **GIVEN** que o painel apresenta um documento
- **WHEN** ele é exibido
- **THEN** o nome do documento e a fonte de onde ele vem são apresentados

#### Scenario: Abertura pelo painel

- **GIVEN** que o painel apresenta um documento
- **WHEN** o usuário aciona a ação de abrir
- **THEN** o documento é aberto em sua fonte original
- **AND** o acesso é registrado como em qualquer outra abertura

#### Scenario: Busca sem resultados

- **GIVEN** que a busca não retornou documentos
- **WHEN** a tela é apresentada
- **THEN** o painel de resumo não é apresentado

### Requirement: Alcance do painel por teclado e por leitores de tela

O painel, a ação de gerar resumo em cada resultado e cada item da pilha de documentos relacionados SHALL ser alcançáveis por teclado, na ordem de leitura visual.

A troca do conteúdo do painel SHALL ser anunciada por leitores de tela, assim como a conclusão de uma geração.

A informação apresentada no painel NÃO SHALL depender apenas de cor para ser compreendida.

#### Scenario: Percurso por teclado

- **GIVEN** que a lista de resultados e o painel estão apresentados
- **WHEN** o usuário percorre a tela pelo teclado
- **THEN** a ação de gerar resumo de cada resultado, as ações do painel e os itens da pilha de relacionados são alcançados
- **AND** a ordem segue a leitura visual da tela

#### Scenario: Troca de conteúdo anunciada

- **GIVEN** que um leitor de tela está em uso
- **WHEN** o conteúdo do painel é substituído
- **THEN** a troca é anunciada

#### Scenario: Conclusão da geração anunciada

- **GIVEN** que uma geração estava em andamento
- **WHEN** o resumo é apresentado
- **THEN** a conclusão é anunciada
