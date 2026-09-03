# ADR 0008: Transcrição de voz por modelo local

**Status:** Proposto
**Data:** 03/09/2026

## Contexto/Problema

A busca do Âncora começa por um único caminho: digitar o termo. A funcionalidade de busca por voz — falar o termo e deixar o sistema transcrevê-lo no campo — foi levantada pela equipe na sprint review de 28/08/2026, sem decisão registrada. Esta ADR decide **como** a transcrição acontece.

A decisão é de arquitetura por três motivos, cada um governado por uma ADR anterior:

1. **Onde a fala vira texto.** O Âncora é uma aplicação Electron desktop (ADR-0001). A Web Speech API do Chromium não é utilizável de forma confiável no Electron empacotado. Restam duas famílias: enviar o áudio a um serviço externo de transcrição, ou rodar um modelo na própria máquina.
2. **Se o áudio sai da máquina.** A ADR-0006 estabeleceu que enviar dados a um serviço externo de IA é uma decisão grave, que exige consentimento explícito e aviso permanente, e a tomou apenas para o texto dos documentos, cientemente, no plano gratuito do Gemini. Mandar o áudio da voz do usuário para fora seria uma segunda travessia dessa fronteira.
3. **O que entra no instalador.** A ADR-0006 descartou "modelo de linguagem local" com o argumento de que modelos capazes de resumir "acrescentariam gigabytes ao instalador". Um modelo de transcrição é outra classe de modelo — muito menor —, e o argumento precisa ser reavaliado, não herdado.

## Decisão Tomada

A transcrição da busca por voz **roda inteiramente na máquina do usuário**, com um modelo Whisper local, e **o áudio não sai do computador**.

Os limites abaixo são parte da decisão:

1. **Modelo:** `onnx-community/whisper-small` quantizado (`q8`), multilíngue, fixado numa revisão específica do Hugging Face Hub. São ~250 MB (encoder 92 MB + decoder 157 MB), **baixados sob demanda** quando o usuário ativa a busca por voz nas configurações — nunca embutidos no instalador. Um manifesto de SHA-256 versionado (`instrucoes/transcricao.md`) verifica a integridade; divergência descarta o modelo e a busca por voz não é ativada. Começamos com `whisper-base` (~76 MB); a precisão em pt-BR com fala corrida não segurou, e o `small` passou a ser o padrão — trocável por `base`/`tiny` só editando a configuração.
2. **Motor:** `@huggingface/transformers` (transformers.js), sem toolchain de compilação nativa. Um spike no início da implementação apurou que o backend WASM não roda no build Node desse pacote — só `onnxruntime-node` (CPU) ou CUDA. Usamos **`onnxruntime-node` CPU**, que vem pré-compilado (sem `node-gyp`, sem `electron-rebuild`).
3. **Isolamento:** a inferência roda num **`utilityProcess`** dedicado, não no processo principal. Um crash do runtime de ML derruba só esse processo; o principal segue respondendo. O processo principal nunca carrega o runtime de inferência — só troca mensagens com o worker.
4. **Áudio:** capturado no renderer (`getUserMedia`), reamostrado para 16 kHz mono via Web Audio, enviado ao processo principal por IPC, transcrito, e **descartado**. Não é gravado em disco em momento algum.
5. **Permissão de microfone:** a sessão do Electron passa a conceder `media` **apenas para áudio** e **apenas** para a janela da aplicação (`setPermissionRequestHandler`), negando câmera, tela e todo o resto (ADR-0003).
6. **O texto transcrito volta ao renderer.** É a fala do próprio usuário, da mesma natureza de um termo digitado — a fronteira da ADR-0005, que confina o texto **dos documentos**, não se aplica a ele.
7. **A transcrição preenche o campo de busca e não dispara a busca.** A confirmação continua sendo um ato explícito do usuário.
8. **Idioma fixo em pt-BR, transcrição literal.** O `@huggingface/transformers` 3.8 não implementa detecção de idioma — sem `language` ele assume inglês e o Whisper passa a *verter* o português falado para o inglês. Então `language` é sempre fixo (`portuguese` na config), com `task: transcribe` (nunca `translate`): a saída é a fala literal, sem tradução. Sem seletor de idioma na interface; ditar em inglês exige trocar `idioma` em `instrucoes/transcricao.md`. A pontuação de frase que o Whisper acrescenta é removida antes de o texto chegar ao campo (um termo de busca pontuado não casa com o mesmo termo sem pontuação).

Esta decisão **reavalia explicitamente** o argumento da ADR-0006 contra modelo local: com o download sob demanda, o modelo (~250 MB) fica fora do instalador. O que entra no pacote é a biblioteca de inferência.

## Justificativa

* **Privacidade sem novo consentimento.** Com a transcrição local, o áudio não sai da máquina e a ADR-0006 não se aplica. O usuário não precisa autorizar envio de dados de voz a terceiro porque não há envio. É a postura mais conservadora possível para um dado novo e sensível.
* **Sem dependência de rede na porta de entrada da busca.** A busca do Âncora é deliberadamente servível offline, do snapshot local. Uma transcrição na nuvem colocaria uma chamada de rede obrigatória no início de toda busca por voz. Com o modelo local, só o download inicial precisa de rede.
* **Sem toolchain nativo no build.** `onnxruntime-node` distribui binários pré-compilados por plataforma. O gate de build da equipe (`tsc` + `vitest` + `electron-vite build`, AGENTS §7) não muda, e o alvo é único (AppImage Linux x64).
* **Velocidade aceitável.** `whisper-small` q8 carrega em ~2 s e transcreve um ditado curto em ~1–2 s num host comum; a carga ocorre uma vez por sessão, com o `utilityProcess` persistente. (O `whisper-base` era mais rápido — RTF ≈ 0,06 no spike — mas a precisão não compensava.) Numa máquina fraca a inferência sobe para poucos segundos — aceitável para ditado, e trocável por `base`/`tiny` só editando a configuração.
* **O erro é perdoável por desenho.** A transcrição preenche o campo e não busca; corrigir antes de "Buscar" é parte do fluxo, não uma exceção.

