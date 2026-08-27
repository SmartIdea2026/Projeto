# ADR 0002: Adoção de persistência local em substituição ao Firebase

**Status:** Proposto
**Data:** 27/08/2026

## Contexto/Problema

A pesquisa tecnológica em `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` definiu o Firebase como ecossistema de infraestrutura: Firestore como banco (seção 4.5), Firebase Hosting para o frontend e Cloud Functions para o backend (seção 12), consolidados no diagrama da seção 17.

Essa arquitetura apresenta dois pontos de atrito para o estágio atual do projeto. O primeiro é financeiro e está registrado na própria seção 12: *"Para utilizar Cloud Functions, o projeto precisa utilizar o plano Blaze, que exige uma conta de faturamento"*. O segundo é que a adoção de aplicação desktop (ADR-0001) elimina o componente que justificava o backend serverless — não há mais um frontend remoto a ser servido nem credenciais a proteger em um servidor.

A reunião de 24/08/2026 decidiu converter o banco em nuvem para armazenamento local, operando em modo client-side, sem servidor centralizado e sem login.

Permanecia em aberto qual seria a finalidade do banco no MVP, uma vez que a seção 11 do documento de pesquisa define o banco essencialmente como cache dos resumos gerados por IA — funcionalidade adiada nesta entrega. A equipe definiu que o banco armazenará os **links dos documentos já acessados** e, futuramente, os resumos.

## Decisão Tomada

A persistência será **local, em SQLite**, acessada exclusivamente pelo processo principal da aplicação Electron.

O banco armazenará os documentos acessados — identificação, nome, fonte, link de redirecionamento e data do acesso — e o cache das consultas às fontes externas. O esquema incluirá desde já as colunas destinadas aos resumos, mantidas vazias no MVP.

O conteúdo dos documentos **não** será armazenado; apenas o link que redireciona à fonte original.

Esta decisão substitui a escolha por Firestore, Firebase Hosting e Cloud Functions registrada nas seções 4.5, 12 e 17 de `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`.

## Justificativa

* Elimina a exigência do plano Blaze e a necessidade de uma conta de faturamento, removendo o principal ponto de atenção financeiro apontado na seção 21 do documento de pesquisa.
* Acompanha coerentemente a adoção de aplicação desktop: sem frontend hospedado nem backend remoto, o Firestore passaria a ser um serviço externo isolado, sem o benefício de integração que motivou sua escolha.
* Remove a dependência de conexão para funcionalidades que não exigem consulta às fontes externas.
* Dispensa autenticação: no modelo desktop, a instalação já delimita o usuário, o que torna viável registrar documentos acessados sem identificar o usuário. Isso resolve a restrição registrada na seção 1 de `Docs/Requisitos/LevantamentoRequisitosFluxo.md`, que colocava o registro de arquivos acessados fora do escopo justamente por depender da identificação do usuário.
* Reservar as colunas de resumo desde já evita migração de esquema quando a integração com IA for retomada.

## Alternativas Consideradas

* **Firebase Firestore (escolha original):** descartado por exigir plano Blaze e conta de faturamento, e por perder o benefício de integração com o restante do ecossistema Firebase após a migração para desktop.
* **Arquivo JSON com `lowdb`:** descartado por acomodar mal o crescimento previsto. O volume atual — links de acesso — seria adequado, mas os resumos por IA são textos extensos cuja consulta e atualização em arquivo JSON degradam rapidamente. Como o esquema já nasce preparado para os resumos, optou-se por evitar a migração futura.
* **Armazenamento local do navegador (`local storage`), citado na ata:** descartado por ficar na camada de interface, contrariando a separação adotada na ADR-0003, e por não oferecer consultas estruturadas.

## Consequências

* **Positivas:** custo zero de infraestrutura; nenhuma conta de faturamento; funcionamento sem servidor; consultas estruturadas disponíveis desde o MVP; esquema preparado para os resumos futuros.
* **Negativas:** os dados passam a ser locais a cada instalação, sem sincronização entre integrantes da equipe; um histórico de acessos registrado em uma máquina não estará disponível em outra; o documento de pesquisa passa a divergir da arquitetura vigente nas seções 4.5, 12 e 17.
* **Riscos:** a biblioteca `better-sqlite3` é um módulo nativo e exige recompilação para a versão do Electron utilizada, o que costuma gerar dificuldades de build e de empacotamento. Mitigação: validar o build empacotado logo no início da implementação e, caso o custo se mostre alto, reavaliar uma alternativa sem dependência nativa, registrando nova ADR.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* `Docs/Organizacao/Processo/Reuniao/Atas/24-08-2026-sprint-planning.md`
* `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`, seções 4.5, 11, 12, 17 e 21
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md`, seção 1
* `openspec/changes/criar-mvp-busca-desktop/design.md`, seção 7
* ADR-0001 — Plataforma desktop com Electron
