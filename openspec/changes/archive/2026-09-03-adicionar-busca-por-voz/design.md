# Design — Adicionar busca por voz

Ver `proposal.md` — *Why*. Requisitos observáveis em `specs/busca-por-voz/spec.md`.

## Context

Estado atual relevante:

- **App Electron** (ADR-0001), renderer React + TS isolado do Node (`contextIsolation: true`, `nodeIntegration: false`, `janela.ts`). Toda chamada externa e todo trabalho pesado ficam no processo principal; o renderer só enxerga o que o preload expõe (`window.ancorai`) e recebe resultados já tratados (ADR-0003).
- **Barra de busca** em `src/renderer/App.tsx`: `<form className="busca" role="search">` com `🔍` (`<span aria-hidden>`), `<input className="busca__campo">` controlado por `termoCampo`, e `<button className="busca__acao">Buscar</button>`. `aoSubmeter` transforma `termoCampo` em `filtros.termo` e dispara `executarBusca`. `campoBusca` é um `useRef` focado na abertura.
- **Tela de configurações** (`src/renderer/telas/Configuracoes.tsx`), diálogo modal com foco confinado (spec `configuracao-credenciais` — **Operação do diálogo de configurações por teclado**), já com seções de GitHub e LLM. O consentimento da LLM é persistido numa coleção de preferências (`src/main/banco/repositorio.ts`).
- **Canais IPC** em `src/compartilhado/canais.ts` — a fronteira de segurança é essa lista. Nenhum canal devolve credencial (ADR-0003) nem texto de documento (ADR-0005). `test/seguranca/fronteira-conteudo.test.ts` registra os handlers reais, exige que `[...handlers.keys()]` seja **exatamente** `Object.values(CANAIS)`, invoca cada um e falha se a marca de um texto ingerido aparecer na resposta.
- **Instrução versionada**: `src/main/llm/instrucao.ts` lê `instrucoes/resumo.md` do disco em runtime (empacotado em `resources/`, em dev na raiz). Padrão a reaproveitar.
- **CSP** em `src/renderer/index.html`: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`. Rege apenas o renderer.
- **Distribuição**: AppImage Linux via `electron-builder` (`AncorAI/README.md`). Uma plataforma-alvo hoje.
- Nenhum uso atual de microfone, `getUserMedia`, `MediaRecorder`, Web Speech ou modelo local.

## Goals / Non-Goals

**Goals:**

- Um caminho de captura → transcrição → campo de busca que não bloqueia a interface e não envia áudio para fora da máquina.
- Empacotamento sem toolchain de compilação nativa e sem inchar o instalador com o modelo.
- A busca por voz é totalmente removível da tela (recurso desligado) e totalmente acessória (falha nunca derruba a busca digitada).
- Reaproveitar os padrões já estabelecidos: trabalho pesado no main, instrução versionada em arquivo, preferência persistida como o consentimento da LLM, glifo emoji sem lib de ícones.

**Non-Goals (nível de design):**

- Transcrição em streaming / resultados parciais durante a fala.
- Condicionamento da transcrição por vocabulário (`initial_prompt`) — a engine escolhida não expõe isso de forma estável; fica como evolução.
- Medidor de nível de áudio ao vivo durante a escuta (pode entrar depois sem mudar specs nem tarefas).
- Build para macOS/Windows (só o registro no ADR/README do que faltaria: `NSMicrophoneUsageDescription`).
- Tornar `busca-documentos` ciente da origem do termo.

## Decisions

### 1. Nova capacidade `busca-por-voz`, sem tocar `busca-documentos`

Todo o comportamento novo — controle de microfone, ciclo de gravação, transcrição, ativação, download, permissão — fica numa capacidade própria. A `busca-documentos` não muda: "informar um termo e confirmar a busca" não fixa **como** o termo chega ao campo, e a confirmação continua explícita. É o mesmo argumento que manteve `busca-documentos` intacta na mudança de "enxugar controles".

**Descartado: `MODIFIED` em `busca-documentos` / **Busca por termo**.** Traria para dentro de um requisito estável de busca um mecanismo de entrada acessório e opcional, misturando dois ritmos de evolução. A separação deixa a voz removível no nível de spec.

### 2. Transcrição no main, dentro de um `utilityProcess`

A inferência do Whisper é CPU-bound (segundos para uma frase curta). Rodá-la no processo principal congelaria o event loop — IPC, menus, ciclo de vida da janela. Rodá-la no renderer contraria a arquitetura (AGENTS §6) e travaria a UI sem um worker.

A transcrição roda num **`utilityProcess`** dedicado (`utilityProcess.fork`), a forma idiomática do Electron para código Node pesado fora do main: isola travamentos e crashes da engine, é encerrável, e o main só troca mensagens com ele. O main permanece responsivo (spec — **Independência do restante da busca**).

**Descartado: `worker_threads`.** Funciona, mas compartilha o processo do main; um crash do runtime de inferência derruba a aplicação. `utilityProcess` isola melhor e integra com o ciclo de vida do Electron.

**Descartado: inferência no renderer (WASM + Web Worker).** Contra AGENTS §6; e obrigaria o renderer a carregar o runtime de ML, ampliando a superfície do processo que apresenta conteúdo não confiável.

### 3. transformers.js com `onnxruntime-node` (CPU), pré-compilado

`@huggingface/transformers` v3 (transformers.js, sucessor mantido de `@xenova/transformers`) — sem `node-gyp`, sem `electron-rebuild`, sem compilação no build. Q9 fixou "sem toolchain nativa"; isto continua satisfeito.

Um spike no início da implementação (script em `scratchpad/spike-whisper/`) fixou os fatos:

- **O backend WASM não roda no Node.** O build Node do `@huggingface/transformers` v3 só aceita `device: 'cpu'` (→ `onnxruntime-node`) ou `'cuda'`; `'wasm'` lança `Unsupported device`. WASM é exclusivo do build de navegador. A ideia original ("backend WASM no `utilityProcess`") não é possível sem forçar o bundle web com shims — frágil e sem suporte.
- **`onnxruntime-node` vem pré-compilado** (o pacote baixa o binário pronto por plataforma; nada de `node-gyp`).
- **Peso real (medido no `electron-builder --dir`):** `@huggingface/transformers` v3 arrasta junto `onnxruntime-web` (WASM, ~92 MB) e um `dist/` de ~45 MB, além do `onnxruntime-node`. Com os `.so` de CUDA (342 MB), TensorRT, e os binários de macOS/Windows/arm excluídos no `electron-builder.yml`, o recurso adiciona **~180–200 MB** ao pacote descompactado (ORT-node Linux x64 ~43 MB fora do asar + `onnxruntime-web` + `dist` dentro do asar). O modelo (~250 MB) continua **fora**, baixado sob demanda.
- **Velocidade:** `whisper-small` q8 carrega em ~2 s (uma vez por processo) e transcreve um ditado curto em ~1–2 s numa máquina comum. (O `whisper-base` do spike era mais rápido — RTF ≈ 0,06 — mas a precisão em pt-BR não compensou.) Com o `utilityProcess` persistente, só o primeiro ditado da sessão paga a carga.

~200 MB não é "gigabytes no instalador" (o que a ADR-0006 rejeitou), mas é maior do que uma estimativa ingênua do `libonnxruntime.so` sozinho sugeriria — o ADR-0008 registra o número medido e a exclusão dos providers de GPU. Aparar mais (`onnxruntime-web`, o `dist` web do transformers.js) é possível, mas exige testar o app empacotado em runtime — fica como acompanhamento. O binário é pré-compilado e o alvo é único (AppImage Linux x64), então o gate de build (AGENTS §7) não muda.

**Descartado: `@xenova/transformers` v2 com WASM no Node.** É o único jeito de ter WASM puro no Node (cai para WASM quando `onnxruntime-node` está ausente). Mas está sem manutenção desde ~2024, é mais lento, e exigiria impedir ativamente o `onnxruntime-node` de ser resolvido. Sem ganho real frente aos 22 MB do ORT-node CPU.

**Descartado: inferência no renderer (build web + WASM + Web Worker).** É o caminho WASM melhor suportado, mas contraria a Q11, exige mudança no CSP (`wasm-unsafe-eval` + `connect-src` para o download do modelo no renderer) e coloca o runtime de ML no processo que exibe conteúdo não confiável.

**Descartado: whisper.cpp com binding nativo.** Q9. Mais rápido, mas adiciona compilação nativa ao build.

### 4. Modelo `onnx-community/whisper-small` quantizado, revisão fixada

Multilíngue (cobre pt-BR), quantizado (`dtype: 'q8'`). São ~250 MB de artefatos ONNX (encoder 92 MB + decoder 157 MB), baixados sob demanda.

**Rodada 1 usou `whisper-base` (~76 MB).** No teste com fala real em pt-BR o `base` errava demais — palavras trocadas, frases truncadas, jargão irreconhecível —, ao ponto de a confirmação manual não compensar. O `small` resolveu na prática; o custo é ~3× o download e ~1–2 s a mais de inferência por ditado. `base`/`tiny` continuam documentados como troca de uma linha para máquinas fracas.

`onnx-community/whisper-small` é o repositório mantido para o transformers.js v3.

O nome do modelo **e a revisão** (hash de commit do Hub, não `main`) ficam fixados na configuração versionada, para que dois usuários baixem o mesmo artefato. Os hashes do manifesto vêm de baixar o modelo uma vez e conferir cada arquivo do cache.

**Descartado: `whisper-tiny` / `whisper-base` como padrão.** Mais rápidos e leves, mas a precisão em pt-BR não segura fala corrida. Ficam como fallback por config.

**Descartado: variante `.en`.** Só inglês.

### 5. Pipeline de áudio: captura e reamostragem no renderer

No renderer:

1. `navigator.mediaDevices.getUserMedia({ audio: true })` — dispara o pedido de permissão do Electron no primeiro uso.
2. Captura com `MediaRecorder` (ou `AudioWorklet` para acesso direto às amostras).
3. **Detecção de silêncio**: um `AnalyserNode` mede o RMS do sinal; abaixo de um limiar por ~1,5 s contínuos, encerra a captura. Um temporizador independente impõe o teto de duração. **A parada por silêncio só arma depois que houve fala** (histerese: entra em "fala" com o dobro do limiar) — sem isso, a pausa natural entre tocar o botão e começar a falar encerraria a captura num trecho mudo, e o Whisper "alucina" uma frase fixa sobre silêncio. Áudio final praticamente mudo ou com menos de ~0,3 s é descartado antes de ir ao worker. No worker, `return_timestamps: true` + `no_speech_threshold` fazem o Whisper cortar segmentos sem fala em vez de inventar texto.
4. Ao encerrar, decodificar o áudio e **reamostrar para 16 kHz mono Float32** via `OfflineAudioContext` (o Whisper espera essa taxa). Web Audio faz a reamostragem nativamente.
5. Enviar o `ArrayBuffer` de PCM por `ipcRenderer.invoke('voz:transcrever', buffer)` — `ArrayBuffer` é transferível, sem cópia cara.

O main repassa o buffer ao `utilityProcess`, recebe `{ texto }` (ou um motivo de erro) e devolve ao renderer.

**Descartado: enviar o áudio comprimido (webm/opus) cru e decodificar no main.** Exigiria um decodificador no main — ffmpeg embutido ou outra lib. A decodificação e a reamostragem são nativas no renderer via Web Audio; não custam dependência.

### 6. CSP e permissão de microfone

**O CSP do renderer não muda.** Download do modelo e inferência acontecem no processo Node (main/`utilityProcess`), fora do alcance do CSP. O renderer só precisa de `getUserMedia`, que é governado pela API de permissões do Electron — não pelo CSP (`media-src` rege `src` de `<audio>`/`<video>`, não captura).

Permissão, no `main` (novo `src/main/permissoes.ts`, chamado de `main/index.ts` após `app.whenReady`):

- `session.defaultSession.setPermissionRequestHandler` — conceder `media` **apenas para áudio** e **apenas** para a origem própria da aplicação (o `file://` empacotado / a URL de dev); negar todo o resto (câmera, geolocalização, etc.).
- `setPermissionCheckHandler` — coerente com o handler de request.
- Em `file://` o Chromium não persiste a decisão do usuário de forma confiável. O main registra o resultado da última tentativa (`concedida` / `negada` / `desconhecida`) e o expõe em `voz:modelo-estado`, para o renderer decidir entre microfone ativo e microfone desabilitado-com-orientação (spec — **Permissão de microfone**).
- Registrar no ADR/README que um build macOS exigiria `NSMicrophoneUsageDescription` (`electron-builder` `mac.extendInfo`).
- **Consentimento explícito no primeiro uso (rodada 2).** O Chromium dentro do Electron não desenha o balão de permissão; no Linux normalmente não há prompt do SO. Para a spec **Permissão de microfone** ("solicitar a permissão … no primeiro acionamento") ter uma manifestação visível, o `BotaoMicrofone` abre um modal próprio antes de qualquer `getUserMedia`. "Permitir" grava a preferência booleana `voz.microfoneConsentido` (via `voz:microfone`) e só então chama `getUserMedia`; usos seguintes vão direto. Conceder o microfone pela tela de configurações também marca esse consentimento.
- **Escolha do microfone (rodada 2).** `iniciarCaptura(captura, dispositivoId?)` usa `getUserMedia({ audio: { deviceId: { exact } } })`; se o dispositivo sumiu (`OverconstrainedError`/`NotFoundError`) volta ao padrão do sistema em vez de falhar o ditado. A tela de configurações lista `enumerateDevices()` filtrado a `audioinput`; como os rótulos só vêm após uma concessão, oferece um botão "permitir para listar" enquanto não houver nomes. A escolha é a preferência **textual** `voz.microfone` (`deviceId`; vazio = padrão) — o que motivou generalizar a coleção de preferências para `boolean | string` e adicionar `lerPreferenciaTexto`/`gravarPreferenciaTexto`.

