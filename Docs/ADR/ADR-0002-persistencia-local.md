# ADR 0002: Adoção de banco NoSQL local em substituição ao Firebase

**Status:** Proposto
**Data:** 27/08/2026

## Contexto/Problema

A pesquisa tecnológica em `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` definiu o Firebase como ecossistema de infraestrutura: Firestore como banco (seção 4.5), Firebase Hosting para o frontend e Cloud Functions para o backend (seção 12), consolidados no diagrama da seção 17.

Essa arquitetura apresenta dois pontos de atrito para o estágio atual do projeto. O primeiro é financeiro e está registrado na própria seção 12: *"Para utilizar Cloud Functions, o projeto precisa utilizar o plano Blaze, que exige uma conta de faturamento"*. O segundo é que a adoção de aplicação desktop (ADR-0001) elimina o componente que justificava o backend serverless — não há mais um frontend remoto a ser servido nem credenciais a proteger em um servidor.

A reunião de 24/08/2026 decidiu converter o banco em nuvem para armazenamento local, operando em modo client-side, sem servidor centralizado e sem login.

Duas definições complementares foram estabelecidas pela equipe:

1. O banco armazenará os **links dos documentos já acessados** e, futuramente, os resumos gerados pela IA. Isso responde à dúvida sobre a finalidade do banco no MVP, uma vez que a seção 11 do documento de pesquisa o define essencialmente como cache dos resumos — funcionalidade adiada nesta entrega.
2. A persistência deve permanecer **NoSQL**, mantendo o modelo orientado a documentos adotado desde a escolha original pelo Firestore.

## Decisão Tomada

A persistência será um **banco NoSQL local orientado a documentos**, implementado com `@seald-io/nedb` e acessado exclusivamente pelo processo principal da aplicação Electron.

Serão mantidas duas coleções:

* `documentos_acessados` — identificação, nome, fonte, link de redirecionamento e data do acesso, com os campos de resumo reservados desde já;
* `cache_fontes` — respostas das APIs externas com seu `ETag` e data de atualização.

O conteúdo dos documentos **não** será armazenado; apenas o link que redireciona à fonte original.

Esta decisão substitui a escolha por Firestore, Firebase Hosting e Cloud Functions registrada nas seções 4.5, 12 e 17 de `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`.

## Justificativa

* Elimina a exigência do plano Blaze e a necessidade de uma conta de faturamento, removendo o principal ponto de atenção financeiro apontado na seção 21 do documento de pesquisa.
* Preserva o **modelo de documentos** já adotado pela equipe na escolha do Firestore. As estruturas gravadas localmente têm o mesmo formato que teriam na nuvem, o que mantém viável uma eventual volta ao Firestore sem redesenhar a camada de dados.
* Dispensa esquema fixo, o que é adequado a dados cujo formato ainda vai evoluir: os resumos por IA serão incorporados sem migração.
* Acompanha coerentemente a adoção de aplicação desktop: sem frontend hospedado nem backend remoto, o Firestore passaria a ser um serviço externo isolado, sem o benefício de integração que motivou sua escolha.
* `@seald-io/nedb` é implementado em JavaScript puro, sem dependências nativas. Isso elimina a etapa de recompilação para o Electron e o risco de build associado, que seria inevitável com um banco embarcado nativo.
* Dispensa autenticação: no modelo desktop, a instalação já delimita o usuário, o que torna viável registrar documentos acessados sem identificá-lo. Isso resolve a restrição registrada na seção 1 de `Docs/Requisitos/LevantamentoRequisitosFluxo.md`, que colocava o registro de arquivos acessados fora do escopo justamente por depender da identificação do usuário.

## Alternativas Consideradas

* **Firebase Firestore (escolha original):** descartado por exigir plano Blaze e conta de faturamento, e por perder o benefício de integração com o restante do ecossistema Firebase após a migração para desktop.
* **SQLite:** descartado por ser relacional, contrariando a definição da equipe de manter a persistência NoSQL. Some-se a isso o fato de ser um módulo nativo, exigindo recompilação para o Electron e introduzindo risco de empacotamento que a alternativa escolhida não possui.
* **Arquivo JSON com `lowdb`:** descartado por acomodar mal o crescimento previsto. O volume atual — links de acesso — seria adequado, mas os resumos por IA são textos extensos cuja consulta e atualização em um único arquivo JSON degradam rapidamente. `@seald-io/nedb` oferece o mesmo modelo de documentos com indexação e consultas.
* **PouchDB:** descartado por trazer um conjunto de recursos maior que o necessário. A sincronização com CouchDB, seu principal diferencial, não tem uso previsto enquanto a aplicação for local e monousuário.
* **Armazenamento local do navegador (`local storage`), citado na ata:** descartado por ficar na camada de interface, contrariando a separação adotada na ADR-0003, e por não oferecer consultas estruturadas.

## Consequências

* **Positivas:** custo zero de infraestrutura; nenhuma conta de faturamento; funcionamento sem servidor; modelo de documentos preservado, mantendo aberta a volta ao Firestore; esquema flexível, pronto para receber os resumos sem migração; ausência de dependência nativa, o que simplifica build e empacotamento.
* **Negativas:** os dados passam a ser locais a cada instalação, sem sincronização entre integrantes da equipe; um histórico de acessos registrado em uma máquina não estará disponível em outra; o documento de pesquisa passa a divergir da arquitetura vigente nas seções 4.5, 12 e 17.
* **Riscos:** `@seald-io/nedb` é um fork comunitário do NeDB, cujo desenvolvimento original foi descontinuado, o que representa risco de manutenção a longo prazo. Mitigação: manter o acesso ao banco isolado em um único módulo do processo principal, de modo que a substituição por outro armazenamento de documentos afete apenas esse ponto. Risco adicional: por carregar os dados em memória, o NeDB não é adequado a volumes muito grandes — aceitável para o uso previsto, mas a ser reavaliado caso o histórico ou os resumos cresçam além do esperado.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* `Docs/Organizacao/Processo/Reuniao/Atas/24-08-2026-sprint-planning.md`
* `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`, seções 4.5, 11, 12, 17 e 21
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md`, seção 1
* `openspec/changes/criar-mvp-busca-desktop/design.md`, seção 7
* ADR-0001 — Plataforma desktop com Electron
