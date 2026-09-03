# Proposta — Categoria de documento a partir do resumo por IA

**Issue:** #94
**Status:** Proposto
**Data:** 02/09/2026

## Why

Buscar um documento pelo nome não diz o que ele é — encontrar "a ata de terça" ainda exige abrir cada resultado. Uma primeira tentativa de resolver isso (`classificar-documentos-por-tipo`) classificava todo o acervo em massa, com vocabulário aberto, e foi revertida nesta mesma sessão: o mesmo gênero de documento recebia rótulos diferentes de uma classificação para outra (ex.: `ADR-0001` como "Registro de decisão", `ADR-0003` como "ADR"), tornando o filtro que ela alimentava pouco confiável.

O resumo por IA (`resumos-por-ia`) já produz um campo `tipo` por documento, hoje só exibido no painel de resumo, sob demanda. Fechar seu vocabulário e reaproveitá-lo, em vez de criar um processo de classificação separado, resolve a mesma necessidade sem repetir o erro: não há um segundo mecanismo para divergir do primeiro.

## What Changes

- **Vocabulário fechado para o campo `tipo` do resumo:** a IA passa a escolher entre uma lista fixa de 14 rótulos (`Ata, ADR, Especificação, Levantamento, Pesquisa, Processo, Padrão, Manual, Relatório, Contrato, Edital, Formulário, Glossário, Template`), nunca um rótulo livre. Sem confiança em nenhum item da lista, o documento fica sem categoria — não recebe mais o rótulo genérico `"Documento"` que a instrução usa hoje.
- **Renomeado para `categoria`** e retirado do painel de resumo: onde hoje aparece "Tipo identificado" em `PainelResumo.tsx`, deixa de aparecer. Passa a aparecer como selo no cartão do documento na lista de resultados, ao lado da extensão.
- **Persistência espelhada:** o valor, hoje só em `RegistroConteudo` (não consultado pela busca), passa a ser copiado para `RegistroAcervo` como `categoria` + a versão de conteúdo em que foi atribuído — o que a busca de fato consulta.
- **Filtro por categoria na busca:** dropdown de seleção única, populado dinamicamente com as categorias já atribuídas no acervo.
- **BREAKING:** resumos já gerados e persistidos são apagados por esta mudança (não migrados) — a estrutura hoje grava resumo, tipo, assuntos e destaques como um único bloco versionado pelo conteúdo, então não é possível corrigir só o campo tipo sem invalidar o conjunto. Cada documento recebe um resumo (e uma categoria) novos, sob a regra fechada, na próxima vez em que for resumido — automaticamente, ao voltar a ser o primeiro resultado de uma busca, ou sob pedido.
- Continua sem varredura em massa, sem fila própria e sem novo fluxo de consentimento: a categoria nasce da mesma submissão que já produz o resumo, disparada do mesmo jeito que hoje (automática para o primeiro resultado, sob demanda para os demais).
- `assuntos` permanece como está — vocabulário livre, não filtrável, fora do escopo desta mudança.

## Capabilities

### New Capabilities

_Nenhuma. A categoria é um atributo do resumo já existente, não um processo novo._

### Modified Capabilities

- `resumos-por-ia`: o campo `tipo` da submissão passa a ter vocabulário fechado (lista fixa), sem fallback genérico, renomeado `categoria`, retirado da exibição do painel, espelhado em `RegistroAcervo` para consulta pela busca. Resumos já persistidos são apagados nesta mudança.
- `busca-documentos`: adiciona um requisito de filtro por categoria — dropdown de seleção única, dinâmico, distinto do filtro por extensão de arquivo já existente ("Filtro por tipo de documento").

## Impact

**Relação com `classificar-documentos-por-tipo` (revertida).** Aquela mudança tentava o mesmo objetivo por um caminho diferente — classificação em massa, campo próprio (`tipos`, plural, até 2 valores), coleção e fila dedicadas. O mecanismo técnico de vocabulário fechado que ela validou (enum no `responseSchema` do Gemini, filtro defensivo no código) é reaproveitado aqui; o resto — fila própria, varredura em massa, consentimento próprio — não se aplica, porque esta mudança nasce dentro da submissão que o resumo já faz.

**Nomenclatura.** "Categoria" evita colidir com o requisito já existente "Filtro por tipo de documento" (`busca-documentos`), que filtra por extensão de arquivo, não pela classificação por IA — mesma distinção já registrada em `CONTEXT.md`.

**Código:** `AncorAI/instrucoes/resumo.md` (instrução), `AncorAI/src/main/llm/gemini.ts` (schema e interpretação da resposta), `AncorAI/src/main/banco/repositorio.ts` (persistência em `RegistroAcervo`, migração dos resumos existentes), `AncorAI/src/compartilhado/tipos.ts` (tipos compartilhados), `AncorAI/src/renderer/componentes/PainelResumo.tsx` (remove a exibição), `AncorAI/src/renderer/componentes/Cartao.tsx` (selo), `AncorAI/src/renderer/componentes/Filtros.tsx` (dropdown), `AncorAI/src/main/busca/regras.ts` e `servico.ts` (filtro).