### 7. Gestão do modelo: cache do transformers.js apontado para `userData`

- `env.cacheDir = join(app.getPath('userData'), 'modelos')` e `env.allowRemoteModels = false` por padrão. Só durante o download disparado pelo toggle o código liga `allowRemoteModels`, resolve o `pipeline`, e desliga de novo — em uso normal a engine nunca tenta a rede.
- **Layout do cache:** ao pedir uma `revision` fixa, o transformers.js grava em `<cacheDir>/<org>/<modelo>/<revisão>/…` — a revisão entra no caminho (sem `revision`, o layout é achatado). `modelo.ts` ancora o manifesto de hashes nessa pasta-com-revisão. Foi um bug de primeira rodada ("modelo não passou na verificação de integridade") justamente por o caminho não incluir a revisão.
- **Progresso**: `pipeline(..., { progress_callback })` do transformers.js emite andamento por arquivo; o main encaminha por `webContents.send('voz:modelo-progresso', ...)` para a barra na tela de configurações.
- **Integridade**: a engine não verifica hash. Um **manifesto versionado** no repo (`instrucoes/transcricao.md` ou arquivo ao lado) lista `arquivo → sha256` esperado; após o download, o main confere cada arquivo. Falha → apaga o diretório do modelo, `vozAtiva` volta a `false`, erro para a tela (spec — **Download do modelo sob demanda**).
- **Origem**: Hugging Face Hub (`huggingface.co`). Requisição feita pelo Node do main.

