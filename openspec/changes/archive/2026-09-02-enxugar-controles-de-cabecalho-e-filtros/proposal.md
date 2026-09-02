# Proposta — Enxugar os controles do cabeçalho e da barra de filtros

**Issue:** #92
**Status:** Proposto
**Data:** 02/09/2026

## Why

Dois controles da tela principal carregam mais peso visual do que a função pede:

1. **Cabeçalho.** A pílula "GitHub conectada / credencial inválida / sem conexão" acumula comunicar o estado da credencial e servir de porta para as configurações. Com uma única fonte (ADR-0004) o estado fica quase sempre em "conectada", ocupando espaço para dizer o óbvio; quando muda, o mesmo aviso já aparece no diálogo de configurações, na tela vazia de credenciais (CB10) e nos avisos de falha por fonte.
2. **Barra de filtros.** "Buscar no conteúdo" é uma caixa de seleção (`<input type="checkbox">` dentro de um `<label>`). Os outros controles da barra — Extensão, Período — são pílulas/botões. A caixa destoa do conjunto e mistura duas aparências de controle na mesma linha.

Os dois viram controles enxutos: o do cabeçalho, um botão só com ícone de engrenagem; o do filtro, um botão de alternância como o de Período, sem mudar o que cada um faz.

## What Changes

### Cabeçalho — acesso às configurações

- **O controle de configurações no cabeçalho passa a ser um botão só com ícone** — um emoji de engrenagem (`⚙`) num `<span aria-hidden="true">`, no padrão dos demais glifos do renderer (`⚓`, `🔍`, `⟳`). **Sem nenhum texto visível.** Rótulo acessível fixo (`aria-label="Configurações"`), alcançável por teclado, foco visível. A ação continua a mesma: abrir o diálogo de configurações.
- **O estado de conexão da fonte sai do cabeçalho.** O ponto colorido e o texto "GitHub conectada / credencial inválida / não configurada / sem conexão / verificando" deixam de ser apresentados na tela principal. Quem quer conferir o estado abre as configurações, onde ele já é mostrado por fonte.

### Barra de filtros — "Buscar no conteúdo"

- **"Buscar no conteúdo" deixa de ser caixa de seleção e vira um botão de alternância**, no mesmo formato do botão "Período" (`<button type="button" className="filtro ...">`), com `aria-pressed` refletindo o estado ligado/desligado. Continua desligado por padrão e continua alternando o mesmo `filtros.buscarConteudo`.
- **Estado ligado assinalado além da cor**: o botão ativo ganha o marcador `filtro--ativo` já existente (borda, fundo, peso) **e** um glifo de confirmação (`✓`) à frente do rótulo, para não depender só de cor/peso.
- O rótulo visível continua sendo o texto "Buscar no conteúdo" — agora ele é o próprio alvo de clique, sem caixa ao lado.

### Escopo

- **BREAKING (observável):** o estado de conexão deixa de ser visível sem abrir as configurações. Nenhuma mudança de contrato de dados, de canal ou de comportamento de busca.
- Sem mudança no diálogo de configurações, na tela vazia de credenciais, nos avisos de falha, na verificação de credenciais, nem na lógica de busca no conteúdo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `configuracao-credenciais`: o requisito **Validação das credenciais** passa a fixar que o resultado da verificação é apresentado na tela de configurações e que o cabeçalho da tela principal não comunica o estado de conexão da fonte. Um requisito novo, **Acesso às configurações pelo cabeçalho**, descreve o botão de ícone: rótulo acessível, alcance por teclado, foco visível, e que ele não carrega estado de conexão.

`busca-documentos` **não** muda no nível de spec: o requisito **Busca por termo** já descreve "um controle na interface" que liga/desliga a busca no conteúdo e exige apenas que ele "não seja um seletor de campo" e esteja "desligado por padrão" — nada disso depende de o controle ser caixa de seleção ou botão. Trocar a aparência do controle é mudança de apresentação, não de comportamento observável pinado na spec.

