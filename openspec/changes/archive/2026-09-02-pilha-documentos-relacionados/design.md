# Design — Pilha de documentos relacionados

**Issue:** #89

## Context

Ver `proposal.md` — *Why*. O que já existe e sustenta esta mudança:

- O resumo por IA grava, no mesmo registro de `conteudo_documentos`, `tipo: string`, `assuntos: string[]` e `destaques: string[]` por documento (`RegistroConteudo`, `banco/repositorio.ts`). Hoje só o documento aberto no painel é classificado — a classificação de **todo** o acervo é a mudança `resumos-e-indice-por-ia`, em desenvolvimento em branch própria, a ser mesclada antes desta.
- `conteudo_documentos` é coleção NeDB aberta sob demanda e carregada inteira em memória (ADR-0002). O caminho de resumo já a abre (`resumoGravado`, `lerConteudo`).
- O painel (`renderer/componentes/PainelResumo.tsx`, um `<aside>` com `aria-live="polite"`) recebe hoje `resumo`, `tipo`, `assuntos`, `destaques` via `ResumoDocumento`. `App.tsx` mantém o foco do painel fora do estado React (`focoVigente`) e já tem a rotina de troca de foco disparada ao acionar um `Cartao`.
- A busca já emite `avisos` — canal separado de `falhas` — para resultado parcial (árvore truncada, cobertura parcial do conteúdo, autoria pendente no snapshot).
- `test/seguranca/fronteira-conteudo.test.ts` invoca todo canal registrado e falha se algum devolver texto de documento.
- A LLM só é acionada por `llm/gemini.ts`, sempre via a fila serial de concorrência um de `llm/resumos.ts`.

Esta mudança **não** aciona a LLM. Ela lê rótulos já gravados e faz aritmética de conjuntos.

## Goals / Non-Goals

**Goals:**

- Cruzar os `assuntos`/`tipo` já gravados entre documentos e devolver ao painel uma pilha ordenada por proximidade, sem que nada além dos rótulos cruze a fronteira do processo principal.
- Recalcular a pilha a cada troca de foco e a cada regeração do resumo do documento em foco, sem persistir nada.
- Dizer, com honestidade, quando a pilha está incompleta porque o acervo ainda não foi todo classificado.

**Non-Goals:**

- Embeddings, vetores, similaridade de cosseno ou qualquer modelo de similaridade — contornado deliberadamente pela relação por rótulos (ADR-0007).
- A classificação por IA de todo o acervo — é `resumos-e-indice-por-ia`, pré-requisito desta, com proposta e PR próprios.
- Explicação textual da relação gerada por IA (envio de pares de documentos ao Gemini).
- Ancorar a pilha na query de busca, em vez de no documento em foco — evolução futura, reaproveitando o mesmo cálculo.
- Coleção nova, índice invertido ou cache da pilha — quando o custo linear doer, a resposta é o índice de `resumos-e-indice-por-ia`.

## Decisions

### 1. Proximidade por Jaccard sobre `assuntos`, com raridade e bônus de tipo

A proximidade entre o documento em foco `F` e um candidato `C` é:

```
proximidade(F, C) =  Σ  peso(a)   para a em (assuntosF ∩ assuntosC)
                    ───────────────────────────────────────────────
                     Σ peso(a)    para a em (assuntosF ∪ assuntosC)
                  +  BONUS_MESMO_TIPO   se tipoF == tipoC (e ambos não vazios)
```

`peso(a)` é o peso inverso à frequência do assunto no acervo — `log(totalDocumentos / documentosComOAssunto)`, o mesmo IDF de recuperação de informação. Um assunto que aparece em quase todo documento ("assistência estudantil") pesa perto de zero; um que aparece em três pesa alto. Sem isso, documentos que só compartilham o assunto guarda-chuva do acervo se relacionariam com todo mundo.

O numerador é a interseção **ponderada**; o denominador, a união ponderada — Jaccard ponderado, entre 0 e 1. O bônus de tipo é uma constante fixa somada por fora (não normalizada): dois documentos do mesmo tipo — duas atas, dois ADRs — têm afinidade que os assuntos nem sempre capturam.

`destaques` ficam de fora: são frases em prosa, não rótulos comparáveis por igualdade.

**Constantes nomeadas, num único módulo, comentadas com o racional e a faixa esperada:** `BONUS_MESMO_TIPO`, `MIN_ASSUNTOS_EM_COMUM = 2`, `PESO_ASSUNTO_RARO` (o limiar de `peso(a)` acima do qual um único assunto já basta), `TETO_PILHA = 5`. São chutes iniciais; ficam ajustáveis sem tocar na spec (a spec fixa "no máximo 5" e "ao menos dois assuntos, ou um raro" como contrato observável, não os valores de peso).

**Descartado: Jaccard simples, sem IDF.** Mais fácil de explicar, mas no acervo real quase todo documento carrega dois ou três assuntos genéricos em comum — a pilha viraria "todos relacionados com todos". O IDF é barato: uma passada para contar frequência, com a coleção já em memória.

