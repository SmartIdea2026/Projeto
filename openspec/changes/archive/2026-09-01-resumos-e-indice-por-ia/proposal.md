# Proposta — Índice local e classificação por IA

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

Encontrar um documento pelo nome não diz o que há dentro dele. Quem busca "requisitos" precisa abrir cada resultado para descobrir qual serve, e documentos cujo nome não contém o termo procurado não aparecem — mesmo tratando exatamente do assunto. Resolver isso de ponta a ponta exige duas partes: classificar o acervo por assunto, tipo e etiquetas, e fazer a busca consultar essa classificação. Esta mudança entrega a primeira parte.

## Objetivo

Manter um índice local dos documentos do acervo, com metadados e a classificação por IA (assunto, tipo, etiquetas), obtida em segundo plano.

Esta é a terceira de três mudanças relacionadas. `melhorar-busca-e-apresentacao` tratou de filtros, ordenação, paginação e autoria, e não depende desta. `painel-de-resumo-por-ia` recortou desta o resumo do documento em foco — capacidade `resumos-por-ia` — e a credencial da LLM, por entregarem valor visível de forma independente e mais rápida; esta mudança depende daquela para a integração com a LLM já existente (chave, cliente HTTP, fila de submissões) e a reaproveita em vez de reconstruí-la.

**Recorte de escopo.** A busca por contexto — fazer a busca consultar o índice e casar termo com assunto, tipo e etiquetas — foi deixada para uma mudança futura. O índice e a classificação já ficam prontos e testados; conectá-los à busca é trabalho novo e independente, e a equipe decidiu entregá-los separadamente em vez de segurar o que já está pronto.

## What Changes

- **Índice local de documentos**, com nome, caminho, link, metadados e classificação.
- **Classificação por IA na indexação:** cada documento passa uma vez pela LLM, que produz assunto, tipo e etiquetas, gravados no índice.
- **Classificação em série, uma por vez**, reaproveitando a fila de submissões de concorrência um que `painel-de-resumo-por-ia` já implementou para o resumo — a mesma fila, o mesmo limite de requisições por minuto.
- **Precedência do trabalho interativo** (busca, resumo) sobre a classificação de fundo, pelo mesmo mecanismo (`prioridade.ts`) que já dá precedência à busca sobre a ingestão.
- **Progresso da indexação na interface**, informando que a classificação ainda está em andamento sem bloquear a busca.

## Capabilities

### New Capabilities

- `indice-local`: índice de documentos no banco local, sua atualização incremental e a classificação por IA que o enriquece. Não inclui a busca consultá-lo — isso fica para uma mudança futura.

## Impact

**Recorte para `painel-de-resumo-por-ia`.** Esta mudança continha originalmente as capacidades `resumos-por-ia` e o delta de `configuracao-credenciais` (a chave da API do Gemini). As duas passaram para `painel-de-resumo-por-ia`, que as entrega de forma independente. Esta mudança depende da integração com a LLM que aquela mudança constrói (chave, cliente HTTP, fila de concorrência um), reaproveitando-a em vez de reconstruí-la.

**Busca por contexto adiada.** Ligar a busca ao índice — casar termo com assunto, tipo e etiquetas, com precedência do índice sobre as APIs — não faz parte desta entrega. `busca-documentos` permanece sem alteração.

**Confidencialidade.** O envio do conteúdo dos documentos a um serviço externo (Google Gemini) já foi decidido e registrado pela ADR-0006, na mudança `painel-de-resumo-por-ia`. A classificação em massa desta mudança usa a mesma autorização e as mesmas condições — plano gratuito, consentimento prévio já obtido, submissão mínima — sem exigir ADR própria.

**Cota gratuita.** A classificação percorre todos os documentos, uma chamada por documento e uma de cada vez, na mesma fila que atende ao resumo interativo. Para o volume atual do repositório isso é rápido; para um acervo grande, a indexação leva tempo e precisa ser incremental, retomável e informar progresso.

**Código:** `banco/repositorio.ts` (coleção de índice), `indice/servico.ts` (indexação em segundo plano), e o módulo de LLM já criado por `painel-de-resumo-por-ia` (`llm/gemini.ts`, `llm/fila.ts`), estendido para também classificar.
