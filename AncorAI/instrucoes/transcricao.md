# Configuração da transcrição de voz

Este arquivo define o modelo e os parâmetros usados para converter em texto a
fala capturada na busca por voz. É lido em tempo de execução, não está embutido
no código, e pode ser revisado em Pull Request como qualquer outro documento do
projeto. Alterá-lo muda as próximas transcrições.

A transcrição roda inteiramente na máquina do usuário (ADR-0008). O áudio não é
enviado a nenhum serviço externo nem gravado em disco.

## Modelo

Usamos o `onnx-community/whisper-small` quantizado (`q8`), multilíngue, fixado numa
revisão específica do Hugging Face Hub para que todas as instalações baixem
exatamente os mesmos arquivos. São ~250 MB (encoder 92 MB + decoder 157 MB),
baixados sob demanda quando o usuário ativa a busca por voz — nunca embutidos no
instalador.

O `small` substituiu o `whisper-base` (~76 MB) por qualidade de transcrição:
o `base` erra bastante em pt-BR com fala corrida e termos do domínio. O `small`
custa mais download e ~2 s a mais de inferência por ditado.

Trocar de modelo (`whisper-base`, `whisper-tiny` — menores e mais rápidos, menos
precisos) é uma alteração só deste arquivo: ajuste `modelo`, `revisao` e o
`manifesto` (os hashes vêm de baixar o modelo uma vez e conferir cada arquivo).

## Parâmetros

Bloco lido pelo processo principal. `idioma` e `tarefa` vão para o pipeline
Whisper; os limiares de captura valem no renderer.

`idioma` é `"portuguese"` — fixo. O `@huggingface/transformers` 3.8 **não detecta
idioma**: sem `language` ele assume inglês ("No language specified - defaulting
to English") e o Whisper passa a verter o português falado para o inglês. Por
isso o idioma é travado. `"auto"` ou vazio aqui recaem em português.
`tarefa` é sempre `"transcribe"` — nunca `"translate"`: a saída é a fala literal,
no idioma de `idioma`, sem tradução. Para ditar em inglês, troque `idioma` para
`"english"` (uma edição só deste arquivo; vale no próximo início).

```json
{
  "modelo": "onnx-community/whisper-small",
  "revisao": "36050c46d777d46dc4b5f43f6d90574fc38f8732",
  "quantizacao": "q8",
  "idioma": "portuguese",
  "tarefa": "transcribe",
  "chunkLengthS": 30,
  "noSpeechThreshold": 0.6,
  "captura": {
    "silencioLimiarRms": 0.006,
    "silencioDuracaoMs": 1500,
    "duracaoMaximaS": 30,
    "taxaAmostragemHz": 16000
  }
}
```

- **`silencioLimiarRms`** — abaixo desse nível RMS o sinal conta como silêncio.
- **`silencioDuracaoMs`** — silêncio contínuo por esse tempo encerra a captura.
- **`duracaoMaximaS`** — teto absoluto de gravação; atingido, a captura para e o
  trecho gravado é transcrito.
- **`taxaAmostragemHz`** — o Whisper espera 16 kHz mono; o renderer reamostra
  para essa taxa antes de enviar.

Os três primeiros são os candidatos naturais a calibração depois dos primeiros
testes com usuários.

O worker limpa a transcrição antes de devolvê-la: remove as anotações de som que
o Whisper escreve entre colchetes ou parênteses (`[Música]`, `(applause)`) e a
pontuação de frase (ponto, vírgula, `!`, `?`, aspas) — um termo de busca pontuado
não casa com o mesmo termo sem pontuação. Hífen e apóstrofo internos das palavras
são mantidos.

## Manifesto de integridade

Após o download, o processo principal confere o SHA-256 de cada arquivo contra
esta lista. Qualquer divergência descarta o modelo inteiro e a busca por voz não
é ativada. Os caminhos são relativos à pasta da revisão em
`app.getPath('userData')/modelos/onnx-community/whisper-small/<revisao>/` — ao pedir
uma revisão fixa, o transformers.js grava os arquivos sob um segmento com o hash
da revisão.

```json
{
  "config.json": "457854d452f17661e197d74aee12b8e74fb75ba30ebfaa7426d0d61ea1e08a18",
  "generation_config.json": "f538b28220c6a6d6f1af1458d4141cacb4ef4963df3de98a19490440c412ddf0",
  "preprocessor_config.json": "a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d",
  "tokenizer.json": "27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566",
  "tokenizer_config.json": "2a4c4281cf9f51ac6ccc406fdc711a087afe6530f671fa7b80953edc498275ce",
  "onnx/encoder_model_quantized.onnx": "a43a83f3c5361cd591cfa7c36f14b43cf7cb22f47a415cc14a8d557be800fa92",
  "onnx/decoder_model_merged_quantized.onnx": "ec07c3cbb64172c39791e26ee870a65ac22b458c36722bfe2776b3dbf741e0c9"
}
```
