# Proposta — Resumos por IA e índice local de documentos

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

Encontrar um documento pelo nome não diz o que há dentro dele. Quem busca "requisitos" precisa abrir cada resultado para descobrir qual serve, e documentos cujo nome não contém o termo procurado não aparecem — mesmo tratando exatamente do assunto. Os resumos por IA estavam previstos desde o levantamento inicial e foram adiados no MVP; os campos de persistência já existem reservados para eles.

## Objetivo

Permitir que a busca alcance documentos pelo assunto, além do nome literal, e apresentar um resumo gerado por IA do documento em foco.

Esta é a segunda de duas mudanças. A primeira, `melhorar-busca-e-apresentacao`, trata de filtros, ordenação, paginação e autoria, e não depende desta.

## What Changes

- **Índice local de documentos**, com nome, caminho, link, metadados e classificação. A busca passa a consultá-lo primeiro e só recorre às APIs quando o índice não responde ou está defasado.
- **Classificação por IA na indexação:** cada documento passa uma vez pela LLM, que produz assunto, tipo e etiquetas, gravados no índice. É o que viabiliza a busca por contexto.
- **BREAKING (postura de dados):** o conteúdo dos documentos passa a ser enviado a um serviço externo (Google Gemini). Até hoje o sistema guarda **apenas o link de redirecionamento, nunca o conteúdo**, e nada do conteúdo deixa a máquina. Exige ADR.
- **Chamadas à LLM em série, uma por vez** — nunca em lote paralelo.
- **Resumo por IA** do documento em foco, apresentado em painel à direita, com o do primeiro resultado gerado assim que a busca retorna.
- **Botão de gerar resumo em cada resultado**, substituindo o conteúdo do painel.
- **Reuso do resumo:** uma vez gravado no índice, o resumo é reaproveitado nas buscas seguintes, sem nova chamada à LLM.
- **Arquivo de instrução versionado** no repositório, definindo como a LLM deve redigir o resumo — revisável como qualquer outro documento do projeto.
- **Chave da API do Gemini** configurável na tela de configurações, protegida como as demais credenciais.

## Capabilities

### New Capabilities

- `indice-local`: índice de documentos no banco local, sua atualização incremental, a classificação por IA que o enriquece e a precedência do índice sobre as consultas às APIs.
- `resumos-por-ia`: geração, armazenamento, reuso e apresentação dos resumos, incluindo o arquivo de instrução que orienta a LLM.

### Modified Capabilities

- `busca-documentos`: a correspondência deixa de considerar apenas o nome do arquivo e passa a alcançar assunto, tipo e etiquetas registrados no índice.
- `configuracao-credenciais`: passa a haver uma terceira credencial, a chave da API do Gemini, com o mesmo tratamento de proteção das demais.

## Impact

**Confidencialidade — o ponto central.** O conteúdo dos documentos passa a ser enviado ao Google. No plano gratuito da API do Gemini o conteúdo submetido pode ser usado para melhorar os produtos do Google e passar por revisão humana; no plano pago, não. A equipe decidiu prosseguir com a chave gratuita, ciente disso, por se tratar de documentos do próprio projeto acadêmico. **Exige ADR**, que deve nomear o risco e registrar a decisão — a ADR-0002 e as especificações vigentes afirmam que o conteúdo nunca é armazenado nem sai da máquina, e essa afirmação deixa de valer.

**Cota gratuita.** A classificação percorre todos os documentos, uma chamada por documento e uma de cada vez. Para o volume atual do repositório isso é rápido; para um acervo grande, a indexação leva tempo e precisa ser incremental, retomável e informar progresso.

**Código:** módulo novo de LLM no processo principal, `banco/repositorio.ts` (coleção de índice, campos `resumo` e `resumoEm` já reservados), `busca/servico.ts` (precedência do índice), `credenciais/cofre.ts` e `ipc.ts` (chave nova, canais de resumo e indexação), e o painel lateral no renderer.

**Dependência nova:** API do Google Gemini, acessada por HTTP direto, sem SDK — mesma disciplina adotada para GitHub e Drive.