**Descartado: TF-IDF sobre o texto, sem depender dos rótulos.** É meio caminho para busca vetorial, precisa do texto no cálculo (mais peso na fronteira) e é exatamente o que a ADR-0007 mantém fora até decisão própria.

### 2. Cálculo sob demanda no processo principal, sem persistência

Um módulo novo `main/relacoes/` expõe `pilhaDe(documentoId)`. Ele lê de `conteudo_documentos` os `assuntos`/`tipo` de todos os documentos com classificação vigente (reusando `lerConteudo` / uma leitura em lote no `repositorio.ts`), monta a tabela de frequência dos assuntos, calcula a proximidade de cada candidato, aplica o limiar, ordena e corta em `TETO_PILHA`.

Para o acervo atual (~90 documentos, poucos KB de rótulos) isso é sub-milissegundo. A coleção já está inteira em memória — o custo é percorrer um array, não I/O.

**Sem cache, sem coleção nova.** A pilha é função pura de `(assuntos de todos os documentos)`; qualquer coisa que a invalidasse (um resumo regerado, a classificação avançando) exigiria rastrear dependências. Recalcular do zero é mais simples e rápido o bastante. Quando não for — acervo muito maior —, o índice de `resumos-e-indice-por-ia` é o lugar certo para materializar isso, não um cache aqui.

**Descartado: gravar a pilha junto do resumo.** Ficaria obsoleta toda vez que qualquer outro documento fosse classificado, e a lógica de invalidação não se paga para um cálculo tão barato.

### 3. Canal de leitura novo, devolvendo só rótulos

`relacoes:documento` (nome em `compartilhado/canais.ts`, handler em `ipc.ts`, assinatura na ponte em `preload/index.ts`). Entrada: o `Documento` em foco (o handler usa só o `id`). Saída: `{ pilha: ItemRelacionado[], semClassificacao: boolean, aviso?: AvisoFonte }`, onde `ItemRelacionado = { id, nome, fonte, link, score: number }`.

`link` e `fonte` entram para que acionar um item alcance um documento que não está na página de resultados — sem eles, o painel não teria como abri-lo na fonte. São identificação, não conteúdo: a fronteira da ADR-0005 é sobre texto. `score` só serve para ordenar. Os assuntos em comum são calculados para o limiar e a ordenação, mas **não** acompanham o item: a pilha lista só nomes. `semClassificacao` distingue "não há relacionados" de "o documento em foco ainda não tem resumo".

Segue o modelo request/response que o resto do código usa — o renderer pede a pilha quando o foco muda; nada é empurrado.

`assuntos` são termos gerados pela IA, não trechos do documento — a mesma natureza do que `ResumoDocumento.assuntos` já entrega ao painel hoje. Ainda assim, `fronteira-conteudo.test.ts` é estendido para cobrir este canal: ele devolve identificação, nome, rótulos e um número, nunca texto.

**Descartado: reaproveitar `resumo:documento` para também trazer a pilha.** Junta duas responsabilidades com ciclos de vida diferentes — o resumo é caro e cacheado, a pilha é barata e recalculada. Canais separados mantêm cada um simples.

### 4. O renderer pede a pilha na troca de foco e após regerar

`App.tsx` já centraliza a troca de foco do painel. Depois de resolver qual documento está em foco (por busca, por clique num `Cartao`, ou — novo — por clique num item da pilha) e após uma regeração de resumo concluir, ele chama o canal da pilha. O resultado abandonado de um foco trocado não substitui a pilha apresentada — mesma disciplina de `focoVigente` que o resumo já usa.

Clicar num item da pilha entra na **mesma** rotina de troca de foco de clicar num `Cartao`: o painel passa a apresentar aquele documento (resumo + pilha), a lista de resultados não muda. Se o documento do item não está na página de resultados atual, o painel ainda o apresenta — o foco do painel e a lista já são coisas independentes no código.

### 5. Cobertura parcial vira `aviso`, no mesmo canal da busca

`pilhaDe` compara o número de documentos com classificação vigente com o total do inventário (`acervo_documentos`, já disponível). Faltando algum, devolve um `aviso` com a contagem do que ficou fora. O renderer o apresenta pelo mesmo caminho dos demais avisos de resultado parcial.

Enquanto `resumos-e-indice-por-ia` não existe, esse aviso aparece quase sempre — a pilha só enxerga os documentos que o usuário abriu. É honesto: a funcionalidade está degradada até a classificação em massa entrar. Quando ela cobrir o inventário, o aviso some sozinho.

**Documento em foco sem classificação:** não há o que cruzar. O bloco no painel diz que não há pilha enquanto o documento não tiver resumo — o mesmo gatilho que já leva o usuário a gerar o resumo.

### 6. Bloco no painel, abaixo dos destaques, com os seis estados

