# ADR 0004: Remoção do Google Drive do MVP

**Status:** Aceito
**Data:** 27/08/2026

## Contexto/Problema

O Google Drive é uma das duas fontes previstas desde o levantamento de requisitos: o produto se define como busca unificada sobre os documentos da equipe, onde quer que estejam. A integração chegou a ser implementada por completo — `files.list` para busca e recentes, normalização para o formato unificado, e o fluxo OAuth 2.0 com PKCE e redirecionamento em *loopback* decidido durante a implementação, quando se constatou que uma chave de API não lista arquivos privados, pois autentica o projeto e não o usuário.

Essa implementação nunca foi verificada contra uma conta Google real, por depender de um cliente OAuth do tipo *Desktop app* que ainda não havia sido criado no Google Cloud.

Ao revisar o fluxo antes dessa verificação, identificou-se um impedimento que não é de implementação, e sim de política da plataforma. O escopo utilizado, `https://www.googleapis.com/auth/drive.readonly`, é classificado pelo Google como **restrito** — a categoria mais severa, acima de *sensitive*. Isso impõe duas condições, e nenhuma delas é contornável por código:

1. Enquanto o projeto no Google Cloud permanecer com status **Testing**, o *refresh token* expira em **7 dias** e há limite de **100 usuários de teste**, cada um cadastrado manualmente por e-mail.
2. Para publicar o aplicativo e remover essas restrições, o Google exige verificação com **avaliação de segurança CASA**, realizada por terceiro credenciado, paga e renovada anualmente.

Existe uma exceção: contas sob **Google Workspace** podem configurar a tela de consentimento como **Internal**, o que dispensa verificação e elimina a expiração de 7 dias. A equipe não confirmou se a instituição possui Workspace, e a viabilidade da fonte dependeria inteiramente desse fato.

O escopo `drive.readonly` não é substituível por um escopo menos restrito sem mudar o produto: a alternativa não restrita, `drive.file`, dá acesso apenas a arquivos que o próprio aplicativo criou ou que o usuário selecionou individualmente pelo Google Picker — o que elimina a busca sobre o Drive como um todo, que é a premissa da funcionalidade.

## Decisão Tomada

O **Google Drive é removido do escopo do MVP**.

A remoção alcança a superfície de produto por inteiro: a fonte, o fluxo OAuth, os canais IPC correspondentes, os campos da tela de configurações e o seletor de fonte na busca. O código não é mantido desativado no repositório — ele permanece recuperável no histórico do Git, no commit `0d6e6e8`.

A **arquitetura permanece multi-fonte**. O tipo `Fonte` continua sendo uma união, hoje com um único membro; a orquestração da busca continua percorrendo fontes, isolando falhas por fonte (CB05) e unificando resultados; `filtros.fontes` continua existindo, com lista vazia significando todas as fontes (RN04). O que sai é a implementação de uma fonte, não a capacidade de ter várias.

Esta decisão emenda a ADR-0003 no ponto em que ela prevê *"dois campos na tela de configurações, um por fonte"*: no MVP existe um campo, o do token do GitHub. As três regras de tratamento de credenciais estabelecidas por aquela ADR seguem integralmente válidas.

## Justificativa

* O impedimento é de política da plataforma, não de implementação. Nenhum esforço de engenharia remove a expiração de 7 dias de um escopo restrito em modo *Testing*.
* Entregar uma funcionalidade que exige reconexão semanal seria entregar um defeito previsível. O modo de falha apareceria justamente no uso prolongado — inclusive em uma apresentação agendada dias após o último teste.
* A avaliação CASA é incompatível com o projeto em custo e prazo.
* A alternativa `drive.file` não preserva a funcionalidade: descaracterizaria a busca no Drive, entregando algo com o mesmo nome e propósito diferente.
* Manter no repositório uma integração completa e jamais verificada é passivo: sugere uma capacidade que o produto não tem e que ninguém conseguiu exercitar.
* O GitHub sozinho entrega o fluxo central do produto — busca por nome, filtros, ordenação, recentes e abertura na fonte — e está verificado ponta a ponta contra a API real.

## Alternativas Consideradas

* **Aceitar o modo Testing:** descartada. Exigiria transformar a reconexão semanal em comportamento previsto de interface, agregando complexidade para sustentar uma limitação permanente.
* **Trocar para o escopo `drive.file`:** descartada por alterar o produto, e não apenas a implementação. Sem busca sobre o Drive inteiro, a fonte deixa de responder à necessidade que a motivou.
* **Depender de Google Workspace institucional:** descartada como premissa do MVP por não estar confirmada. Segue registrada como caminho de retomada.
* **Manter o código desativado no repositório:** descartada. Código não alcançável e não verificado envelhece sem sinal de erro, e o histórico do Git já cumpre o papel de preservá-lo.

## Consequências

* **Positivas:** o MVP passa a conter apenas o que foi verificado contra API real; some a dependência de um cadastro no Google Cloud para executar o sistema; a configuração se reduz a um campo; o escopo entregue é defensável sem ressalvas.
* **Negativas:** o produto entregue cobre uma das duas fontes previstas no levantamento de requisitos, e a proposta de valor de busca *unificada* fica parcialmente atendida no MVP; os cenários CB05 e CB06 deixam de ser verificáveis ponta a ponta, por não haver segunda fonte para isolar — restam cobertos apenas na forma reduzida e em teste unitário de `fonteSelecionada`.
* **Riscos:** a retomada do Drive depende de uma condição externa à equipe. Mitigação: confirmar com a coordenação se a instituição possui Google Workspace; em caso afirmativo, a fonte volta com consentimento *Internal*, sem verificação e sem expiração de 7 dias, restaurando o código a partir de `0d6e6e8`.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* Commit `0d6e6e8` — estado do código imediatamente antes da remoção
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md` — RF e RN relativos ao Google Drive
* `openspec/changes/criar-mvp-busca-desktop/specs/integracao-fontes/spec.md`
* ADR-0003 — Gerenciamento das credenciais de API pela interface (emendada por esta)
