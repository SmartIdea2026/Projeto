# ADR 0004: Modo de publicação do cliente OAuth do Google Drive

**Status:** Proposto
**Data:** 27/08/2026

## Contexto/Problema

A ADR-0003 definiu que o acesso ao Google Drive ocorre por OAuth 2.0, uma vez que uma chave de API autentica o projeto e não o usuário, e por isso não alcança documentos privados.

Ao documentar a criação do cliente OAuth, verificou-se que a plataforma do Google impõe restrições que dependem de como o aplicativo é publicado, e que afetam diretamente o uso diário do sistema:

1. **Expiração semanal da autorização.** Um cliente OAuth com tipo de usuário **Externo** e status de publicação **"Em teste"** recebe tokens de renovação que o Google invalida a cada 7 dias. Como o AncorIA persiste esse token justamente para não solicitar consentimento a cada abertura, a consequência prática é que cada integrante precisaria reconectar o Drive semanalmente.

2. **Restrição de quem pode autorizar.** Nesse mesmo modo, apenas contas previamente cadastradas como *usuários de teste* conseguem conceder o consentimento.

3. **Escopo restrito.** O escopo utilizado, `drive.readonly`, é classificado pelo Google como **restrito**. Publicar o aplicativo exige verificação, cujo processo para escopos dessa categoria costuma envolver avaliação de segurança.

A decisão sobre o modo de publicação não é um detalhe de configuração: ela determina se a integração com o Drive é utilizável no dia a dia ou se impõe uma tarefa recorrente a cada integrante.

Esta ADR registra o problema e as alternativas. **A decisão depende de uma informação que a equipe precisa confirmar:** se a instituição dispõe de Google Workspace.

## Decisão Tomada

*Pendente de deliberação da equipe.*

A recomendação técnica é adotar o **tipo de usuário Interno**, caso a instituição possua Google Workspace, por ser a única alternativa que elimina a expiração semanal sem exigir processo de verificação.

Não havendo Google Workspace, a equipe precisa escolher entre conviver com a reconexão semanal durante o MVP ou reavaliar a estratégia de acesso ao Drive.

## Justificativa

O critério determinante é o custo recorrente imposto ao usuário. Uma ferramenta cuja finalidade é reduzir o atrito para localizar documentos perde grande parte do seu valor se exigir uma reautorização manual por semana, de cada integrante.

O tipo Interno resolve o problema sem contrapartida relevante, mas depende de uma condição institucional que ainda não foi confirmada.

## Alternativas Consideradas

* **Tipo Interno (Google Workspace):** elimina a expiração de 7 dias e dispensa verificação. Limita o acesso às contas do domínio da instituição, o que é adequado para uma ferramenta de uso interno. **Depende de a instituição possuir Google Workspace.**

* **Tipo Externo em status de teste:** é o caminho imediato, sem qualquer processo de aprovação, e foi o modo assumido na documentação inicial. Impõe reconexão semanal e exige cadastrar cada integrante como usuário de teste. Aceitável para validar o MVP, insustentável como solução permanente.

* **Publicar o aplicativo com verificação:** remove a expiração para usuários externos, mas o escopo `drive.readonly` é restrito e sua aprovação envolve verificação junto ao Google, com esforço e prazo incompatíveis com o estágio atual do projeto.

* **Conta de serviço com pasta compartilhada:** não sofre expiração de autorização e dispensa consentimento interativo. Em contrapartida, alcança apenas os documentos explicitamente compartilhados com o endereço da conta de serviço, o que altera o modelo de acesso descrito na ADR-0003 e exige uma ação de compartilhamento por pasta. Foi descartada na ADR-0003 em favor do OAuth, mas volta a ser relevante caso o tipo Interno não esteja disponível.

## Consequências

* **Positivas:** registrar a limitação antes da adoção evita que a equipe descubra a expiração semanal apenas ao usar o sistema, quando o custo de mudar a estratégia já seria maior.
* **Negativas:** enquanto a decisão não for tomada, a integração com o Drive permanece funcional porém com autorização de vida curta. A documentação precisa advertir sobre isso.
* **Riscos:** se a instituição não possuir Google Workspace e a equipe optar por manter o modo de teste, a funcionalidade tende a cair em desuso pelo atrito da reconexão. Mitigação: reavaliar a conta de serviço como alternativa, registrando nova ADR que substitua parte da ADR-0003.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* ADR-0003 — Gerenciamento das credenciais de API
* `AncorIA/README.md`, seção "Limitações do OAuth do Google"
* Google Identity — *Using OAuth 2.0 for Installed Apps*
* Google API Console Help — *Setting up your OAuth consent screen*
