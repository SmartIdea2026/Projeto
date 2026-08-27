# ADR 0001: Adoção de aplicação desktop com Electron

**Status:** Proposto
**Data:** 27/08/2026

## Contexto/Problema

A pesquisa tecnológica registrada em `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` avaliou aplicação Web e aplicação desktop com Electron, e concluiu na seção 2.3 pela aplicação Web, sob o argumento de que *"não existe atualmente uma necessidade técnica evidente de utilizar Electron"*. A seção 21 consolidou essa escolha na decisão final.

Na reunião de planejamento de 24/08/2026, a equipe reavaliou a decisão sob outro critério: não a necessidade de recursos do sistema operacional, mas a facilidade de entrega e de apresentação da ferramenta. A ata registra a decisão de migrar o aplicativo do formato web para desktop, visando simplificar os processos de deploy e a apresentação futura da ferramenta.

Essa reversão nunca foi registrada como decisão arquitetural, permanecendo apenas na ata. O documento de pesquisa continua descrevendo a arquitetura Web como vigente.

## Decisão Tomada

O AncorIA será desenvolvido como **aplicação desktop utilizando Electron**, com React e TypeScript na camada de interface.

Esta decisão substitui a escolha por aplicação Web registrada nas seções 2.3 e 21 de `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`.

## Justificativa

* Elimina a necessidade de hospedagem e de um processo de deploy para disponibilizar o sistema à equipe.
* Simplifica a apresentação da ferramenta em reuniões de Review, por dispensar ambiente publicado e conexão com serviço remoto.
* Permite que a aplicação opere inteiramente no cliente, o que viabiliza a persistência local decidida na mesma reunião e registrada na ADR-0002.
* Preserva o investimento na stack já escolhida: a própria seção 5 do documento de pesquisa observa que o frontend React *"pode ser reaproveitado em uma aplicação Electron caso isso seja necessário futuramente"*.
* Permite que credenciais e chamadas às APIs externas fiquem fora da camada de interface, no processo principal, conforme a ADR-0003.

## Alternativas Consideradas

* **Aplicação Web (escolha original):** descartada porque exigiria hospedagem, um fluxo de deploy e, na arquitetura originalmente prevista, um backend remoto para proteger as credenciais. Para uma ferramenta de uso interno pela própria equipe, esse custo operacional não se justifica no MVP.
* **Aplicação Web executada apenas localmente:** descartada por não resolver a distribuição — cada integrante precisaria executar o projeto manualmente — e por manter as credenciais na camada do navegador.

## Consequências

* **Positivas:** dispensa hospedagem e deploy; simplifica a apresentação; viabiliza persistência e credenciais locais; mantém React e TypeScript, sem perda do trabalho de prototipação.
* **Negativas:** exige instalação pelos usuários; a distribuição de novas versões passa a depender de empacotamento; adiciona uma camada tecnológica à stack, exatamente como a seção 2.2 do documento de pesquisa havia apontado; o documento de pesquisa passa a divergir da arquitetura vigente em suas seções 2.3, 12, 13, 17 e 21.
* **Riscos:** o empacotamento multiplataforma pode consumir mais tempo que o previsto, especialmente se houver dependências nativas — risco relacionado ao registrado na ADR-0002. Mitigação: validar o empacotamento cedo, antes da conclusão das funcionalidades.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* `Docs/Organizacao/Processo/Reuniao/Atas/24-08-2026-sprint-planning.md`
* `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`, seções 2.2, 2.3, 5 e 21
* `openspec/changes/criar-mvp-busca-desktop/proposal.md`
* ADR-0002 — Persistência local
* ADR-0003 — Gerenciamento das credenciais de API
