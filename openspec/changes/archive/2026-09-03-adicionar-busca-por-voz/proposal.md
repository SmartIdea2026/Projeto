# Proposta — Adicionar busca por voz
**Issue:** #90
**Status:** Proposto
**Data:** 03/09/2026

## Why

Digitar o termo é o único jeito de começar uma busca hoje. Quem chega ao AncorAI sabendo o nome de uma pessoa ou de um documento, mas não a grafia exata, ou está com as mãos ocupadas, ou simplesmente pensa mais rápido do que digita, não tem atalho. A equipe já levantou a ideia de "pesquisa por comando de voz" na sprint review de 28/08/2026 (ata), sem decisão registrada.

Esta proposta entrega o caso mais simples e mais útil dessa ideia: **ditado**. O usuário fala, a fala vira texto no campo de busca, e ele confirma a busca como sempre fez. Sem interpretar comandos, sem mudar a busca em si — só uma segunda forma de preencher o campo.

A transcrição roda **na máquina do usuário**, com um modelo Whisper local. O áudio não sai do computador. Isso mantém a postura do app (o conteúdo dos documentos nunca deixa a máquina, ADR-0005) e evita reabrir a discussão de envio a serviço externo (ADR-0006).

## What Changes

### Ícone de microfone na barra de busca

- **Um botão de microfone entra no `<form className="busca">`**, ao lado do botão "Buscar". Glifo emoji em `<span aria-hidden="true">` + `aria-label`, no padrão dos demais controles do renderer (`⚙`, `⟳`, `🔍`). Sem biblioteca de ícones.
- **Toque para começar a ditar.** A captura para sozinha ao detectar ~1,5 s de silêncio; um botão de parar visível durante a escuta encerra antes. Há um teto de duração para a gravação.
- **A transcrição preenche o campo de busca e devolve o foco a ele.** O texto ditado **substitui** o conteúdo atual do campo. A busca **não** é disparada automaticamente — o usuário confere o texto e aciona "Buscar" (ou Enter). Transcrição erra em nome próprio e jargão; a confirmação é a rede de segurança.
- Idioma fixo: **pt-BR**, transcrição literal (`task: transcribe`, nunca `translate`). Sem seletor. O transformers.js 3.8 não detecta idioma — sem `language` ele assume inglês e traduz —, então o idioma é travado na config.

### Ativação nas configurações e download do modelo

- **Um controle "Ativar busca por voz" na tela de configurações, desligado por padrão.** Enquanto estiver desligado, **o ícone de microfone não aparece** na barra de busca.
- **Ligar o controle inicia o download do modelo Whisper** (~250 MB — `whisper-small`), com barra de progresso na tela de configurações. O ícone de microfone só passa a aparecer quando o modelo está pronto.
- Download interrompido ou corrompido: o arquivo parcial é descartado, o controle volta para "desligado" e a tela informa a falha. Integridade verificada por hash.
- O modelo fica em `app.getPath('userData')`, fora do instalador.

### Estados e acessibilidade

- Estados do controle de microfone: *default*, *hover*, *foco*, *ouvindo* (loading 1), *transcrevendo* (loading 2), *vazio* (silêncio / nenhuma fala reconhecida → aviso curto "Não ouvi nada, tente de novo"), *erro*.
- Permissão de microfone negada de forma permanente → ícone visível porém desabilitado, com dica explicando onde reabilitar.
- Todo o fluxo é operável por teclado, com foco visível, e nenhum estado é comunicado só por cor.

### Fora de escopo

- Comandos estruturados / interpretação de intenção ("filtrar por contrato", "abrir o terceiro resultado"). Isto é só ditado.
- Transcrição em streaming (texto aparecendo palavra a palavra durante a fala).
- Seletor de idioma na interface, detecção automática de idioma, ou tradução da fala.
- Ditado em qualquer outro campo que não o de busca.
- Empacotar o modelo no instalador.

## Capabilities

### New Capabilities

- `busca-por-voz`: ditar o termo de busca por voz. Cobre o controle de microfone na barra de busca, o ciclo de gravação (toque para iniciar, parada automática por silêncio, parada manual, teto de duração), a transcrição por modelo local, o preenchimento do campo de busca sem disparo automático, a ativação do recurso nas configurações, o download do modelo sob demanda, a permissão de microfone e a garantia de que o áudio não deixa a máquina.

### Modified Capabilities

Nenhuma no nível de spec.

`busca-documentos` **não** muda: o requisito **Busca por termo** descreve que "o usuário informe um termo e confirme a busca" — a forma como o termo chega ao campo (digitação ou ditado) não está fixada na spec, e a confirmação continua sendo um ato explícito do usuário. Preencher o campo por voz é uma nova entrada para o mesmo comportamento observável, como foi o argumento para não tocar `busca-documentos` na mudança de "enxugar controles".

`configuracao-credenciais` **não** muda: o requisito **Operação do diálogo de configurações por teclado** já cobre o contêiner do diálogo (foco confinado, Escape fecha, foco retorna) e vale para a nova seção sem alteração. O controle de ativação da voz não é uma credencial nem acesso a serviço externo; seu comportamento fica descrito na capacidade `busca-por-voz`.

## Impact

**Nova decisão de arquitetura — exige ADR (ADR-0008).** Transcrição por modelo Whisper local, baixado sob demanda, inferência no processo principal, áudio nunca sai da máquina. O ADR precisa:

