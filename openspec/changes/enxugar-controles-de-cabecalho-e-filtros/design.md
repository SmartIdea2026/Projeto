# Design — Enxugar os controles do cabeçalho e da barra de filtros

**Issue:** #92

## Context

Ver `proposal.md` — *Why*. Estado atual relevante:

### Cabeçalho

- `renderer/App.tsx` monta o cabeçalho com `<BotaoSincronizar />` seguido de `<div className="conexoes">`, que mapeia `(['github'] as const)` e, para cada fonte, renderiza um `<button className="conexao">` com um `<span className="conexao__ponto conexao__ponto--{estado}">` e o texto `{NOME_FONTE[fonte]} {ROTULO_ESTADO[estado]}` — "GitHub conectada", "GitHub credencial inválida" etc. O clique faz `setConfigAberta(true)`.
- `ROTULO_ESTADO` é um mapa local usado só nesse ponto. `NOME_FONTE` é usado também nos avisos de falha por fonte (`{NOME_FONTE[falha.fonte]}: …`).
- O estado `status: StatusFonte[]` vem de `window.ancorai` e alimenta, além do cabeçalho: `temCredencial` (tela vazia "Configure o acesso ao GitHub", CB10) e a mensagem "Nenhum documento encontrado". Esses usos não mudam.
- O diálogo `telas/Configuracoes.tsx` já apresenta, por fonte, o estado da verificação (`DESCRICAO_ESTADO`: "Conectada", etc.) e a conta conectada. Não muda.
- `estilos/cabecalho.css` traz `.conexao` (pílula: `border-radius: 999px`, `padding: 7px 14px`, texto 13px) e `.conexao__ponto` + as cinco variantes de cor `.conexao__ponto--*`.
- Glifos no renderer são emoji em `<span aria-hidden="true">`: `⚓` (marca), `🔍` (busca), `⟳` (sincronizar), `✓` / `⚠` / `ⓘ` (avisos). Não há biblioteca de ícones.
- Testes que dependem do controle: `tabulacao.test.tsx` (abre o diálogo por `getByRole('button', { name: /GitHub conectada/i })`; classifica focáveis por `.closest('.conexoes')`; pega o gatilho por `document.querySelector('.conexao')`), `configuracoes-llm.test.tsx` (abre o diálogo pelo mesmo nome acessível). `painel-resumo.test.tsx` e a tela vazia usam um botão de nome `"Abrir configurações"` — controle diferente, não deve colidir.

### Barra de filtros

- `renderer/componentes/Filtros.tsx` renderiza "Buscar no conteúdo" como `<label className={`filtro filtro--check ${filtros.buscarConteudo ? 'filtro--ativo' : ''}`}>` com um `<input type="checkbox" checked={...} onChange={...}>` e um `<span>Buscar no conteúdo</span>`. Ao lado, "Extensão" é um `<label>` com `<select>`, e "Período" é um `<button type="button" className="filtro filtro--botao ...">` com `aria-expanded`, glifo `⇅` em `<span aria-hidden="true">` e o marcador `filtro--ativo`.
- `estilos/busca.css` traz `.filtro` (pílula), `.filtro--ativo` (borda + fundo + `font-weight: 600`), `.filtro--botao`, e `.filtro--check` + `.filtro--check input[type='checkbox']` / `:focus-visible` — só usadas por este controle.
- `filtros.buscarConteudo` é um booleano em `Filtros` (`compartilhado/tipos.ts`); a spec `busca-documentos` exige apenas "um controle na interface", "desligado por padrão", que "não seja um seletor de campo".
- Testes: `busca-conteudo.test.tsx` acha o controle por `getByRole('checkbox', { name: /buscar no conteúdo/i })` e afere `toBeChecked()` / `not.toBeChecked()`; `tabulacao.test.tsx` conta três focáveis nos filtros (o controle, o `select` de extensão, o botão de período).

## Goals / Non-Goals

**Goals:**

