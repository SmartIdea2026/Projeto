# Proposta — Busca e apresentação dos resultados

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

A lista de resultados não cumpre o que a especificação já promete: o critério de ordenação escolhido pelo usuário é descartado toda vez que a lista de recentes é recarregada, e as duas fontes de verdade sobre isso se contradizem entre si. Some-se a ausência de paginação — que faz a tela crescer sem limite — e a de autoria, sem a qual não se sabe quem produziu ou alterou um documento por último.

## Objetivo

Tornar a apresentação dos resultados fiel ao que a especificação descreve e ao protótipo aprovado: filtros e ordenação funcionais, paginação, contador de resultados e identificação de autoria.

Esta mudança **não** envolve IA. Ela é a primeira de duas: a segunda trata do índice local, da classificação por IA e do painel de resumo. A separação é deliberada — o que está aqui entrega valor sozinho e não depende de nenhuma decisão sobre o Gemini.

## What Changes

- **Ordenação passa a ser efetivamente aplicada.** `prepararRecentes` fixa `'data-desc'` no código e descarta `filtros.ordenacao`: na primeira tela, escolher outro critério não produz efeito assim que a lista é recarregada.
- **Desempate por nome.** Todo critério de data passa a usar nome A–Z como desempate. Sem isso os documentos do GitHub embaralham entre si, porque compartilham a mesma data aproximada do repositório.
- **BREAKING (contrato de especificação):** as specs vigentes se contradizem. `Nova consulta ao alterar filtros` exige nova consulta para *qualquer* filtro alterado; `Ordenação dos resultados` exige reorganizar *sem* consultar. A ordenação deixa de ser tratada como filtro de consulta.
- **Paginação de 10 resultados por página.**
- **Contador de resultados** com o total encontrado, oculto quando não há busca nem filtro ativo.
- **Autoria e data real de modificação** nos resultados, obtidas apenas para os documentos da página visível.
- **Disposição dos filtros** abaixo da barra de busca, com a ordenação à direita do contador, conforme o protótipo.

## Capabilities

### New Capabilities

Nenhuma. O comportamento alterado pertence a capabilities existentes.

### Modified Capabilities

- `busca-documentos`: a ordenação ganha desempate por nome e deixa de ser tratada como filtro de consulta, resolvendo a contradição entre dois requisitos vigentes; entram paginação e contador de resultados.
- `documentos-recentes`: a tela inicial passa a ordenar por data decrescente com desempate por nome, e a respeitar o critério escolhido pelo usuário em vez de descartá-lo.
- `integracao-fontes`: a normalização passa a incluir autoria e data real de modificação para os documentos apresentados.

## Impact

**Código:** `busca/servico.ts` (`prepararRecentes`, paginação), `compartilhado/ordenacao.ts` (desempate), `fontes/github.ts` (autoria por arquivo), `compartilhado/tipos.ts` (campos novos e paginação), `renderer/App.tsx`, `renderer/componentes/Filtros.tsx`, `renderer/componentes/Cartao.tsx`.

**API do GitHub:** autoria e data real exigem uma consulta a `/commits?path=` por arquivo — custo que motivou o adiamento deste item no MVP. A paginação de 10 o torna aceitável: consulta-se apenas a página visível, no máximo 10 chamadas por navegação, com cache por `ETag`.

**Especificações:** resolve a contradição entre `Nova consulta ao alterar filtros` e `Ordenação dos resultados`, hoje incompatíveis entre si.

**Sem impacto** em credenciais, persistência ou segurança. Nenhuma dependência nova.