**Descartado: confiar em tamanho/ETag.** Detecta truncamento, não corrupção silenciosa nem artefato trocado.

### 8. Canais IPC

Adicionar a `CANAIS` (todos `ipcMain.handle`, respeitando a nota do arquivo):

| Canal | Direção | Payload → Resposta |
|---|---|---|
| `voz:transcrever` | invoke | `ArrayBuffer` (PCM 16 kHz mono) → `{ texto }` ou `{ erro }` |
| `voz:modeloEstado` | invoke | — → `{ vozAtiva, modelo: 'ausente'\|'baixando'\|'pronto'\|'erro', progresso?, permissao }` |
| `voz:ativar` | invoke | `boolean` → novo estado (liga: inicia download se preciso; desliga: cancela download em curso, mantém o modelo já baixado) |
| `voz:microfone` | invoke | `{ consentido?, dispositivoId? }` → novo estado (consentimento do primeiro uso e/ou microfone escolhido; nunca áudio) |

`voz:transcrever` devolve **a fala do próprio usuário** — categoria distinta do conteúdo de documento que a ADR-0005 confina. O comentário do canal em `canais.ts` diz isso explicitamente.

**Evento** `voz:modelo-progresso` (main → renderer, `webContents.send`) **não** entra em `CANAIS` — aquela lista é só de `handle` (é o que `fronteira-conteudo.test.ts` assume). Vai numa constante `EVENTOS_VOZ` à parte.