- O controle do cabeçalho fica com um único glifo de engrenagem e nome acessível próprio, mantendo exatamente a ação atual (abrir o diálogo).
- O estado de conexão deixa de ser replicado no cabeçalho; continua acessível no diálogo de configurações, na tela vazia de credenciais e nos avisos de falha.
- "Buscar no conteúdo" passa a ter a mesma aparência de controle que os vizinhos da barra (botão de alternância como "Período"), mantendo o comportamento opt-in e a alternância do mesmo booleano.
- Nenhuma regressão de acessibilidade: os dois controles continuam alcançáveis por teclado, com foco visível, rótulo, e estado não comunicado só por cor.

**Non-Goals:**

- Mexer no diálogo de configurações, na tela vazia, nos avisos de falha por fonte ou na verificação de credenciais.
- Introduzir biblioteca de ícones ou SVG.
- Suportar múltiplas fontes no cabeçalho — a fonte segue única (ADR-0004); o laço `['github']` deixa de existir aqui de qualquer modo.
- Mudar o botão Sincronizar, o `select` de extensão ou o painel de período.
- Alterar a lógica de busca no conteúdo (aditiva, palavra inteira, aviso de cobertura parcial) ou o campo `filtros.buscarConteudo`.

## Decisions

### 1. Emoji de engrenagem em `<span aria-hidden="true">`, no padrão do renderer

O glifo é `⚙` num `<span aria-hidden="true">`, exatamente como `⟳` no botão Sincronizar. Sem SVG, sem lib. O `<button>` recebe `aria-label` — o nome acessível não vem mais de texto filho.

**Descartado: SVG inline.** Nenhum outro ícone do renderer é SVG; introduzir um aqui quebra o padrão e pede decisão de origem/licença do traçado sem ganho.

### 2. Nome acessível: `"Configurações"`

O `aria-label` do botão é `"Configurações"` — curto e distinto de `"Abrir configurações"`, já usado pela tela vazia de credenciais e pelo painel de resumo. Manter os dois nomes diferentes evita `getByRole('button', { name: … })` ambíguo nos testes e duas entradas idênticas na árvore de acessibilidade quando a tela vazia está presente.

**Descartado: `"Abrir configurações"` também aqui.** Colidiria com os controles existentes; um teste que hoje espera um único botão com esse nome passaria a achar dois.

**Descartado: nome que carrega o estado (ex.: "GitHub conectada — configurações").** Reintroduz no cabeçalho, pelo nome acessível, justamente o que a mudança tira de lá; e faz o nome do controle oscilar a cada verificação.

### 3. `.conexoes` / `.conexao` — classes mantidas, laço removido

O `<div className="conexoes">` deixa de mapear `['github']` e passa a conter um único `<button className="conexao" aria-label="Configurações" onClick={() => setConfigAberta(true)}>` com o `<span aria-hidden="true">⚙</span>`. As classes `conexao` e `conexoes` são mantidas para não espalhar a mudança pelo CSS e pelos testes de tabulação que as usam como âncora; `.conexao` no CSS deixa de ser pílula com texto e vira botão de ícone (quadrado com raio, mesmo alvo de toque). As regras `.conexao__ponto` e `.conexao__ponto--*` são removidas — sem uso após a mudança.

**Descartado: renomear para `.configuracoes`.** Mais honesto, mas obriga a tocar CSS e três pontos de teste sem ganho funcional; fica como limpeza futura se o cabeçalho ganhar mais controles.

### 4. `ROTULO_ESTADO` removido; `status`, `NOME_FONTE`, `temCredencial` mantidos

`ROTULO_ESTADO` só servia à pílula — sai. `NOME_FONTE` continua (avisos de falha). O estado `status` e o derivado `temCredencial` continuam alimentando a tela vazia e a mensagem de "nenhum documento"; nada a fazer neles.

### 5. Cenário "Credencial ausente" continua coberto pela tela vazia

A spec pede que, aberto o sistema sem credencial, ele indique que a fonte não está configurada. Sem a pílula, quem cobre isso na tela principal é a tela vazia "Configure o acesso ao GitHub" (CB10), que já existe e não muda. O diálogo de configurações cobre o caso com o diálogo aberto.

### 6. "Buscar no conteúdo" vira botão de alternância no molde do "Período"

