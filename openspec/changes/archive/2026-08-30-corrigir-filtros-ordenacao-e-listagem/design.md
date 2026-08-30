## Context

Ver `proposal.md` — Why para a motivação. O que importa aqui são as três restrições estruturais que explicam por que os defeitos existem e limitam as soluções possíveis.

**A paginação acontece no processo principal, e o renderer só recebe a página.** `servico.buscar` e `servico.recentes` filtram, ordenam, recortam dez documentos e devolvem `{ documentos, total, pagina }`. O renderer nunca teve o resultado completo em mãos. Quando `App.aoAlterarFiltros` detecta que só a ordenação mudou, ele chama `ordenar(atual.documentos, ...)` sobre os dez documentos que possui — é o máximo que a informação disponível permite, e é justamente por isso que o resultado está errado.

**A especificação proíbe reconsultar as fontes ao trocar a ordenação.** O requisito existe por um motivo concreto: cada consulta ao GitHub gasta cota e faz o usuário esperar. A correção, portanto, não pode ser "reconsultar com a ordenação nova". Ela precisa reorganizar um conjunto que já está em memória.

**O GitHub não fornece data por arquivo na árvore Git.** `github.buscarDocumentos` percorre a árvore e atribui a cada arquivo o `pushed_at` do repositório, marcando o documento com `dataAproximada`. A data real exige uma requisição por arquivo (`github.autoriaDoArquivo`), que hoje só roda para a página apresentada, depois de a lista estar na tela. A lista de recentes não tem essa limitação: ela vem dos commits e já traz a data real.

## Goals / Non-Goals

**Goals:**

- O critério de ordenação escolhido governa o resultado inteiro, e a troca de critério não custa nenhuma requisição.
- O filtro de período recorta por data de documento, e o que a tela mostra é consequência do intervalo escolhido.
- A ordem apresentada nunca contradiz as datas apresentadas.
- O controle de ordenação fica junto do que ele governa.

**Non-Goals:**

- **Não** se resolve a data real de todos os documentos em toda busca. Só quando há período definido, porque só aí o dado decide quem entra no resultado.
- **Não** se cria índice local nem se persiste o conjunto vigente de uma consulta. O que se retém é estado efêmero de sessão, descartado ao fechar a aplicação.
- **Não** se altera a paginação de dez por página, nem o teto de trinta recentes, nem a política de cota da ingestão de conteúdo.
- **Não** se mexe no painel de resumo além da consequência de layout de mover a linha de contador e ordenação.

## Decisions

### 1. O conjunto vigente da consulta fica retido no processo principal

Trocar a ordenação precisa reorganizar todos os documentos encontrados sem tocar na rede. Isso exige que alguém guarde o resultado completo entre uma interação e a seguinte.

**Decisão:** o processo principal retém, em memória, o conjunto já filtrado da última consulta, junto dos filtros que o produziram. Um novo canal IPC — `busca:reordenar` — recebe o critério e a página desejada, reordena esse conjunto e devolve a página correspondente, sem consultar fonte alguma. Quando não houver conjunto retido (primeira interação após reinício, ou filtros divergentes), o canal recai na consulta normal.

**Por que no main e não no renderer.** O renderer poderia guardar o resultado completo se o main o enviasse inteiro, mas isso significaria trafegar o acervo por IPC a cada consulta para usar dez itens dele — e o número de documentos não tem teto conhecido. Reter no main mantém o tráfego proporcional ao que se apresenta.

**Alternativas consideradas:**

- *Devolver o resultado completo ao renderer e paginar lá.* Simplifica o main e elimina o canal novo, mas move o acervo inteiro pela fronteira IPC a cada consulta e transfere a paginação para a camada que a especificação descreve como apresentação. Descartada.
- *Reconsultar as fontes ao trocar a ordenação.* Contraria explicitamente o requisito `Ordenação dos resultados` e gasta cota. Descartada.
- *Persistir o conjunto no banco local.* O conjunto é resultado transitório de uma interação, não dado do usuário. Persistir criaria um estado a invalidar sem benefício algum. Descartada.