### 9. Persistência e configuração versionada

- **Preferências**: `voz.ativa` (booleana) e `voz.microfoneConsentido` (booleana) na mesma coleção do consentimento da LLM; `voz.microfone` (textual — `deviceId`, vazio = padrão do sistema). Ausência = `false`/`null`. A coleção passou a aceitar `boolean | string`.
- **Estado do modelo** (`ausente`/`pronto`) é **derivado do disco** (arquivos presentes + hash confere), nunca persistido — evita divergência entre a flag e a realidade do sistema de arquivos.
- **`instrucoes/transcricao.md`** (lido em runtime como `instrucoes/resumo.md`, via um `inicializarConfigVoz(process.resourcesPath, app.getAppPath())`): idioma (`portuguese`, fixo — o transformers.js 3.8 não detecta idioma e, sem `language`, assume inglês e *traduz* a fala; `auto`/vazio recaem em pt-BR no worker), `task: transcribe` (nunca `translate` — saída literal, sem tradução), limiar de silêncio (ms), duração máxima (s), limiar de `no_speech`, nome + revisão do modelo, e o manifesto de hashes. A equipe calibra o limiar de silêncio sem recompilar.

### 10. Máquina de estados do ditado (renderer)

```
ocioso ──(clique)──▶ solicitando-permissão ──(concedida)──▶ escutando
                              │                                 │
                        (negada)                     (silêncio | parar | teto)
                              ▼                                 ▼
                       ocioso (+orientação)               transcrevendo
                                                                │
                                          ┌─────────────────────┼─────────────────────┐
                                    (texto vazio)          (texto)                (falha)
                                          ▼                     ▼                     ▼
                                  ocioso (+"não ouvi")   campo preenchido,      ocioso (+erro)
                                                          foco no campo,
                                                          sem buscar
```