O `<label>` + `<input type="checkbox">` vira `<button type="button" className={`filtro ${filtros.buscarConteudo ? 'filtro--ativo' : ''}`} aria-pressed={Boolean(filtros.buscarConteudo)} onClick={() => aoAlterar({ ...filtros, buscarConteudo: !filtros.buscarConteudo })}>`. Reaproveita as classes `.filtro` / `.filtro--ativo` já usadas pelo botão de período — uma aparência de controle só na barra. `aria-pressed` é o papel certo para um botão que liga/desliga um estado (diferente do `aria-expanded` do período, que abre um painel).

**Descartado: manter a caixa e só reestilizá-la para parecer botão.** Um `checkbox` estilizado de botão engana a semântica: o leitor de tela anuncia "caixa de seleção" e o usuário de teclado espera Espaço, não Enter. `aria-pressed` num `<button>` é a passagem honesta.

**Descartado: `role="switch"`.** Também seria correto, mas nenhum outro controle do app usa `switch`; `aria-pressed` num botão-pílula é o mais próximo do que já existe (período) e do que o protótipo mostra.

### 7. Estado ligado com marcador além de cor

O botão ativo recebe `filtro--ativo` (borda verde + fundo + `font-weight: 600`) **e** um `<span aria-hidden="true">✓</span>` antes do rótulo. Sem o glifo, "ligado" se distinguiria por peso da fonte e matiz de borda — perto demais de "só por cor". O `✓` só aparece no estado ligado; desligado, o botão é o rótulo puro, como "Período" sem o `⇅`... na verdade "Período" mostra o `⇅` sempre, então aqui a escolha é deliberada: o glifo carrega o estado, não a decoração.

**Descartado: glifo fixo (□/☑) nos dois estados.** Recria visualmente a caixa que estamos tirando. Um marcador que aparece só quando ligado comunica o estado sem trazer de volta a aparência de checkbox.

## Risks / Trade-offs

- **[Estado de erro fica menos visível]** Credencial que expira ou cai a conexão não grita mais no cabeçalho; o usuário percebe ao buscar (aviso de falha por fonte) ou ao abrir as configurações. → Aceitável: com fonte única, uma busca sem resultados por credencial inválida já mostra o aviso de falha, e o caminho de correção (abrir configurações) está a um clique. Se voltar a haver múltiplas fontes, reavaliar um indicador agregado.
- **[Ícone-só é menos óbvio que texto]** Uma engrenagem sem rótulo visível pode não ser lida como "configurações" por todo usuário. → `aria-label` cobre leitores de tela; a engrenagem é convenção amplamente reconhecida; `title` opcional dá dica no hover. O botão Sincronizar ao lado mantém texto, então o cabeçalho não fica só de ícones.
- **[Testes de tabulação acoplados a `.conexao`/`.conexoes`]** Mantivemos as classes justamente para não quebrar esses testes além do nome acessível. → Os ajustes de teste ficam restritos ao seletor por nome (`/GitHub conectada/i` → `/Configurações/`).

- **[`fireEvent.click` num `checkbox` vs `button` nos testes]** `busca-conteudo.test.tsx` clica o controle e afere `toBeChecked()`. Com `<button aria-pressed>`, `toBeChecked` não se aplica. → Trocar por `getByRole('button', { name: /buscar no conteúdo/i })` e aferir `getAttribute('aria-pressed')` / `toHaveAttribute('aria-pressed', 'true')`. O clique continua disparando a nova consulta pelo mesmo `aoAlterar`.

- **[Usuário acostumado à caixa]** Quem já usava o app espera um checkbox. → O rótulo textual e a posição na barra não mudam; a alternância por clique é a mesma. O `✓` no estado ligado deixa claro que é liga/desliga.

## Migration Plan

Mudança de renderer, sem migração de dados nem de canal. Rollback é reverter o commit. A entrega inclui, no mesmo commit de implementação, o ajuste dos testes; e, em commit de documentação separado (padrão de commits do repo), a Especificação, o README e o AGENTS. As duas mudanças (cabeçalho e filtro) são independentes entre si e podem ir no mesmo commit de implementação ou em dois — ambas tocam só o renderer e seu CSS.