**Retenção é por consulta, não cache.** O conjunto retido não é reaproveitado como resposta a uma consulta nova: qualquer alteração de termo, tipo, fonte ou período o descarta e dispara consulta às fontes, como a especificação exige. Ele serve exclusivamente para reordenar e repaginar o que já foi obtido.

### 2. A data real é resolvida antes do filtro, e só quando há período

O caminho já existe: `enriquecerParaBusca` resolve a autoria antes da filtragem quando há termo, justamente porque o termo é comparado ao autor e filtrar antes de conhecê-lo descartaria o que se procura. O período tem exatamente a mesma forma: o filtro compara contra a data, e filtrar por uma data aproximada é filtrar por outra coisa.

**Decisão:** generalizar `enriquecerParaBusca` para resolver o que a consulta vigente precisa. Havendo termo, resolve para alcançar o autor; havendo período, resolve para alcançar a data; havendo os dois, resolve uma vez e serve aos dois — `detalhar` já devolve autor e data juntos, e chamá-lo duas vezes dobraria o custo sem trazer dado novo. O teto e a concorrência existentes continuam valendo.

**Documento não resolvido some quando há período.** Um documento marcado como `dataAproximada` cuja data real não foi obtida — porque ficou além do teto, ou porque a requisição falhou — não é apresentado enquanto houver período em vigor. Mantê-lo seria afirmar que ele está no intervalo sem que isso tenha sido verificado. O usuário é informado do alcance efetivo pelo aviso já previsto.

**Alternativa considerada:** filtrar pela data aproximada e remover depois, quando o detalhamento revelar a data real. Custa menos requisições, mas faz a lista encolher na frente do usuário depois de apresentada, e o contador de total fica errado no intervalo entre uma coisa e outra. Descartada na consulta ao usuário.

### 3. Definir período aciona a coleta do acervo, mesmo sem termo

A tela inicial usa `github.documentosRecentes`, que percorre os cinco repositórios de atividade mais recente e dez commits de cada. É uma janela estreita por desenho — e o desenho está certo para o que ela serve. O que está errado é aplicar um recorte por data sobre ela: um período de março devolve lista vazia não porque o acervo não tenha documentos de março, mas porque a janela não os alcança.

**Decisão:** havendo período definido, a consulta passa a usar a coleta do acervo (`github.buscarDocumentos`), como uma busca sem termo. Sem período e sem termo, a tela inicial continua vindo dos commits recentes, com data real e custo baixo.

O critério que decide a rota deixa de ser "o campo de busca está vazio" e passa a ser "há filtro que exija o acervo". Isso concentra numa única condição o que hoje está espalhado entre `mostrandoRecentes` no renderer e a escolha de coletor no serviço.

**Alternativa considerada:** ampliar a janela de recentes. Reduz o problema sem eliminá-lo — qualquer janela finita continua devolvendo vazio para períodos anteriores a ela — e encarece a abertura da aplicação, que é justamente o que a janela estreita protege. Descartada na consulta ao usuário.

### 4. O recorte dos trinta recentes vem antes da ordenação escolhida

`prepararRecentes` hoje ordena pelo critério do usuário e só então corta em trinta. Escolher "A–Z" faz o corte selecionar os trinta primeiros em ordem alfabética: muda **quais** documentos compõem a lista, não apenas a ordem deles.

**Decisão:** inverter as duas operações. O recorte passa a ser feito sempre por recência — os trinta mais recentes —, e o critério escolhido ordena esse conjunto já definido. A lista de recentes passa a conter os mesmos documentos em qualquer ordenação.

### 5. O detalhamento reordena a lista

`detalharPagina` substitui os documentos preservando as posições. Como ele troca a data aproximada pela real, a lista rotulada "Data decrescente" passa a exibir datas fora de ordem.

