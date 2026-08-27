# Proposta — MVP de busca de documentos (aplicação desktop)

**Issue:** #65
**Status:** Proposto
**Data:** 27/08/2026

## 1. Problema

O conhecimento do projeto está distribuído entre o GitHub e o Google Drive, sem um ponto único de consulta. Isso gera três dificuldades concretas:

- **Contextualização lenta de novos integrantes:** quem entra no projeto não sabe quais documentos existem nem onde estão.
- **Dificuldade de localizar processos:** documentos de processo (ADR, padronizações, atas) estão espalhados entre as duas fontes.
- **Baixa visibilidade sobre a produção documental:** não há como acompanhar o que foi criado ou alterado recentemente pelos stakeholders.

## 2. Objetivo

Entregar um MVP funcional de aplicação **desktop** que consulte GitHub e Google Drive via API e permita localizar documentos por nome, com filtros e ordenação, apresentando também os documentos alterados recentemente já na abertura do sistema.

## 3. O que será alterado

Esta é a primeira mudança de implementação do projeto — não há código existente. A mudança cria:

- a aplicação desktop (Electron) e sua tela principal de busca;
- a camada de integração com GitHub API e Google Drive API;
- a configuração de credenciais pela interface, com persistência segura;
- a rotina de inicialização que lista documentos recentes;
- a persistência local de links de documentos acessados.

## 4. Capacidades afetadas

| Capacidade | Situação |
| --- | --- |
| `busca-documentos` | Adicionada |
| `integracao-fontes` | Adicionada |
| `configuracao-credenciais` | Adicionada |
| `documentos-recentes` | Adicionada |
| `historico-acessos` | Adicionada |

## 5. Fora de escopo nesta mudança

Os itens abaixo estão registrados no levantamento de requisitos mas **não** serão implementados agora:

| Item | Requisitos afetados | Motivo |
| --- | --- | --- |
| Resumos por IA (Gemini) | RF13–RF19, RN12–RN21, CB03, CB08 | Adiado por decisão de escopo do MVP. A estrutura de persistência já prevê o campo. |
| Autenticação, login e perfil | — | Já estava fora do escopo inicial. |
| Busca por conteúdo / full-text | RF02, RN02 | Mantido fora nesta versão; tratado nas issues #49 e #55. |
| Autor do documento nos resultados | — (citado na ata de 24/08) | Custo de uma chamada adicional por arquivo no GitHub. Adiado. |

> **Atenção:** o fluxo principal descrito na seção 2 do `LevantamentoRequisitosFluxo.md` é construído em torno da decisão *"Resumo existe?"*. Com os resumos fora do MVP, aquele diagrama não descreve o comportamento desta entrega. A atualização do documento de requisitos foi deliberadamente deixada para uma issue posterior.

## 6. Impacto

### Decisões arquiteturais registradas

Esta mudança consolida três reversões de decisões anteriores, cada uma registrada em ADR própria:

- **ADR-0001** — Plataforma desktop com Electron (substitui a escolha por aplicação Web).
- **ADR-0002** — Persistência local (substitui Firebase Firestore e Cloud Functions).
- **ADR-0003** — Credenciais informadas pela interface e protegidas por `safeStorage`.

### Documentação com divergência conhecida

O documento `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` permanece descrevendo a arquitetura Web/Firebase nas seções 2.3, 12, 13, 17 e 21. As ADRs referenciam essas seções explicitamente. A atualização do documento não faz parte desta mudança.

### Dependências externas

- GitHub REST API — Personal Access Token com escopo de leitura.
- Google Drive API — chave de acesso.

Nenhum serviço pago é necessário. A remoção do Cloud Functions elimina a exigência do plano Blaze apontada na pesquisa tecnológica.
