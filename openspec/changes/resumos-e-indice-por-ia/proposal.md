# Proposta — Resumos por IA e índice local de documentos

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

Encontrar um documento pelo nome não diz o que há dentro dele. Quem busca "requisitos" precisa abrir cada resultado para descobrir qual serve, e documentos cujo nome não contém o termo procurado não aparecem — mesmo tratando exatamente do assunto. Os resumos por IA estavam previstos desde o levantamento inicial e foram adiados no MVP; os campos de persistência já existem reservados para eles.

## Objetivo

Permitir que a busca alcance documentos pelo assunto, além do nome literal, classificando todo o acervo por IA.

Esta é a terceira de três mudanças relacionadas. `melhorar-busca-e-apresentacao` tratou de filtros, ordenação, paginação e autoria, e não depende desta. `painel-de-resumo-por-ia` recortou desta o resumo do documento em foco — capacidade `resumos-por-ia` — e a credencial da LLM, por entregarem valor visível de forma independente e mais rápida; esta mudança depende daquela para a integração com a LLM já existente (chave, cliente HTTP, fila de submissões) e a reaproveita em vez de reconstruí-la.

## What Changes

- **Índice local de documentos**, com nome, caminho, link, metadados e classificação. A busca passa a consultá-lo primeiro e só recorre às APIs quando o índice não responde ou está defasado.
- **Classificação por IA na indexação:** cada documento passa uma vez pela LLM, que produz assunto, tipo e etiquetas, gravados no índice. É o que viabiliza a busca por contexto.
- **Classificação em série, uma por vez**, reaproveitando a fila de submissões de concorrência um que `painel-de-resumo-por-ia` já implementou para o resumo — a mesma fila, o mesmo limite de requisições por minuto.
- **Precedência do trabalho interativo** (busca, resumo) sobre a classificação de fundo, pelo mesmo mecanismo (`prioridade.ts`) que já dá precedência à busca sobre a ingestão.

## Capabilities

### New Capabilities

- `indice-local`: índice de documentos no banco local, sua atualização incremental, a classificação por IA que o enriquece e a precedência do índice sobre as consultas às APIs.

### Modified Capabilities

- `busca-documentos`: a correspondência deixa de considerar apenas o nome do arquivo e passa a alcançar assunto, tipo e etiquetas registrados no índice.

## Impact

**Recorte para `painel-de-resumo-por-ia`.** Esta mudança continha originalmente as capacidades `resumos-por-ia` e o delta de `configuracao-credenciais` (a chave da API do Gemini). As duas passaram para `painel-de-resumo-por-ia`, que as entrega de forma independente. Esta mudança fica com o que de fato lhe resta: o índice local, a classificação de **todo** o acervo e a busca por contexto — e depende da integração com a LLM que aquela mudança constrói (chave, cliente HTTP, fila de concorrência um), reaproveitando-a em vez de reconstruí-la.

**Confidencialidade.** O envio do conteúdo dos documentos a um serviço externo (Google Gemini) já foi decidido e registrado pela ADR-0006, na mudança `painel-de-resumo-por-ia`. A classificação em massa desta mudança usa a mesma autorização e as mesmas condições — plano gratuito, consentimento prévio já obtido, submissão mínima — sem exigir ADR própria.

**Cota gratuita.** A classificação percorre todos os documentos, uma chamada por documento e uma de cada vez, na mesma fila que atende ao resumo interativo. Para o volume atual do repositório isso é rápido; para um acervo grande, a indexação leva tempo e precisa ser incremental, retomável e informar progresso.

**Código:** `banco/repositorio.ts` (coleção de índice), `busca/servico.ts` (precedência do índice), e o módulo de LLM já criado por `painel-de-resumo-por-ia` (cliente do Gemini, fila de submissões), estendido para também classificar.
