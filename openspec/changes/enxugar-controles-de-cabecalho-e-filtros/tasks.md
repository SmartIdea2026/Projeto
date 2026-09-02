## 1. Cabeçalho: botão de ícone

- [x] 1.1 Em `src/renderer/App.tsx`, substituir o laço `(['github'] as const).map(...)` dentro de `<div className="conexoes">` por um único `<button className="conexao" aria-label="Configurações" onClick={() => setConfigAberta(true)}>` com `<span aria-hidden="true">⚙</span>` e nenhum texto visível. Verificar: a tela principal renderiza um único botão no `.conexoes`, sem texto, e clicá-lo abre o diálogo.
- [x] 1.2 Remover o mapa `ROTULO_ESTADO` de `src/renderer/App.tsx` (sem mais uso). Manter `NOME_FONTE`, o estado `status` e `temCredencial`. Verificar: `tsc` / lint sem aviso de variável não usada e sem erro de referência.
- [x] 1.3 Em `src/renderer/estilos/cabecalho.css`, ajustar `.conexao` de pílula com texto para botão de ícone (alvo de toque quadrado com raio, glifo centralizado) e remover `.conexao__ponto` e as cinco regras `.conexao__ponto--*`. Verificar: `grep -n "conexao__ponto" src/renderer` não retorna nada.

## 2. Filtro "Buscar no conteúdo": botão de alternância

- [x] 2.1 Em `src/renderer/componentes/Filtros.tsx`, trocar o `<label className="filtro filtro--check">` + `<input type="checkbox">` por `<button type="button" className={`filtro ${filtros.buscarConteudo ? 'filtro--ativo' : ''}`} aria-pressed={Boolean(filtros.buscarConteudo)} onClick={() => aoAlterar({ ...filtros, buscarConteudo: !filtros.buscarConteudo })}>`, com `<span aria-hidden="true">✓</span>` antes do rótulo apenas quando ligado, e o texto "Buscar no conteúdo". Verificar: o controle aparece como botão-pílula na barra, alterna `aria-pressed` ao clicar e dispara nova consulta com `buscarConteudo` alternado.
- [x] 2.2 Em `src/renderer/estilos/busca.css`, remover `.filtro--check` e as regras `.filtro--check input[type='checkbox']` / `:focus-visible`. Verificar: `grep -n "filtro--check\|checkbox" src/renderer/estilos/busca.css` não retorna nada; o botão herda `.filtro` / `.filtro--ativo` e o foco visível da regra global.

## 3. Testes de interface

- [x] 3.1 Em `test/interface/tabulacao.test.tsx`, trocar `getByRole('button', { name: /GitHub conectada/i })` por `{ name: 'Configurações' }`; `document.querySelector('.conexao')` segue válido. Verificar: `npm test -- tabulacao` passa, incluindo a contagem de dois focáveis no cabeçalho, três nos filtros, e o confinamento de foco do diálogo.
- [x] 3.2 Em `test/interface/configuracoes-llm.test.tsx`, trocar o `getByRole('button', { name: /GitHub conectada/i })` que abre o diálogo por `{ name: 'Configurações' }`. Verificar: `npm test -- configuracoes-llm` passa.
- [x] 3.3 Em `test/interface/busca-conteudo.test.tsx`, trocar `getByRole('checkbox', { name: /buscar no conteúdo/i })` por `getByRole('button', { name: /buscar no conteúdo/i })` e as asserções `toBeChecked()` / `not.toBeChecked()` por `toHaveAttribute('aria-pressed', 'true'|'false')`. Verificar: `npm test -- busca-conteudo` passa (padrão não pede conteúdo; clicar liga; começa desligado).
- [x] 3.4 Rodar a suíte de interface inteira e confirmar que nenhum outro teste dependia do texto "GitHub conectada", de `.conexao__ponto` ou do `role="checkbox"` do filtro. Verificar: `npm test -- test/interface` verde.

## 4. Verificação de comportamento

- [x] 4.1 Rodar o app (`npm run dev`) e confirmar no cabeçalho: engrenagem sem texto ao lado de Sincronizar; Tab alcança a engrenagem com foco visível; Enter/clique abre as configurações; com credencial inválida simulada, o cabeçalho não mostra estado e o diálogo mostra "credencial inválida". Verificar: os quatro pontos.
- [x] 4.2 Rodar o app e confirmar na barra de filtros: "Buscar no conteúdo" é um botão-pílula; clicar liga (marcador `✓`, `filtro--ativo`) e refaz a busca alcançando o conteúdo; clicar de novo desliga; alcançável por teclado com foco visível. Verificar: os quatro pontos.
- [x] 4.3 Rodar a suíte completa (`npm test`) e o type-check. Verificar: tudo verde.

## 5. Documentação (commit separado)

- [x] 5.1 `Docs/Requisitos/EspecificacaoSistemaAncorAI.md`: no mock da seção 10, trocar `[● GitHub conectada]` por `[⚙]`; na nota de acessibilidade da seção 10 e na RN26, registrar que o estado de conexão é apresentado na tela de configurações, não no cabeçalho; se o documento descrever a caixa "Buscar no conteúdo", ajustar para botão de alternância. Verificar: referências revisadas e coerentes com a spec do change.
- [x] 5.2 `AncorAI/README.md`: linha ~87 passa a citar o botão de configurações no cabeçalho em vez de "botão de conexão"; conferir a linha ~23 (acesso às configurações ao lado do Sincronizar) e qualquer menção à caixa "Buscar no conteúdo". Verificar: nenhuma menção a "botão de conexão", a indicador de conexão no cabeçalho ou a "caixa" de busca no conteúdo.
- [x] 5.3 `AGENTS.md`: conferir as seções 2 e 9 e ajustar qualquer menção ao indicador de conexão do cabeçalho. Verificar: `grep -ni "conect\|conexão" AGENTS.md` sem referência desatualizada ao cabeçalho.

## 6. Fechamento

- [x] 6.1 `openspec validate enxugar-controles-de-cabecalho-e-filtros --strict` sem erros.
- [x] 6.2 Preparar branch e commits (implementação + testes; documentação à parte), descrever o que foi feito e aguardar autorização da equipe antes de abrir PR (AGENTS §1).