**Decisão:** aplicar `ordenar` sobre a página depois de substituir os documentos detalhados. É reordenação local de dez itens, sem consulta e sem indicador de carregamento.

**Limite conhecido, e deliberado.** Reordenar a página não corrige a composição dela: quando não há período definido, quais documentos caem na página um continua sendo decidido pelas datas aproximadas. Corrigir isso exigiria resolver a data de todo o acervo em toda busca — o custo que a decisão 2 restringe ao caso em que o dado é determinante. O efeito prático é contido: sem período, a tela inicial vem dos commits e já tem data real; com período, a decisão 2 resolve o acervo candidato. Resta a busca por termo ordenada por data, onde a ordem entre páginas segue a atividade do repositório e o aviso correspondente continua sendo apresentado.

### 6. A linha de contador e ordenação entra na coluna dos resultados

`.linha-lista` é irmã de `.area-resultados` e ocupa a largura toda; `.area-resultados` é uma grade de duas colunas com o painel de resumo à direita. O seletor, alinhado à direita da linha, cai sobre o painel.

**Decisão:** mover a linha para dentro da primeira coluna da grade, acima da lista. Ela passa a ter a largura da lista, e o alinhamento à direita passa a ser o da lista. A grade permanece com duas colunas; abaixo de 1080px, onde o painel já desce para baixo da lista, a linha acompanha a lista sem tratamento adicional.

**Consequência sobre o estado vazio.** A linha hoje é irmã dos blocos de estado vazio e de carregamento, e some junto com eles pelas mesmas condições. Movida para dentro de `.area-resultados`, que só é renderizada quando há documentos, ela deixa de precisar da condição `documentos.length > 0` — o que já é o comportamento especificado.

## Risks / Trade-offs

**[O conjunto retido diverge do que a tela mostra]** → A retenção guarda os filtros que a produziram. `busca:reordenar` compara os filtros recebidos com os retidos e, divergindo em qualquer campo que não seja ordenação ou página, recai na consulta normal em vez de devolver dado velho.

**[Consumo de memória do conjunto retido]** → Guarda-se um conjunto por vez, substituído a cada consulta nova, contendo metadados de documento e nunca conteúdo. A ordem de grandeza é a mesma do que hoje já transita por IPC em uma busca.

**[O período fica caro na primeira aplicação]** → Uma requisição por documento candidato, contida pelo teto existente. O cache por `ETag` torna as aplicações seguintes baratas: um `304` não consome cota. Mitigação adicional: resolver apenas os documentos marcados como `dataAproximada` — os que vieram dos commits já têm data real e não geram requisição alguma.

**[O período passa a esconder documentos]** → É a consequência pretendida, mas ela precisa ser visível. O aviso de alcance é obrigatório quando o acervo excede o teto, e a `REMOVED`/substituição do aviso antigo em `integracao-fontes` existe para que não fiquem os dois na tela dizendo coisas diferentes.

**[Período na tela inicial fica mais lento que hoje]** → Passa a percorrer o acervo em vez da janela de recentes. É o custo de o filtro alcançar o que ele diz alcançar; o indicador de carregamento já cobre a espera, e a rota barata continua valendo enquanto não houver período.

**[Testes existentes cobrem o comportamento antigo]** → `ordenacao-local.test.tsx` afirma que trocar a ordenação não gera chamada IPC alguma; com a decisão 1 ela passa a gerar uma chamada que não consulta as fontes. O teste precisa mudar de asserção — de "nenhuma chamada" para "nenhuma consulta às fontes" —, e essa distinção é exatamente o que a especificação exige.

## Migration Plan

Não há migração de dados: nada do que muda é persistido. O conjunto retido nasce vazio a cada abertura da aplicação, e a primeira consulta o preenche.

A reversão é o `revert` dos commits. O canal `busca:reordenar` é aditivo — remover a chamada no renderer devolve o comportamento anterior sem deixar estado inconsistente para trás.
