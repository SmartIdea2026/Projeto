# Design — Índice local e classificação por IA

## Context

O banco local hoje tem duas coleções: `documentos_acessados`, que registra apenas o que o usuário **já abriu**, e `cache_fontes`, que guarda respostas de API por `ETag`. **Não existe índice de documentos.** É por isso que a instrução "procurar os links no banco e, se não achar, buscar na API" não funciona como está escrita: o banco só conhece o que já foi clicado, então quase toda busca cairia no caminho da API. Esta mudança cria o índice que falta.

Esta mudança nasceu junto com o resumo por IA do documento em foco, mas as duas foram recortadas em mudanças separadas por `painel-de-resumo-por-ia`, que entrega o resumo de forma independente e mais rápida. Quando esta mudança começa, `painel-de-resumo-por-ia` já está implementada: o módulo de LLM no processo principal (cliente do Gemini, fila de submissões com concorrência um), a chave configurável e o consentimento do usuário para envio de conteúdo já existem. Esta mudança **reaproveita** essa integração para a classificação, em vez de reconstruí-la.

A postura de dados também já mudou duas vezes antes desta mudança começar: `ingerir-conteudo-dos-documentos` (ADR-0005) autorizou guardar o texto localmente, e `painel-de-resumo-por-ia` (ADR-0006) autorizou enviá-lo a um serviço externo de LLM. A classificação em massa desta mudança opera sob a mesma autorização da ADR-0006 — mesmo serviço, mesmo plano gratuito, mesmo consentimento já obtido — e não abre fronteira nova.

## Goals / Non-Goals

**Goals:**

- Índice local com metadados e classificação por IA, atualizado em segundo plano
- Classificação de todo o acervo por IA, reaproveitando a integração com a LLM já construída
- Consumo da cota gratuita previsível e interrompível, compartilhado com o resumo interativo sem prejudicá-lo
- Busca inalterada e nunca bloqueada pela indexação, apenas informada de que ela está em andamento

**Non-Goals:**

- Busca que consulta o índice ou casa termo com assunto, tipo e etiquetas — recortado para uma mudança futura (ver proposal.md, "Recorte de escopo")
- Busca vetorial ou por similaridade semântica — fora de escopo mesmo na mudança futura; a classificação por etiquetas atende ao caso de uso com custo muito menor
- Percorrer o conteúdo integral a cada busca
- Obter o conteúdo das fontes e armazená-lo — isso é a mudança `ingerir-conteudo-dos-documentos`, pré-requisito desta
- Resumo do documento em foco, o cliente do Gemini, a chave da LLM e o consentimento de envio — entregues por `painel-de-resumo-por-ia`, aqui apenas reaproveitados
- Retomada do Google Drive, fora do escopo pela ADR-0004

## Decisions

### 1. Uma coleção nova, sem duplicar texto nem resumo

O índice é uma coleção de documentos com metadados e classificação (assunto, tipo, etiquetas). Ele **não** guarda resumo: o resumo do documento em foco vive em `conteudo_documentos`, junto do texto que o originou — decisão já tomada por `painel-de-resumo-por-ia`, que não é revisitada aqui. O texto submetido à LLM para classificação vem da mesma coleção, mantida por `ingerir-conteudo-dos-documentos`, e é referenciado pelo identificador do documento — o índice não guarda uma segunda cópia dele. A submissão à LLM lê o texto já armazenado em vez de baixá-lo de novo, o que é justamente o que torna a classificação de todo o acervo viável dentro da cota.

### 2. Classificação e resumo são operações distintas, com integrações compartilhadas

**Classificação** roda para todos os documentos, uma vez cada, e produz assunto, tipo e etiquetas — base para a busca por contexto de uma mudança futura. **Resumo** roda sob demanda, para o documento em foco, e já está implementado por `painel-de-resumo-por-ia`.

A separação resolve a tensão entre os dois pedidos: classificar todo o acervo exige processamento prévio de todos, enquanto o resumo é do primeiro resultado e dos que o usuário pedir. Fossem a mesma operação, se pagaria resumo completo de todo o acervo à toa. Mas as duas operações **compartilham** a mesma integração com a LLM — cliente HTTP do Gemini, chave, fila de submissões — construída por `painel-de-resumo-por-ia` e estendida aqui para também aceitar pedidos de classificação.

### 3. A classificação entra na fila já existente, sem prioridade sobre o resumo

A fila de submissões com concorrência **um**, criada por `painel-de-resumo-por-ia` para o resumo, passa a atender também à classificação em massa. Não é uma fila nova: é a mesma, com um segundo tipo de trabalho entrando nela.

O resumo pedido pelo usuário — trabalho interativo — tem precedência sobre a classificação de fundo, pelo mesmo mecanismo (`prioridade.ts`) que já dá precedência à busca sobre a ingestão de conteúdo: quem está olhando a tela não deve esperar a fila de indexação drenar.

### 4. Indexação incremental, retomável e não bloqueante

A classificação é trabalho de fundo com estado no banco: cada documento tem ou não classificação vigente. Interromper não perde nada, e retomar processa apenas o que falta.

A busca é inteiramente alheia à indexação: ela não a consulta, não espera por ela e não muda de comportamento por causa dela. A interface apenas informa, sem bloquear nada, que a indexação está em andamento — um acervo grande pode levar tempo para ser classificado por inteiro, dentro da cota gratuita, e é razoável que quem olha a tela saiba disso.

## Risks / Trade-offs

**Confidencialidade.** O envio do conteúdo dos documentos ao Google já foi decidido e registrado pela ADR-0006, na mudança `painel-de-resumo-por-ia` — inclusive o risco do plano gratuito e o consentimento prévio do usuário. A classificação em massa desta mudança opera sob a mesma autorização e não introduz uma fronteira nova, mas amplia o volume: em vez de um documento por vez sob pedido, o acervo inteiro passa pela LLM ao longo da indexação. Mitigação: a mesma fila de concorrência um, a mesma cota e o mesmo consentimento já obtido — nenhum envio adicional além do que a ADR-0006 já autorizou.

**Cota gratuita contra acervo grande.** Uma chamada por documento, uma por vez, contra um limite por minuto, na mesma fila que atende ao resumo interativo. Para o repositório atual é questão de minutos; para um acervo grande, de horas. Daí a indexação ser incremental, retomável e não bloqueante — e daí a suspensão limpa quando a cota estoura.

**Qualidade da classificação determina a qualidade de uma futura busca por contexto.** Se a LLM etiquetar mal, quem consumir essa classificação depois erra sem perceber por quê. Mitigação: por ora a classificação fica apenas gravada no índice, sem afetar nada que o usuário vê — o risco só se materializa quando a busca passar a consultá-la, na mudança futura que fará essa ligação.

**Classificação desatualizada.** Um documento alterado após a classificação carrega etiquetas que já não descrevem seu conteúdo atual. Detectável pela mesma identidade de conteúdo que invalida o texto armazenado (ADR-0005): a classificação anterior é assinalada como desatualizada e reclassificada na próxima passagem da indexação.

**Formatos que a extração não alcança.** PDF, DOCX e XLSX exigem extração de texto antes da submissão. Documentos cujo conteúdo não puder ser extraído ficam sem classificação, e devem continuar encontráveis pelo nome, sem apresentar erro.
