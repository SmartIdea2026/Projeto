# ADR 0006: Envio do texto dos documentos a serviço externo de IA

**Status:** Proposto
**Data:** 01/09/2026

## Contexto/Problema

A ADR-0005 autorizou o sistema a armazenar localmente o texto extraído dos documentos, e fechou essa decisão com um limite explícito: o texto guardado permanece confinado à máquina onde a aplicação roda, acessível ao processo principal e nunca devolvido à interface. Ela também deixou registrado, na própria justificativa, que "enviá-lo a um serviço externo é uma decisão distinta, com riscos distintos, e exige ADR própria" — e é essa a decisão que falta tomar aqui.

Os recursos que o levantamento de requisitos previu para depois do MVP — resumo do documento em foco e, adiante, classificação de todo o acervo para viabilizar busca por contexto — dependem de um modelo de linguagem processar o texto. Nenhum desses recursos pode ser construído localmente: não há, na aplicação, um modelo capaz de ler um documento e produzir um resumo em prosa fiel a ele. Produzi-los exige mandar o texto para fora, a um serviço de IA.

A equipe escolheu a API do Google Gemini, no plano gratuito. Esse plano trata o conteúdo submetido de forma distinta do plano pago: o texto enviado pode ser usado pelo Google para melhorar seus produtos e pode passar por revisão humana. É essa condição, mais do que o simples fato de "sair da máquina", que torna a decisão grave e exige registro explícito.

## Decisão Tomada

O sistema **passa a enviar o texto do documento em foco a um serviço externo de modelo de linguagem** — a API do Google Gemini, no plano gratuito — para produzir resumo, tipo, assuntos e destaques.

A decisão tem os limites abaixo, que são parte dela:

1. **Só o texto do documento a ser resumido viaja.** Nenhuma credencial, caminho local ou dado de outro documento acompanha a submissão.
2. **O envio exige consentimento prévio do usuário**, pedido antes do primeiro envio e nunca disparado pelo primeiro carregamento automático sem confirmação. Recusar mantém o restante do sistema funcionando.
3. **O plano gratuito é aceito conscientemente.** A equipe sabe que o conteúdo submetido pode ser usado para melhorar os produtos do Google e passar por revisão humana, e decidiu prosseguir assim por se tratar de documentos do próprio projeto acadêmico — não de dados de terceiros ou de clientes.
4. **A chave da API recebe o mesmo tratamento das demais credenciais** (ADR-0003): gravada pelo `safeStorage`, nunca devolvida à interface, usada apenas pelo processo principal.
5. **As submissões ocorrem uma de cada vez.** Não há envio em lote nem paralelo — disciplina que também protege a cota do plano gratuito.

Esta decisão **é distinta da autorizada pela ADR-0005, e não decorre automaticamente dela**: guardar o texto na máquina e enviá-lo para fora dela são decisões diferentes. A ADR-0005 autorizou o texto a **repousar** na máquina de quem já tinha acesso a ele pela credencial do GitHub; esta autoriza o texto a **sair** para um terceiro que não tinha esse acesso. Tomá-las juntas esconderia que a segunda é mais grave que a primeira — por isso cada fronteira tem sua própria ADR.

## Justificativa

* **Não há alternativa local.** Resumo e classificação por assunto exigem compreensão de linguagem natural que a aplicação não tem embutida. Adiar indefinidamente esses recursos, previstos desde o levantamento de requisitos, não é uma alternativa técnica — é apenas não os construir.
* **O plano gratuito é suficiente para o volume do projeto.** O acervo é o do próprio projeto acadêmico, gerido pela equipe; o plano pago existiria para eliminar o uso do conteúdo por terceiros, mas representa custo que a equipe decidiu não assumir nesta etapa.
* **O consentimento transforma risco aceito em risco escolhido.** Avisar antes do primeiro envio e aguardar confirmação impede que o usuário descubra depois do fato que o conteúdo já saiu da máquina.
* **A submissão é sempre deliberada e mínima.** Só o texto do documento em foco viaja, nunca o acervo inteiro de uma vez, e nenhum outro dado — credencial, caminho, nome de outro documento — acompanha a chamada.

## Alternativas Consideradas

* **Plano pago da API do Gemini:** descartada por custo, para um sistema de uso interno da equipe sobre documentos do próprio projeto. Fica como evolução possível se o volume ou a sensibilidade dos documentos crescerem.
* **Modelo de linguagem local, rodando na máquina do usuário:** descartada pelo custo de distribuição e execução — modelos capazes de resumir com qualidade aceitável exigem recursos de hardware que a aplicação não pode presumir disponíveis, e acrescentariam gigabytes ao instalador.
* **Adiar resumo e classificação indefinidamente:** descartada por deixar de entregar recursos previstos desde o levantamento de requisitos, sem de fato resolver a questão — apenas empurrando a mesma decisão para depois.
* **Enviar o documento inteiro, incluindo metadados e caminho:** descartada. Apenas o texto é necessário para resumo e classificação; enviar caminho ou identificadores internos ampliaria o que sai da máquina sem ganho para o recurso.

## Consequências

* **Positivas:** viabiliza resumo e, adiante, a classificação que sustenta busca por contexto; mantém o consumo de cota proporcional ao que o usuário efetivamente pede, pelo reuso do resumo gravado; a chave e o cliente HTTP seguem a mesma disciplina já validada para as demais credenciais e chamadas de rede.
* **Negativas:** o texto de documentos do projeto passa a trafegar para um serviço de terceiro; no plano gratuito, esse texto pode ser usado pelo Google para melhorar seus produtos e passar por revisão humana; a aplicação ganha uma dependência de rede a mais no processo que já guarda as credenciais.
* **Riscos:**
  * **Uso do conteúdo pelo provedor.** No plano gratuito, o texto submetido pode ser revisado por humanos e usado para treinar ou melhorar produtos do Google. Mitigação: consentimento explícito antes do primeiro envio, aviso permanente na tela de configurações, e a ciência da equipe de que se trata de documentos do próprio projeto acadêmico, não de terceiros. Não há mitigação técnica que elimine esse risco enquanto o plano gratuito for usado — apenas a escolha informada de aceitá-lo.
  * **Cota gratuita esgotada.** O plano gratuito tem limite de requisições por minuto e por dia. Mitigação: submissões em série, reuso do resumo gravado, e mensagens que distinguem cota excedida de outras falhas.
  * **Resumo que soa correto e não é.** Um modelo de linguagem erra com a mesma fluência com que acerta. Mitigação: o resultado é sempre identificado como gerado por IA, a ação de abrir o documento original permanece ao alcance, e o arquivo de instrução manda o modelo se ater ao texto recebido — mitigação de produto, não de confiabilidade técnica do modelo.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* ADR-0005 — Armazenamento local do conteúdo dos documentos (autoriza guardar; esta autoriza enviar — decisões distintas)
* ADR-0003 — Gerenciamento das credenciais de API pela interface (disciplina de proteção, estendida à chave do Gemini)
* `openspec/changes/painel-de-resumo-por-ia/` — proposta, design e especificações desta mudança
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md` — requisitos de resumo e busca por contexto
