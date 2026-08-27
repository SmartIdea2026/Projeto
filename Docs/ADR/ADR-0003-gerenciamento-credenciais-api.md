# ADR 0003: Gerenciamento das credenciais de API pela interface

**Status:** Proposto
**Data:** 27/08/2026

## Contexto/Problema

A seção 13 de `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` estabelece duas regras de segurança: *"As credenciais das APIs não devem ser armazenadas no frontend"* e a orientação de utilizar OAuth quando aplicável, *"evitando solicitar tokens diretamente ao usuário pela interface"*. O RNF02 do levantamento de requisitos complementa, definindo que as credenciais seriam estáticas e definidas diretamente no código.

Ambas as regras pressupunham a arquitetura Web original, na qual existia um backend remoto — Cloud Functions — capaz de guardar as credenciais fora do alcance do usuário e do navegador.

Com a adoção de aplicação desktop (ADR-0001) e a remoção do backend remoto (ADR-0002), esse pressuposto deixa de existir. Não há mais um servidor onde esconder a credencial: a aplicação executa inteiramente na máquina do usuário, e qualquer credencial que ela utilize estará necessariamente nessa máquina.

Além disso, credenciais estáticas no código são incompatíveis com a distribuição de um executável: exigiriam recompilação a cada troca de token e colocariam o segredo no repositório.

É necessário decidir como a aplicação obtém e protege as credenciais do GitHub e do Google Drive.

## Decisão Tomada

As credenciais serão **informadas pelo usuário em dois campos na tela de configurações**, um por fonte.

O tratamento seguirá três regras:

1. A credencial é enviada da camada de interface ao processo principal por IPC no momento em que é informada, e **não é mantida no estado da interface**.
2. A credencial é persistida por meio do `safeStorage` do Electron, que utiliza o mecanismo de proteção de segredos do sistema operacional.
3. Todas as chamadas às APIs externas são realizadas pelo processo principal. A interface recebe apenas resultados já normalizados, e nunca a credencial de volta.

Esta decisão substitui a orientação da seção 13 de `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` e o RNF02 de `Docs/Requisitos/LevantamentoRequisitosFluxo.md`.

## Justificativa

* Preserva a **intenção** da seção 13 — manter credenciais fora da camada de interface — na única forma possível sem um backend remoto: a fronteira de proteção deixa de ser cliente/servidor e passa a ser *renderer*/*main*.
* O processo *renderer* é exatamente onde conteúdo não controlado pela equipe é apresentado: nomes de arquivos, caminhos e metadados vindos do GitHub e do Drive. Manter a credencial fora dele reduz o alcance de uma eventual falha nessa camada.
* O `safeStorage` delega a proteção ao chaveiro do sistema operacional, evitando que a credencial fique legível em disco.
* Campos na interface permitem que cada integrante utilize a própria credencial, sem recompilar a aplicação e sem que qualquer segredo entre no repositório.
* Atende ao requisito de produto de que o sistema funcione assim que houver credenciais válidas, sem etapa de configuração externa ao aplicativo.

## Alternativas Consideradas

* **Credenciais estáticas no código (RNF02 original):** descartada por exigir recompilação a cada alteração, impedir que cada integrante use a própria credencial e criar risco de versionamento do segredo.
* **`localStorage` do navegador, citado na ata de 24/08:** descartada por duas razões. A credencial ficaria armazenada em texto legível e, sobretudo, residiria no processo *renderer* — precisamente a camada que renderiza conteúdo externo.
* **Arquivo `.env` não versionado:** descartada por eliminar os campos de configuração na interface, transferindo ao usuário a edição manual de um arquivo, sem oferecer ganho real de cifragem: o arquivo permanece em texto legível em disco, com exposição equivalente à do `localStorage` para qualquer processo executado pelo mesmo usuário.
* **OAuth, conforme sugerido na seção 13:** descartada para o MVP por exigir registro de aplicação junto aos provedores e um fluxo de redirecionamento, complexidade que a equipe decidiu não assumir nesta etapa. Permanece como evolução natural, especialmente para o Google Drive.

## Consequências

* **Positivas:** nenhum segredo no repositório; cada integrante usa a própria credencial; troca de credencial sem recompilar; credencial protegida pelo chaveiro do sistema operacional e ausente da camada de interface.
* **Negativas:** o texto da seção 13 do documento de pesquisa e o RNF02 passam a divergir do comportamento vigente; a aplicação assume a responsabilidade de proteger a credencial, antes atribuída ao backend; o usuário precisa gerar e informar tokens manualmente.
* **Riscos:** um token do GitHub com escopo amplo concede acesso a todos os repositórios do usuário. Mitigação: orientar o uso de *fine-grained tokens* com permissão de leitura restrita aos repositórios necessários, conforme já previsto na seção 8 do documento de pesquisa. Risco adicional: o `safeStorage` depende do chaveiro do sistema operacional e pode comportar-se de forma distinta entre plataformas, exigindo validação em cada ambiente utilizado pela equipe.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* `Docs/Organizacao/Processo/Reuniao/Atas/24-08-2026-sprint-planning.md`
* `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md`, seções 8 e 13
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md`, RNF02
* `openspec/changes/criar-mvp-busca-desktop/specs/configuracao-credenciais/spec.md`
* ADR-0001 — Plataforma desktop com Electron
* ADR-0002 — Persistência local
