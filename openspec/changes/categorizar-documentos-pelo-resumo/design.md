## Context

O resumo por IA (`resumos-por-ia`) já existe e funciona: uma submissão à LLM, por documento, produz `resumo`, `tipo`, `assuntos` e `destaques` (`AncorAI/src/main/llm/gemini.ts`, função `resumir()`), gravados em `RegistroConteudo` (`AncorAI/src/main/banco/repositorio.ts`), a mesma coleção que guarda o texto extraído — versionados juntos por `versaoConteudo`. É gerado automaticamente para o primeiro resultado de qualquer busca, e sob demanda para qualquer outro documento (botão "Gerar resumo").

`RegistroConteudo` não é a coleção que a busca/listagem consulta — é `RegistroAcervo`. Por isso `tipo` nunca pôde alimentar um filtro: existe, mas está no lugar errado para isso.

Uma tentativa anterior de resolver a mesma necessidade (`classificar-documentos-por-tipo`, issue #94) construiu um processo de classificação em massa, separado do resumo, com vocabulário aberto. Foi implementada e depois totalmente revertida nesta mesma sessão — vocabulário aberto fez o mesmo gênero de documento (ex.: ADRs) receber rótulos diferentes entre si, o que o próprio design daquela mudança já sinalizava como risco aceito conscientemente. O mecanismo de vocabulário fechado que ela chegou a validar (enum no `responseSchema` do Gemini, filtro defensivo na interpretação da resposta) continua correto e é reaproveitado aqui — está preservado em `git stash@{0}` ("classificar-documentos-por-tipo revertido a pedido do usuario") como referência.

Ver `proposal.md` para a motivação e o recorte em relação àquela tentativa.

## Goals / Non-Goals

**Goals:**

- Fechar o vocabulário do campo `tipo` do resumo, tornando-o confiável como categoria
- Refletir a categoria em `RegistroAcervo`, onde a busca consulta, para alimentar um filtro
- Reaproveitar a submissão, a fila e o consentimento que o resumo já tem — nenhum mecanismo novo
- Apresentar a categoria como selo no cartão, no lugar de onde aparecia no painel de resumo

**Non-Goals:**

- Classificação em massa ou de fundo — a categoria só nasce quando um resumo é gerado, documento a documento, como já acontece hoje
- `assuntos` como filtro — permanece vocabulário livre, fora de escopo
- Migração incremental dos resumos já gravados — são apagados por inteiro (ver Migration Plan), não corrigidos campo a campo

## Decisions

### 1. Categoria nasce da mesma submissão do resumo, não de um processo novo

`resumir()` continua produzindo os quatro elementos numa única chamada. Não há fila, consentimento ou disparo próprios para a categoria — ela é só mais um campo dessa mesma resposta, agora com `enum` no lugar de `type: 'string'` livre no `responseSchema`.

**Alternativa considerada:** repetir o desenho de `classificar-documentos-por-tipo` (processo de classificação separado, disparado pela sincronização). Descartada porque duplicaria a submissão à LLM para o mesmo documento (uma para o resumo, outra para a categoria) sem necessidade, dobrando o consumo da cota gratuita, e porque foi exatamente esse desenho que a sessão acabou de reverter.

### 2. Um valor só, não até dois

O campo permanece uma string (como `tipo` já era), não uma lista. Simplifica a interpretação da resposta e o filtro (igualdade direta, não "contém qualquer um dos até dois") em troca de não conseguir expressar um documento que seja duas coisas ao mesmo tempo — julgado aceitável: nenhum documento do acervo hoje exige isso.

### 3. Lista fechada de 14 rótulos, levantada dos gêneros reais do acervo

`Ata, ADR, Especificação, Levantamento, Pesquisa, Processo, Padrão, Manual, Relatório, Contrato, Edital, Formulário, Glossário, Template` — a mesma lista já levantada e testada para `classificar-documentos-por-tipo`, a partir dos gêneros de documento presentes em `Docs/`. Fica em `instrucoes/resumo.md`, revisável por Pull Request como o resto da instrução; o `enum` do `responseSchema` em `gemini.ts` precisa ser mantido igual a ela manualmente — mesma tensão documentada naquela tentativa.

Sem confiança em nenhum item, a categoria fica ausente — nunca um rótulo genérico (troca o `"Documento"` que `resumo.md` usa hoje como fallback).

### 4. Persistência espelhada em `RegistroAcervo`, versionada por conteúdo

`gravarResumo()` passa a também escrever `categoria` e `categoriaVersaoConteudo` no registro do acervo correspondente, sempre que grava um resumo. `RegistroConteudo` continua sendo a fonte da verdade (onde a categoria nasce, junto do resumo); `RegistroAcervo` guarda uma cópia para a busca consultar sem precisar juntar as duas coleções a cada consulta.

**Alternativa considerada:** a busca juntar `RegistroAcervo` e `RegistroConteudo` em tempo de consulta, sem espelhar nada. Descartada por custo — a listagem correria uma junção adicional a cada busca, para um dado que muda raramente (só quando um resumo é gerado).

### 5. Categoria some do painel, vira selo no cartão

`PainelResumo.tsx` para de exibir "Tipo identificado". `Cartao.tsx` ganha um selo com a categoria, reaproveitando a classe `etiqueta--categoria` que existia antes do revert. Um documento sem categoria simplesmente não tem selo — mesmo padrão que a extensão e a fonte já seguem.

### 6. Filtro por categoria: dropdown de seleção única

`Filtros.tsx` ganha um dropdown "Categoria", populado consultando os valores distintos de `categoria` já gravados em `RegistroAcervo` — mesma mecânica que `classificar-documentos-por-tipo` já validou para o dropdown de extensão, adaptada para igualdade simples (a categoria é um valor só).

## Migration Plan

Resumos já gravados (`RegistroConteudo` com `resumo` preenchido) são apagados nesta mudança — não migrados. O código já tem o mecanismo certo para isso: `gravarConteudo()` já limpa `resumo`, `tipo`, `assuntos`, `destaques` e `resumoEm` via `$unset` sempre que `versaoConteudo` muda (repositorio.ts:198-211), porque um resumo é specific à versão de conteúdo que o originou. A migração desta mudança é um `$unset` desses mesmos campos, uma vez, em todo registro de `RegistroConteudo` que tiver `resumo` preenchido — independente de `versaoConteudo` ter mudado.

Depois da migração, todo documento volta ao estado "ainda não resumido nesta versão". O próximo resumo de cada um — automático, ao voltar a ser o primeiro resultado de uma busca, ou sob pedido — já sai sob a regra nova (vocabulário fechado) e popula `categoria` em `RegistroAcervo`. Não há passo manual nem varredura: a mesma engrenagem que já gera resumos sob demanda faz a repopulação, espalhada no tempo, conforme o uso normal da busca.

**Rollback:** reverter o código (schema, instrução, persistência) sem reverter a migração deixa o sistema no estado anterior a esta mudança, só que sem os resumos já gerados até então — o mesmo custo de regerá-los que a migração para frente já paga. Não há como recuperar os resumos apagados; a migração não faz backup deles, porque prosa desatualizada não tem valor de recuperação.

## Risks / Trade-offs

**Custo de cota da migração.** Apagar todos os resumos existentes significa que cada documento antes resumido volta a custar uma submissão à LLM na próxima vez que aparecer como resultado. Mitigação: é o mesmo custo que documentos nunca resumidos já têm; não há pico — o custo se distribui conforme buscas acontecem, não de uma vez.

**Enum duplicado entre instrução e código.** A lista de 14 rótulos precisa ser mantida igual em `instrucoes/resumo.md` (prosa) e no `enum` de `gemini.ts` (código) — risco já aceito e documentado na tentativa anterior, sem mitigação automática nesta entrega.

**Categoria pode ficar desatualizada indefinidamente.** Sem reclassificação de fundo, a categoria de um documento cujo conteúdo mudou permanece a antiga até alguém pedir "Gerar novamente" — mesma limitação que o resumo em prosa já tem hoje (painel já avisa e oferece o botão). Aceito conscientemente, mesmo padrão do restante do painel.

**Documento de gênero fora da lista fica sem categoria para sempre, a menos que a lista mude.** Mitigação: mesmo tratamento de baixa confiança (zero categoria, buscável pelo nome); revisar a lista por Pull Request se um gênero recorrente ficar de fora na prática.