Novo bloco em `PainelResumo.tsx`, título "Documentos relacionados", depois de resumo/assuntos/destaques. Cada item: o nome do documento, como um botão. Estados obrigatórios (processo de UX, AGENTS §5):

- **default**: a lista de até 5 itens.
- **hover** / **focus**: item destacado, alcançável por teclado na ordem de leitura.
- **loading**: "montando a pilha…", enquanto o canal não respondeu.
- **empty**: "nenhum documento relacionado encontrado" — foco classificado, mas ninguém passou do limiar.
- **error**: a montagem falhou; o bloco diz isso e o resto do painel (resumo, destaques, abrir) segue intacto.

A troca de foco por um item é anunciada por leitores de tela pelo mesmo `aria-live` que já anuncia a troca de conteúdo do painel.

**Descartado: seção recolhível / aba separada.** O painel é a unidade de leitura; a pilha é continuação natural do resumo, não uma tela à parte. Recolher esconde justamente o que a mudança quer expor.

### 7. ADR-0007 registra a fronteira

"Busca vetorial ou por similaridade semântica" é non-goal em `resumos-e-indice-por-ia/design.md:22`, no design arquivado de `sincronizar-acervo-e-buscar-por-conteudo` (`design.md:28`) e no `GlossarioTecnico.md:69`. Relacionar documentos por rótulos não é a mesma coisa — mas está perto o suficiente para merecer registro explícito, senão vira contradição silenciosa (AGENTS §4, regra 5).

`ADR-0007-relacoes-entre-documentos-por-rotulos.md`, curta: **decisão** — permitir relacionar documentos pela sobreposição dos rótulos de classificação (assuntos, tipo), com cálculo local, sem envio a serviço externo; **manter fora** similaridade vetorial/embeddings até ADR própria; **justificativa** — entrega a navegação por tema com custo baixo e sem ampliar a fronteira de dados (ADR-0005/0006); **supera** a cláusula de non-goal nos três documentos citados, nominalmente.

## Risks / Trade-offs

**A pilha é rasa até a classificação em massa existir.** Sem `resumos-e-indice-por-ia`, só documentos abertos manualmente entram no cálculo. → Mitigação: o aviso de cobertura parcial diz exatamente isso, com a contagem; e as duas mudanças são sequenciadas, esta depois daquela para valer a pena de fato.

**Qualidade dos `assuntos` manda na qualidade da pilha.** Se a instrução da LLM produz assuntos inconsistentes entre documentos ("licitação" num, "processo licitatório" noutro), a interseção não casa. → Mitigação: fora do escopo desta mudança; é ajuste em `instrucoes/resumo.md`, revisável em PR. A relação por rótulos expõe esse problema, não o cria.

**IDF sobre acervo pequeno é instável.** Com 90 documentos, um assunto em 2 vs. em 3 muda bastante o peso. → Mitigação: os valores são constantes ajustáveis; o limiar de "2 assuntos em comum OU 1 raro" dá uma rede de segurança que não depende só do peso contínuo.

**Custo linear a cada troca de foco.** Percorrer o acervo inteiro toda vez que o painel muda. → Mitigação: para o acervo atual é sub-milissegundo com tudo em memória; o teto de `LIMITE_CARACTERES_TOTAL` limita o crescimento; a solução estrutural (índice) já está proposta e datada nas ADR-0002/0005.

**Navegação encadeada pela pilha pode "perder" o usuário.** Clicar de documento em documento afasta da lista de resultados original. → Mitigação: a lista de resultados nunca muda — está sempre lá para voltar; é o mesmo modelo do clique num `Cartao`, que o usuário já conhece.

## Migration Plan

Aditiva. Nenhuma coleção muda de forma, nenhuma nasce. Nenhum dado a converter. O canal novo é de leitura; enquanto o renderer não o chama, nada acontece. Reverter é retirar o bloco do painel, não registrar o canal e apagar `main/relacoes/` — os `assuntos`/`tipo` já gravados continuam servindo ao resumo.

Sem ampliação da ADR-0006: nenhuma submissão nova a serviço externo. A ADR-0007 nova acompanha a entrega e registra a fronteira.

Documentação na mesma entrega: `ADR-0007` (novo), `AncorAI/README.md` (o painel apresenta documentos relacionados), `AGENTS.md` (seções 6 e 9), `Docs/Requisitos/GlossarioTecnico.md` (entrada "documentos relacionados"; ressalva na nota "sem busca por similaridade").

## Open Questions

- **Valores iniciais de `BONUS_MESMO_TIPO` e `PESO_ASSUNTO_RARO`.** Detalhe de calibração; não muda a spec nem a quebra de tarefas. Serão ajustados olhando a pilha real de alguns documentos durante a implementação.
- **Ordenar a pilha por `score` bruto ou agrupar por faixa (muito próximo / relacionado).** Cosmético; a spec só exige "proximidade decrescente". Decidível na implementação da UI.
