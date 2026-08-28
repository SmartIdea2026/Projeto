# Design — Resumos por IA e índice local

## Context

O banco local hoje tem duas coleções: `documentos_acessados`, que registra apenas o que o usuário **já abriu**, e `cache_fontes`, que guarda respostas de API por `ETag`. **Não existe índice de documentos.** É por isso que a instrução "procurar os links no banco e, se não achar, buscar na API" não funciona como está escrita: o banco só conhece o que já foi clicado, então quase toda busca cairia no caminho da API. Esta mudança cria o índice que falta.

Os campos `resumo` e `resumoEm` já existem reservados no repositório desde a implementação inicial, previstos exatamente para este momento.

A postura vigente de dados é explícita e será invertida: o sistema guarda **apenas o link de redirecionamento, nunca o conteúdo**, e nada do conteúdo deixa a máquina. Passar documentos pela LLM rompe a segunda metade dessa regra.

## Goals / Non-Goals

**Goals:**

- Índice local que responde à busca sem depender das APIs a cada consulta
- Busca que alcança documentos pelo assunto, não só pelo nome
- Resumo por IA reaproveitado, gerado uma vez por documento
- Consumo da cota gratuita previsível e interrompível
- Mudança da postura de confidencialidade registrada e visível ao usuário

**Non-Goals:**

- Busca vetorial ou por similaridade semântica — a classificação por etiquetas atende ao caso de uso com custo muito menor
- Percorrer o conteúdo integral a cada busca
- Resumo de todos os documentos automaticamente — só classificação; resumo é sob demanda
- Retomada do Google Drive, fora do escopo pela ADR-0004

## Decisions

### 1. Duas coleções novas, conteúdo nunca persistido

O índice é uma coleção de documentos com metadados, classificação (assunto, tipo, etiquetas), resumo e datas de geração. O conteúdo baixado para submissão é usado e descartado — nunca gravado. Isso preserva a parte da ADR-0002 que continua válida: o banco não é repositório de conteúdo.

### 2. Classificação e resumo são operações distintas

**Classificação** roda para todos os documentos, uma vez cada, e produz assunto, tipo e etiquetas — é o que a busca por contexto consome. **Resumo** roda sob demanda, para o documento em foco.

A separação resolve a tensão entre os dois pedidos: a busca por contexto exige processamento prévio de todos, enquanto o resumo é do primeiro resultado e dos que o usuário pedir. Fossem a mesma operação, ou se pagaria resumo completo de todo o acervo, ou não haveria busca por contexto.

### 3. Uma submissão por vez, em fila

Todas as chamadas à LLM passam por uma fila com concorrência **um**. Vale para a classificação em massa e para os resumos sob demanda, que compartilham a mesma fila e a mesma cota.

Isso atende à restrição explícita da equipe e ao limite de requisições por minuto da chave gratuita. Um resumo pedido pelo usuário tem precedência sobre a classificação de fundo: quem está olhando a tela não deve esperar a fila de indexação drenar.

### 4. Indexação incremental, retomável e não bloqueante

A classificação é trabalho de fundo com estado no banco: cada documento tem ou não classificação vigente. Interromper não perde nada, e retomar processa apenas o que falta.

A busca funciona durante o processo, com o que já existe — documentos ainda não classificados continuam encontráveis pelo nome. Sem isso, um acervo grande deixaria o sistema inutilizável até a indexação terminar, o que na cota gratuita pode levar muito tempo.

### 5. Instrução de redação em arquivo versionado

O texto que orienta a LLM vive em um arquivo Markdown no repositório, não no código. A qualidade do resumo depende inteiramente dele, e é o tipo de artefato que a equipe vai querer ajustar sem recompilar — e revisar em Pull Request como qualquer outro documento.

### 6. Chave da LLM segue a ADR-0003

Terceira credencial, mesmo tratamento: gravada pelo `safeStorage`, nunca devolvida ao renderer, todas as chamadas partindo do processo principal. A fronteira já testada não abre exceção para a LLM.

### 7. Precedência do índice, com honestidade sobre defasagem

A busca consulta o índice primeiro. Quando responde só pelo índice, o resultado é apresentado com a ressalva de que pode não refletir alterações recentes — reaproveitando o canal de avisos criado para resultados parciais, que existe exatamente para dizer "isto veio, mas com ressalva".

## Risks / Trade-offs

**Confidencialidade — o risco central.** O conteúdo dos documentos passa a ser enviado ao Google. No plano gratuito, conteúdo submetido pode ser usado para melhorar produtos e passar por revisão humana. A equipe decidiu prosseguir ciente disso, por serem documentos do próprio projeto acadêmico. **Exige ADR** que nomeie o risco, registre a decisão e aponte quais afirmações das especificações vigentes deixam de valer. Mitigação parcial: o aviso ao usuário antes do primeiro envio, e o fato de a submissão ser sempre deliberada.

**Cota gratuita contra acervo grande.** Uma chamada por documento, uma por vez, contra um limite por minuto. Para o repositório atual é questão de minutos; para um acervo grande, de horas. Daí a indexação ser incremental, retomável e não bloqueante — e daí a suspensão limpa quando a cota estoura.

**Qualidade da classificação determina a qualidade da busca.** Se a LLM etiquetar mal, a busca por contexto erra, e o usuário não tem como perceber por quê. Mitigação: o arquivo de instrução é versionado e revisável, e a busca por nome continua funcionando como sempre funcionou.

**Resumo desatualizado.** Um documento alterado após a geração tem resumo obsoleto. Detectável pela data e assinalado na interface, com regeração sob demanda — regerar automaticamente gastaria cota sem o usuário pedir.

**Formatos que a extração não alcança.** PDF, DOCX e XLSX exigem extração de texto antes da submissão. Documentos cujo conteúdo não puder ser extraído ficam sem classificação e sem resumo, e devem continuar encontráveis pelo nome, sem apresentar erro.