Cancelar durante `escutando` → `ocioso`, sem transcrição.

### 11. Teste da fronteira de conteúdo

`test/seguranca/fronteira-conteudo.test.ts`: acrescentar `ARGUMENTOS[CANAIS.vozTranscrever] = [new ArrayBuffer(32000)]` e dublar o módulo de transcrição (`vi.mock`) para devolver `{ texto: 'roadmap de setembro' }`. A asserção `expect([...handlers.keys()].sort()).toEqual(Object.values(CANAIS).sort())` obriga registrar os três `handle`; a asserção `not.toContain(MARCA)` continua válida — o transcrito nunca carrega texto de documento.

## Risks / Trade-offs

- **[Latência em máquina modesta]** O spike mediu RTF ≈ 0,06 num host de 16 núcleos; numa máquina de 2–4 núcleos a inferência pode subir para 2–4 s. → A parada automática por silêncio adianta o começo; o estado "transcrevendo" é explícito. Se incomodar, `whisper-tiny` via config é a saída sem novo ADR.
- **[Peso do pacote]** `@huggingface/transformers` v3 adiciona ~180–200 MB ao app descompactado (`onnxruntime-node` + `onnxruntime-web` + `dist`), mesmo sem CUDA. → Abaixo dos "gigabytes" da ADR-0006 e com o modelo (~250 MB) fora do instalador; a exclusão de CUDA/macOS/Windows/arm foi verificada no `electron-builder --dir` (resources 349 MB → 250 MB). Aparar `onnxruntime-web` e o `dist` web precisa de teste do app empacotado — acompanhamento registrado no ADR.
- **[`onnxruntime-node` e o `asar`]** O `.node` e o `.so` ficam fora do `asar` (`asarUnpack: node_modules/onnxruntime-node/bin/**`). → Verificado: o `electron-builder --dir` desempacota os binários e não inclui os `.so` de GPU.
- **[Precisão em jargão jurídico/IF]** Whisper erra siglas e nomes próprios do domínio. → A transcrição **preenche e não busca**; a correção antes de "Buscar" é parte do fluxo, não uma exceção. Viés por vocabulário fica como evolução.
- **[Permissão de microfone em `file://`]** O Chromium não persiste a decisão de forma confiável no empacotado. → O main rastreia o último resultado e o expõe; o pior caso é o app perguntar de novo numa sessão futura, não um estado quebrado.
- **[Hugging Face Hub indisponível no momento da ativação]** Sem rede ou Hub fora do ar → o download falha. → `vozAtiva` volta a `false` com erro claro; a busca digitada nunca é afetada; o usuário tenta de novo depois.
- **[Modelo órfão após rollback]** Reverter a feature deixa `userData/modelos/` ocupado. → Inofensivo; o README documenta o caminho para apagar.

