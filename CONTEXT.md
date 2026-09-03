# Âncora / AncorAI

Aplicação desktop de busca interna sobre os documentos do workspace (GitHub, com resumo e classificação por IA).

## Language

**Categoria**:
Classificação de um documento, escolhida pela IA a partir de uma lista fechada (não texto livre), usada para filtrar a busca por gênero de documento (ex.: Ata, ADR, Especificação). Nasce junto do resumo — mesma submissão à LLM, mesmo consentimento, mesma versão de conteúdo — e não de uma varredura em massa do acervo.
_Avoid_: Tipo (ambíguo — ver abaixo), Tipos (plural; a categoria é sempre um valor só).

**Extensão**:
O formato do arquivo (`.md`, `.pdf`, `.docx` etc.), determinado mecanicamente pelo nome do arquivo — nunca pela IA. É o requisito histórico "tipo de documento" (RF04/RN07), renomeado na interface para não colidir com Categoria.
_Avoid_: Tipo de documento (nome do requisito original, mas colide com Categoria).

**Resumo**:
Prosa de três a seis frases sobre um documento, gerada pela IA sob demanda — automaticamente para o primeiro resultado de uma busca, ou por pedido explícito para qualquer outro. Categoria e Assuntos são produzidos na mesma submissão que produz o Resumo, mas são conceitos distintos dele.

**Assuntos**:
Palavras-chave de vocabulário livre sobre do que um documento trata, geradas junto do Resumo. Ao contrário da Categoria, não têm lista fechada e não alimentam filtro algum — descrevem o conteúdo, não classificam o documento.

**Tipo** (termo evitado):
Nome antigo do campo que hoje é Categoria, quando ainda era texto livre e só existia dentro do painel de resumo (nunca persistido para filtro). Se aparecer em código ou documento antigo, leia como Categoria em transição — o valor que ele carregava não é confiável (vocabulário aberto) e é descartado, não migrado, quando a Categoria é introduzida.