## Alternativas Consideradas

* **Transcrição na nuvem (Gemini, que aceita áudio; ou Google Speech-to-Text):** descartada. Reintroduziria a fronteira da ADR-0006 para um dado novo (voz), exigiria consentimento e aviso permanentes, e tornaria a busca por voz dependente de rede. O ganho — nenhum peso no pacote — não compensa.
* **Backend WASM do transformers.js no `utilityProcess`:** era a intenção inicial (elimina binário nativo). O spike mostrou que o build Node do `@huggingface/transformers` v3 não expõe o device `wasm` — só `cpu` (via `onnxruntime-node`) e `cuda`. Forçar o bundle web com shims seria frágil e sem suporte.
* **`@xenova/transformers` v2 com WASM no Node:** é o único caminho para WASM puro no Node (cai para WASM quando `onnxruntime-node` está ausente). Descartada por estar sem manutenção desde ~2024 e ser mais lenta, sem ganho real frente ao `onnxruntime-node` CPU já pré-compilado.
* **`whisper.cpp` com binding nativo:** mais rápido, mas adiciona compilação nativa multiplataforma ao build — exatamente o que a escolha por bibliotecas em JavaScript puro evita.
* **Inferência no renderer (build web, WASM, Web Worker):** é o caminho WASM melhor suportado, mas contraria a arquitetura (trabalho pesado fora do renderer, AGENTS §6), exigiria afrouxar o CSP (`wasm-unsafe-eval` e `connect-src` para o Hub) e colocaria o runtime de ML no processo que apresenta conteúdo não confiável.
* **Embutir o modelo no instalador:** descartada. São ~250 MB que a maioria dos usuários — que não usa ditado — carregaria à toa. O download sob demanda é o que torna esta ADR compatível com a objeção de tamanho da ADR-0006.

## Consequências

* **Positivas:** a busca ganha uma segunda forma de entrada sem custo de cota, sem nova credencial, sem novo consentimento de envio de dados; o áudio nunca deixa a máquina; a busca digitada e o resto da aplicação não dependem em nada do recurso; a permissão de microfone passa a ter política explícita e mínima na sessão.
* **Negativas:** `@huggingface/transformers` v3 arrasta `onnxruntime-node` **e** `onnxruntime-web` (WASM, ~92 MB) **e** um `dist/` de ~45 MB. Com os providers de GPU (CUDA, 342 MB) e os binários de macOS/Windows/arm excluídos no `electron-builder.yml`, o recurso adiciona **~180–200 MB** ao app descompactado (verificado em `electron-builder --dir`: `resources/` passou de 349 MB para 250 MB após as exclusões). É grande — não "gigabytes", e o modelo continua fora —, mas maior do que o `libonnxruntime.so` sozinho sugeriria.
* **Riscos:**
  * **Peso do pacote.** Mitigação aplicada: exclusão de CUDA/TensorRT e dos binários de outras plataformas. Mitigação possível, não aplicada: aparar `onnxruntime-web` e o `dist` web do transformers.js — exige testar o app empacotado em runtime, o que não coube nesta entrega. Registrado como acompanhamento.
  * **Latência em máquina fraca.** `whisper-small` pode levar alguns segundos numa máquina de poucos núcleos. Mitigação: a parada automática por silêncio adianta o começo, o estado "transcrevendo" é explícito, e `whisper-base`/`tiny` são uma troca de uma linha na configuração — sem novo ADR.
  * **Precisão em jargão do domínio.** Whisper erra siglas e nomes próprios. Mitigação de produto: a transcrição preenche e não busca; a correção antes de confirmar é parte do fluxo. Viés por vocabulário fica como evolução (a engine não expõe condicionamento por prompt de forma estável hoje).
  * **Permissão de microfone em `file://`.** O Chromium não persiste a decisão de forma confiável no empacotado. Mitigação: o processo principal rastreia o resultado da última tentativa e a interface distingue "microfone disponível" de "negado — reabilite no sistema".
  * **Build para macOS/Windows no futuro.** Exigiria `NSMicrophoneUsageDescription` no `Info.plist` (electron-builder `mac.extendInfo`) e revisão das exclusões de binários. Fora do escopo agora (alvo é AppImage Linux).

## Referências

* Ata da sprint review de 28/08/2026 — proposta de "pesquisa por comando de voz" com Whisper (discutida, não decidida)
* ADR-0001 — Adoção de aplicação desktop com Electron (define a plataforma que descarta a Web Speech API)
* ADR-0003 — Gerenciamento das credenciais de API pela interface (disciplina de fronteira, estendida à permissão de microfone)
* ADR-0005 — Armazenamento local do conteúdo dos documentos (confina o texto **dos documentos**; o transcrito da voz é do usuário, e fica de fora dessa fronteira)
* ADR-0006 — Envio do texto dos documentos a serviço externo de IA (esta ADR reavalia o argumento "modelo local = gigabytes no instalador")
* `openspec/changes/adicionar-busca-por-voz/` — proposta, design, specs e tarefas desta mudança
* `AncorAI/instrucoes/transcricao.md` — modelo, revisão, parâmetros de captura e manifesto de integridade