## Migration Plan

Mudança de renderer + main + nova dependência npm. Sem migração de dados: a preferência `vozAtiva` ausente é `false`.

Entrega:

1. Commit de implementação: dependência, `src/main/voz/`, `src/main/permissoes.ts`, canais, renderer (barra + configurações + captura), tipos, e o ajuste dos testes existentes.
2. Commit de documentação (padrão do repo): ADR-0008, `AGENTS.md`, `README.md`, `EspecificacaoSistemaAncorAI.md`, `GlossarioTecnico.md`, `instrucoes/transcricao.md`.

Rollback: reverter os commits e `npm rm @huggingface/transformers`. Modelo baixado fica órfão em `userData` (inofensivo).

Ordem de PR: depende do PR de `feat/enxugar-controles-de-cabecalho-e-filtros` entrar antes (mesma região da barra de busca).

## Open Questions

- Valores exatos do limiar de silêncio, do teto de duração e do limiar de `no_speech` — calibrar durante a implementação/testes; não mudam specs, abordagem nem tarefas (vão para `instrucoes/transcricao.md`).
- ~~Revisão exata / `base` vs `tiny` a fixar~~ — **resolvido**: `base` (e `tiny`) erraram demais em pt-BR no teste com fala real; padrão passou a `onnx-community/whisper-small` @ `36050c46…` (tarefa 12.9), troca só de config.
- Confirmar `onnxruntime-node` rodando dentro de um `utilityProcess` empacotado (não só em `node` solto) — o spike validou em Node puro; a checagem final é a tarefa de build.
