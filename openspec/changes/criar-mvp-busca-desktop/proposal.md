# Proposta — MVP de busca de documentos (aplicação desktop)

**Issue:** #65
**Status:** Proposto
**Data:** 27/08/2026

## Why

O conhecimento do projeto está distribuído entre o GitHub e o Google Drive, sem um ponto único de consulta. Isso gera três dificuldades concretas:

- **Contextualização lenta de novos integrantes:** quem entra no projeto não sabe quais documentos existem nem onde estão.
- **Dificuldade de localizar processos:** documentos de processo (ADR, padronizações, atas) estão espalhados entre as duas fontes.
- **Baixa visibilidade sobre a produção documental:** não há como acompanhar o que foi criado ou alterado recentemente pelos stakeholders.

## Objetivo

Entregar um MVP funcional de aplicação **desktop** que consulte o GitHub via API e permita localizar documentos por nome, com filtros e ordenação, apresentando também os documentos alterados recentemente já na abertura do sistema.

O Google Drive integrava o escopo original e foi retirado do MVP pela ADR-0004: o escopo `drive.readonly` é restrito pelo Google e exigiria avaliação de segurança CASA para publicação, ou conviveria com expiração da autorização a cada 7 dias. A arquitetura permanece multi-fonte, e a retomada depende de a instituição dispor de Google Workspace.

## What Changes

Esta é a primeira mudança de implementação do projeto — não há código existente. A mudança cria:

- a aplicação desktop (Electron) e sua tela principal de busca;
- a camada de integração com a GitHub API, construída para receber outras fontes;
- a configuração de credenciais pela interface, com persistência segura;
- a rotina de inicialização que lista documentos recentes;
- a persistência local de links de documentos acessados.

## Capacidades afetadas

| Capacidade | Situação |
| --- | --- |
| `busca-documentos` | Adicionada |
| `integracao-fontes` | Adicionada |
| `configuracao-credenciais` | Adicionada |
| `documentos-recentes` | Adicionada |
| `historico-acessos` | Adicionada |

## Fora de escopo nesta mudança

Os itens abaixo estão registrados no levantamento de requisitos mas **não** serão implementados agora:

| Item | Requisitos afetados | Motivo |
| --- | --- | --- |
| Resumos por IA (Gemini) | RF13–RF19, RN12–RN21, CB03, CB08 | Adiado por decisão de escopo do MVP. A estrutura de persistência já prevê o campo. |
| Autenticação, login e perfil | — | Já estava fora do escopo inicial. |
| Busca por conteúdo / full-text | RF02, RN02 | Mantido fora nesta versão; tratado nas issues #49 e #55. |
| Autor do documento nos resultados | — (citado na ata de 24/08) | Custo de uma chamada adicional por arquivo no GitHub. Adiado. |
| Integração com o Google Drive | RF05 (parcial), RN24 | Retirada pela ADR-0004: escopo `drive.readonly` é restrito pelo Google. |

Dois requisitos saíram dos deltas junto com o Drive, e ficam registrados aqui para não se perderem:

* **Autorização do Google Drive** — o acesso seria concedido por consentimento explícito do usuário, realizado fora da aplicação, permanecendo válido entre execuções.
* **Filtro por fonte** — o usuário selecionaria GitHub, Drive ou ambos. O modelo de dados preserva a seleção (`filtros.fontes`, lista vazia significando todas), mas o seletor não é apresentado enquanto houver uma fonte só.

Eles não entram em `## ADDED Requirements` porque o `archive` grava os deltas em `openspec/specs/` como verdade vigente, e o sistema não os satisfaz.

> **Atenção:** o fluxo principal descrito na seção 2 do `LevantamentoRequisitosFluxo.md` é construído em torno da decisão *"Resumo existe?"*. Com os resumos fora do MVP, aquele diagrama não descreve o comportamento desta entrega. A atualização do documento de requisitos foi deliberadamente deixada para uma issue posterior.

## Impacto

### Decisões arquiteturais registradas

Esta mudança consolida três reversões de decisões anteriores, cada uma registrada em ADR própria:

- **ADR-0001** — Plataforma desktop com Electron (substitui a escolha por aplicação Web).
- **ADR-0002** — Persistência local (substitui Firebase Firestore e Cloud Functions).
- **ADR-0003** — Credenciais informadas pela interface e protegidas por `safeStorage`.

### Documentação com divergência conhecida

O documento `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` permanece descrevendo a arquitetura Web/Firebase nas seções 2.3, 12, 13, 17 e 21. As ADRs referenciam essas seções explicitamente. A atualização do documento não faz parte desta mudança.

### Dependências externas

- GitHub REST API — Personal Access Token com escopo de leitura.

Nenhum serviço pago é necessário. A remoção do Cloud Functions elimina a exigência do plano Blaze apontada na pesquisa tecnológica.