## Impact

**Acessibilidade.**
- Cabeçalho: o botão perde texto visível, então o nome acessível vem de `aria-label="Configurações"` — distinto do "Abrir configurações" já usado na tela vazia e no painel de resumo, para não colidir na árvore de acessibilidade nem em `getByRole`. O ícone vai em `<span aria-hidden="true">`. A regra da Especificação seção 10 ("estado de conexão... comunicado por texto e ícone, nunca apenas por cor") deixa de se aplicar ao cabeçalho porque ele deixa de comunicar esse estado; segue valendo no diálogo de configurações, que não muda.
- Filtro: o botão de alternância declara `aria-pressed`; o rótulo textual permanece como nome acessível. O estado ligado não depende só de cor (marcador `✓` + peso + borda).

**Código:**
- `src/renderer/App.tsx` — o bloco `.conexoes` que mapeia `['github']` vira um único botão de configurações; remoção do `ROTULO_ESTADO` (só usado ali) e do ponto `conexao__ponto`. `NOME_FONTE` permanece (avisos de falha). Estado `status` e `temCredencial` permanecem — alimentam a tela vazia e a mensagem de "nenhum documento".
- `src/renderer/componentes/Filtros.tsx` — o `<label className="filtro filtro--check">` com `<input type="checkbox">` vira `<button type="button" className="filtro ..." aria-pressed={...} onClick={...}>` que alterna `filtros.buscarConteudo`; glifo `✓` quando ligado.
- `src/renderer/estilos/cabecalho.css` — `.conexao` deixa de ser pílula com texto e vira botão de ícone; remoção de `.conexao__ponto` e `.conexao__ponto--*`.
- `src/renderer/estilos/busca.css` — remoção de `.filtro--check` e das regras `.filtro--check input[type='checkbox']` / `:focus-visible`; o botão reaproveita `.filtro` / `.filtro--botao` / `.filtro--ativo`.
- `test/interface/tabulacao.test.tsx` — clique que abre o diálogo (`name: /GitHub conectada/i` → `name: 'Configurações'`); o seletor `.conexao` / `.conexoes` segue válido; a contagem de focáveis do cabeçalho continua dois. A linha "Buscar no conteúdo, extensão e período" continua descrevendo três focáveis nos filtros (agora três botões/selects).
- `test/interface/configuracoes-llm.test.tsx` — clique de abertura do diálogo (`name: /GitHub conectada/i` → `name: 'Configurações'`).
- `test/interface/busca-conteudo.test.tsx` — `getByRole('checkbox', { name: /buscar no conteúdo/i })` → `getByRole('button', { name: /buscar no conteúdo/i })`; `toBeChecked()` → checagem de `aria-pressed`.

**Documentação a acertar na mesma entrega:**
- `Docs/Requisitos/EspecificacaoSistemaAncorAI.md` — o mock da seção 10 (linha ~304) troca `[● GitHub conectada]` por `[⚙]`; a nota de acessibilidade da seção 10 (linha ~347) e a RN26 ganham a ressalva de que o estado de conexão vive na tela de configurações. Se o mock/seção descreverem a caixa "Buscar no conteúdo", ajustar para botão de alternância.
- `AncorAI/README.md` — a linha ~87 ("Configure pelo botão de conexão no cabeçalho") passa a falar do botão de configurações; conferir menções à caixa "Buscar no conteúdo".
- `AGENTS.md` — conferir seções 2 e 9 para menções ao indicador de conexão do cabeçalho.

**Sem ADR.** Nenhuma decisão de arquitetura revertida: a fonte única continua sendo ADR-0004, a verificação de credenciais e seu reaproveitamento (RN28) não mudam, a busca no conteúdo continua aditiva e opt-in. São ajustes de apresentação; a mudança de spec fica registrada neste change.

**Dependências:** nenhuma biblioteca nova.