- Superar explicitamente o argumento da ADR-0006 contra modelo local ("acrescentariam gigabytes ao instalador"): o download sob demanda mantém o modelo (~250 MB) fora do instalador; o que entra é a biblioteca de inferência do `@huggingface/transformers` (~180–200 MB medidos, com os providers de GPU e binários de outras plataformas excluídos no `electron-builder`) — grande, mas não gigabytes, e aparável.
- Registrar a permissão de microfone no Electron via `session.setPermissionRequestHandler` / `setPermissionCheckHandler`, dentro da fronteira da ADR-0003 (o renderer só ganha acesso à mídia; nada de novo cruza para fora do main).
- Citar ADR-0005: o áudio e o texto transcrito são um novo tipo de dado; o áudio é processado e descartado no main, e o transcrito — fala do próprio usuário, não conteúdo de documento — volta ao renderer pelo mesmo princípio de um termo digitado.

**Dependências novas:**

- `@huggingface/transformers` v3 (transformers.js, sucessor mantido de `@xenova/transformers`) — sem toolchain de compilação nativa (`node-gyp`/`electron-rebuild`); traz `onnxruntime-node` já pré-compilado (uma plataforma-alvo: AppImage Linux x64). Um spike confirmou que o backend WASM **não** roda no build Node do v3 — daí `onnxruntime-node` CPU, com os `.so` de CUDA/TensorRT e os binários de macOS/Windows/arm excluídos do pacote (`electron-builder.yml`). O modelo `onnx-community/whisper-small` quantizado **não** é dependência npm — é baixado em runtime para `userData/modelos`.

**Código do renderer:**

- `src/renderer/App.tsx` — botão de microfone no `<form className="busca">`; ao receber o transcrito, `setTermoCampo(texto)` e foco em `campoBusca`, **sem** chamar `aoSubmeter`.
- Novo módulo de captura de áudio no renderer (`getUserMedia` + `MediaRecorder`/`AudioWorklet`, detecção de silêncio por `AnalyserNode`, reamostragem para 16 kHz mono via `OfflineAudioContext`).
- `src/renderer/telas/Configuracoes.tsx` — seção "Busca por voz": controle de ativação + progresso de download + mensagens de erro.
- `src/renderer/estilos/busca.css` e `configuracoes.css` — estilo do botão de microfone e da seção.

**Código do main:**

- `src/main/voz/` — módulo novo: transcrição (transformers.js rodando num `utilityProcess` para não travar o event loop do main), gestão do modelo (download com progresso, verificação por hash, armazenamento em `userData`, leitura local-only fora do download).
- `src/main/ipc.ts` — handlers dos canais novos.
- `src/main/janela.ts` (ou novo `src/main/permissoes.ts`) — handlers de permissão de mídia da sessão.
- `src/compartilhado/canais.ts` — canais novos (`voz:transcrever`, `voz:modelo-estado`, `voz:modelo-baixar`, `voz:modelo-cancelar` — nomes fixados no design). Cada um respeitando a nota do arquivo: nenhum devolve conteúdo de documento; o transcrito é fala do usuário.
- `src/compartilhado/tipos.ts` — tipos novos (estado do modelo, estado do ditado, progresso de download).
- `src/main/banco/repositorio.ts` — persistir a ativação do recurso e o estado do modelo (coleção de preferências, como o consentimento da LLM).

**Configuração da transcrição versionada** (padrão de `instrucoes/resumo.md`): um arquivo versionado com os parâmetros do Whisper (idioma, `task`, limiares de silêncio) e, se a engine suportar condicionamento por prompt, um vocabulário de termos recorrentes do projeto para enviesar a transcrição. Lido em runtime.

**Testes:**

- `test/seguranca/fronteira-conteudo.test.ts` — o teste percorre **todos** os canais de `CANAIS` e exige que cada um esteja registrado. Adicionar argumentos plausíveis para `voz:transcrever` (um buffer PCM curto) e dublar o transcritor; a marca de conteúdo de documento continua não aparecendo — o transcrito é outra coisa.
- `test/interface/tabulacao.test.tsx` — o botão de microfone entra na ordem de foco da região `.busca` (hoje: campo + "Buscar"); a contagem de focáveis dessa região muda quando o recurso está ativo.
- Novos: `test/interface/ditado.test.tsx` (fluxo do controle e seus estados, com a API dublada), `test/voz/` (download do modelo, verificação de hash, transcrição no main com modelo dublado).

**Documentação a acertar na mesma entrega:**

- `Docs/ADR/ADR-0008-transcricao-de-voz-local.md` — novo.
- `AGENTS.md` — §2 (lista de capacidades / integrações), §6 (arquitetura: novo `utilityProcess` de voz), §9.
- `AncorAI/README.md` — seção sobre a busca por voz e o modelo local baixado sob demanda.
- `Docs/Requisitos/EspecificacaoSistemaAncorAI.md` — mock da §10 (ícone de microfone na barra), tabela de RF/RNF, stack (§2).
- `Docs/Requisitos/GlossarioTecnico.md` — termos novos ("ditado na busca", "transcrição local", "modelo de voz").

**Branch:** `feat/busca-por-voz`, saída de `feat/enxugar-controles-de-cabecalho-e-filtros` (ainda não em `main`) porque a feature toca o mesmo `<form className="busca">`. O PR desta mudança depende do PR da "enxugar" entrar primeiro.
