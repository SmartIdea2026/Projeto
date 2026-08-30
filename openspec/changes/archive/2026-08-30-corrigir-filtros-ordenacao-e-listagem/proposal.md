# Proposta — Filtros, ordenação e listagem dos resultados

**Issue:** a definir
**Status:** Proposto
**Data:** 30/08/2026

## Why

A lista de resultados não obedece ao que o usuário escolhe. A mudança anterior, `melhorar-busca-e-apresentacao`, trouxe ordenação, paginação e autoria — e cada uma delas funciona isoladamente, mas juntas produzem uma lista que contradiz os próprios rótulos que exibe.

São quatro defeitos, todos observáveis na tela:

1. **A ordenação escolhida reorganiza apenas a página visível.** O renderer só tem em mãos os dez documentos da página; trocar o critério reordena esses dez e nada mais. Com mais de uma página, escolher "Nome (A–Z)" produz a ordem alfabética de um recorte arbitrário, não do resultado. A própria especificação exige o contrário: a paginação incide sobre o resultado já ordenado, de modo que a primeira página traga sempre os documentos de maior precedência.
2. **O filtro de período não filtra pela data do documento.** Na busca, todo arquivo herda o `pushed_at` do repositório. Definir um período filtra, na prática, por atividade do repositório: um documento intocado há um ano dentro de um repositório ativo entra no resultado. Hoje o sistema apenas avisa disso — e um filtro que avisa não estar filtrando não é um filtro.
3. **O detalhamento reescreve as datas sem reordenar a lista.** A autoria chega depois da lista aparecer e substitui a data aproximada pela data real do commit. As posições não mudam. O usuário fica olhando para uma lista rotulada "Data decrescente" cujas datas visíveis estão fora de ordem.
4. **O seletor de ordenação está alinhado à direita da página, e não dos resultados.** Como o painel de resumo ocupa a coluna da direita, o seletor aparece acima do painel — longe da lista que ele governa.

## Objetivo

Fazer com que a lista apresentada seja sempre consequência do que o usuário pediu: o critério de ordenação vale para o resultado inteiro, o período recorta por data de documento, e o controle de ordenação fica onde a lista está.

## What Changes

- **A ordenação passa a incidir sobre o resultado completo.** Trocar o critério reorganiza todos os documentos encontrados e recalcula as páginas, sem consultar as fontes de novo — o conjunto vigente da consulta fica retido no processo principal justamente para que a reordenação não custe rede.
- **O filtro de período passa a usar a data real do documento.** Havendo período definido, o sistema resolve a data de commit dos candidatos antes de aplicar o filtro, com teto e reaproveitamento de cache, do mesmo modo que já faz para alcançar o autor. Documentos cuja data real cai fora do intervalo não aparecem.
- **Definir um período passa a consultar o acervo.** Na tela inicial, o período deixa de ser um recorte sobre a janela estreita de commits recentes e passa a valer sobre o acervo completo, como uma busca sem termo. Sem isso, escolher um período antigo devolve uma lista vazia que não reflete o acervo.
- **A lista é reordenada quando o detalhamento traz datas reais.** Substituir a data de um documento sem reposicioná-lo deixa a ordem em desacordo com o que a tela mostra.
- **O corte dos 30 recentes deixa de depender da ordenação escolhida.** Hoje o corte vem depois de ordenar: escolher "A–Z" muda **quais** documentos entram na lista, e não apenas a ordem deles. O conjunto passa a ser definido por recência e só então ordenado pelo critério vigente.
- **Desempate determinístico.** Documentos com a mesma data desempatam por nome A–Z e, permanecendo o empate, pelo identificador — que é único. Nomes repetidos em repositórios diferentes são comuns (`README.md`, `ata.md`) e hoje saem em ordem instável entre consultas.
- **O seletor de ordenação e o contador passam para dentro da coluna de resultados**, com a ordenação encostada na borda direita da lista, não na do painel de resumo.

Nenhuma mudança aqui é incompatível: os defeitos corrigidos são divergências entre a implementação e as especificações já vigentes, e o que se acrescenta às specs são requisitos que a redação atual deixou em aberto.

## Capabilities

### New Capabilities

Nenhuma. Esta mudança corrige e detalha comportamento de capacidades existentes.

### Modified Capabilities

- `busca-documentos`: a ordenação passa a valer para o resultado completo e não para a página apresentada; o filtro de período passa a incidir sobre a data real do documento e a valer sobre o acervo; o desempate ganha critério final determinístico; o detalhamento passa a reposicionar os documentos cuja data mudar.
- `documentos-recentes`: o recorte da lista de recentes passa a ser definido por recência, independente do critério de ordenação escolhido; definir um período deixa de recortar a janela de recentes e passa a consultar o acervo.
- `integracao-fontes`: a data real de alteração deixa de ser obtida exclusivamente para a página apresentada — havendo período definido, ela é resolvida para os candidatos antes do filtro; o aviso de período sobre data aproximada é substituído pelo aviso de alcance da resolução.

## Impact

**Interface (`src/renderer/`)**
- `App.tsx`: a reordenação deixa de ser local sobre a página e passa a pedir a reorganização do conjunto vigente; o detalhamento passa a reordenar; contador e seletor mudam de lugar no JSX.
- `estilos/resultados.css` e `estilos/resumo.css`: a linha de contador e ordenação passa a ocupar a coluna dos resultados dentro da grade de duas colunas.

**Processo principal (`src/main/`)**
- `busca/servico.ts`: retenção do conjunto vigente da consulta; resolução de datas reais antes do filtro de período; correção da ordem entre ordenar e recortar os recentes; período passa a acionar a coleta do acervo.
- `busca/regras.ts`: sem mudança de contrato; o filtro de período continua onde está, agora recebendo documentos de data já resolvida.
- `ipc.ts`, `preload/index.ts`, `compartilhado/canais.ts`: nova operação de reordenar e paginar sem consultar as fontes.

**Compartilhado**
- `compartilhado/ordenacao.ts`: desempate final por identificador.

**Custo de rede.** Resolver a data real custa uma requisição por documento candidato na primeira consulta com período definido, contida por teto e amortizada pelo cache por `ETag` — um `304` não consome cota. É o preço de o filtro de período dizer a verdade, e incide **somente** quando há período definido.

**Testes.** `test/interface/ordenacao-local.test.tsx`, `test/interface/filtro-periodo.test.tsx` e `test/busca/paginacao.test.ts` cobrem hoje o comportamento antigo da reordenação local e precisam acompanhar o novo contrato.

**Documentação.** O `README.md` descreve o comportamento de filtros e ordenação e é atualizado na mesma entrega.
