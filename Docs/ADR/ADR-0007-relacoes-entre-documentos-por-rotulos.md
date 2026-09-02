# ADR 0007: Relações entre documentos por sobreposição de rótulos

**Status:** Proposto
**Data:** 02/09/2026

## Contexto/Problema

O painel de resumo apresenta, para o documento em foco, o `tipo`, os `assuntos` e os `destaques` que a classificação por IA extraiu. Esses rótulos ficam presos ao documento: não há nada que os cruze entre documentos para dizer "estes dois tratam do mesmo assunto". Quem abre uma ata sobre um tema não descobre, sem re-buscar termo a termo, que há ADRs e um documento de requisitos sobre o mesmo ponto.

A funcionalidade pedida — uma "pilha" de documentos relacionados ao que está em foco — é uma forma de análise de proximidade entre documentos. E "busca vetorial ou por similaridade semântica" está registrada como **não-objetivo** em três lugares:

* `openspec/changes/resumos-e-indice-por-ia/design.md`, seção *Non-Goals*: *"Busca vetorial ou por similaridade semântica — a classificação por etiquetas atende ao caso de uso com custo muito menor"*.
* `openspec/changes/archive/2026-09-01-sincronizar-acervo-e-buscar-por-conteudo/design.md`, seção *Non-Goals*: *"Busca vetorial ou por similaridade — a correspondência é literal, como já é por nome"*.
* `Docs/Requisitos/GlossarioTecnico.md`, entrada de busca por conteúdo: *"busca literal, sem acento nem caixa, sem busca por similaridade"*.

Relacionar documentos por sobreposição dos rótulos que a IA já produziu não é busca vetorial — mas está perto o suficiente do que aqueles documentos afastaram para exigir registro explícito. Sem uma ADR, a funcionalidade contradiz decisões vigentes em silêncio.

## Decisão Tomada

O sistema **passa a relacionar documentos entre si pela sobreposição dos rótulos de classificação** — os `assuntos` e o `tipo` já gravados pela classificação por IA —, apresentando, a partir do documento em foco, uma pilha dos documentos mais próximos.

A decisão tem os limites abaixo, que são parte dela:

1. **O cálculo é local.** A proximidade sai de aritmética de conjuntos sobre rótulos já armazenados — similaridade de Jaccard ponderada pela raridade de cada assunto no acervo, com acréscimo fixo para documentos do mesmo tipo. Nenhuma submissão a serviço externo é introduzida; a ADR-0006 não é ampliada.
2. **Nada de embeddings, vetores ou similaridade calculada por modelo.** Essa continua fora do escopo, e uma decisão de adotá-la exigirá ADR própria — que terá de tratar de persistência de vetores (a ADR-0002 manda reavaliar o armazenamento quando os dados crescerem) e, provavelmente, de envio do acervo a uma API de embeddings.
3. **A pilha não carrega conteúdo.** O canal que a devolve ao renderer leva identificação, nome e link de cada item — nunca o texto de onde os rótulos saíram (ADR-0005). O teste de fronteira cobre o canal novo.
4. **A pilha não é persistida.** É recalculada sob demanda; não há coleção nova no banco.

Esta decisão **supera nominalmente** a cláusula de não-objetivo nos três documentos citados, no que diz respeito a relacionar documentos por rótulos. A vedação a busca **vetorial** permanece vigente.

## Justificativa

* **A matéria-prima já existe.** `assuntos` e `tipo` são gravados por documento desde o painel de resumo. Cruzá-los é o passo seguinte natural, e o de menor custo.
* **Sem ampliar a fronteira de dados.** O cálculo é local e não envia nada — não toca a ADR-0006, e o resultado respeita a ADR-0005 (rótulos, não texto).
* **Custo proporcional e conhecido.** Aritmética de conjuntos sobre uma coleção que já está em memória. Quando o acervo crescer a ponto de isso doer, a resposta é o índice invertido já previsto em `resumos-e-indice-por-ia`, não um remendo.
* **A honestidade do registro.** O não-objetivo de similaridade foi escrito para afastar a complexidade e o custo de busca vetorial. Relacionar por rótulos não reintroduz nem uma nem outro — mas o leitor daqueles documentos precisa saber que a fronteira foi revista, e em que termos.

## Alternativas Consideradas

* **Embeddings / similaridade de cosseno sobre o texto:** descartada para esta etapa. Captaria relações que os rótulos não pegam, mas exigiria ADR de tecnologia, ADR de persistência (vetores por documento), desfazer o filtro que exclui modelos de embedding do catálogo, e provável envio do acervo a uma API de embeddings. Fica como evolução, com ADR própria, se a relação por rótulos se mostrar insuficiente.
* **Não fazer nada / manter os rótulos presos ao documento:** descartada. A navegação por tema é o valor que a classificação por IA prometia e ainda não entregou.
* **Explicação textual da relação gerada por IA** (enviar pares de documentos ao Gemini para descrever a conexão): descartada. Ampliaria a ADR-0006 (dois documentos por submissão, não um) sem ganho proporcional na v1.
* **Ancorar a pilha na query de busca**, e não no documento em foco: adiada. O mesmo cálculo serve; é uma evolução da interface, não uma decisão de arquitetura.

## Consequências

* **Positivas:** entrega a navegação por tema reaproveitando dados já gravados; não amplia a fronteira de envio (ADR-0006 intocada); respeita a fronteira de conteúdo (ADR-0005); nenhuma dependência nova.
* **Negativas:** a qualidade da pilha fica atada à consistência dos `assuntos` que a LLM produz — "licitação" num documento e "processo licitatório" noutro não casam; o cálculo linear percorre o acervo a cada troca de foco do painel.
* **Riscos:**
  * **Cobertura parcial até a classificação em massa existir.** Enquanto `resumos-e-indice-por-ia` não roda sobre todo o acervo, a pilha só enxerga documentos abertos manualmente. Mitigação: um aviso informa quantos documentos ficaram fora da análise, pelo mesmo canal dos avisos de resultado parcial da busca.
  * **IDF instável em acervo pequeno.** Com poucas dezenas de documentos, o peso de um assunto oscila muito entre aparecer em dois ou em três. Mitigação: os pesos e limiares são constantes nomeadas e ajustáveis; o limiar de "dois assuntos em comum, ou um raro" é uma rede que não depende só do peso contínuo.
  * **Reintrodução disfarçada de busca vetorial.** Um passo seguinte poderia ir ligando "peso de assunto" a "vetor de documento" sem ADR. Mitigação: o limite 2 desta decisão é explícito, e o teste e o design fixam o método como aritmética de conjuntos.

## Referências

* Issue #89 — Pilha de documentos relacionados
* ADR-0002 — Persistência NoSQL local (reavaliar o armazenamento quando os dados crescerem; um índice vetorial seria esse caso)
* ADR-0005 — Armazenamento local do conteúdo dos documentos (a pilha devolve rótulos, nunca texto)
* ADR-0006 — Envio do texto a serviço externo de IA (não ampliada: o cálculo da pilha é local)
* `openspec/changes/pilha-documentos-relacionados/` — proposta, design e especificações desta mudança
* `openspec/changes/resumos-e-indice-por-ia/` — classificação por IA de todo o acervo, pré-requisito da cobertura plena
