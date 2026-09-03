// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inicializarConfigVoz, lerConfigVoz, recarregarConfigVoz } from '../../src/main/voz/config';

/**
 * Leitura da configuração da transcrição.
 *
 * O arquivo é Markdown com dois blocos json — parâmetros e manifesto —, lido em
 * runtime como a instrução do resumo. O teste cobre a leitura, a troca sem
 * reiniciar, e a mensagem clara quando o arquivo não existe.
 */

let dir: string;

const ARQUIVO = `# Configuração

\`\`\`json
{
  "modelo": "onnx-community/whisper-small",
  "revisao": "abc123",
  "quantizacao": "q8",
  "idioma": "portuguese",
  "tarefa": "transcribe",
  "chunkLengthS": 30,
  "noSpeechThreshold": 0.6,
  "captura": {
    "silencioLimiarRms": 0.01,
    "silencioDuracaoMs": 1500,
    "duracaoMaximaS": 30,
    "taxaAmostragemHz": 16000
  }
}
\`\`\`

## Manifesto

\`\`\`json
{ "config.json": "hash-do-config", "onnx/encoder_model_quantized.onnx": "hash-do-encoder" }
\`\`\`
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ancorai-config-voz-'));
  mkdirSync(join(dir, 'instrucoes'));
  writeFileSync(join(dir, 'instrucoes', 'transcricao.md'), ARQUIVO);
  recarregarConfigVoz();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('configuração da transcrição', () => {
  it('lê parâmetros e manifesto dos dois blocos json', () => {
    inicializarConfigVoz(dir);
    const config = lerConfigVoz();

    expect(config.modelo).toBe('onnx-community/whisper-small');
    expect(config.revisao).toBe('abc123');
    expect(config.captura.silencioDuracaoMs).toBe(1500);
    expect(config.manifesto['config.json']).toBe('hash-do-config');
    expect(config.manifesto['onnx/encoder_model_quantized.onnx']).toBe('hash-do-encoder');
  });

  it('usa o primeiro diretório candidato que tiver o arquivo', () => {
    inicializarConfigVoz(join(dir, 'nao-existe'), dir);
    expect(lerConfigVoz().modelo).toBe('onnx-community/whisper-small');
  });

  it('falha com mensagem clara quando o arquivo não existe', () => {
    inicializarConfigVoz(join(dir, 'vazio'));
    expect(() => lerConfigVoz()).toThrow(/não foi encontrada/i);
  });

  it('relê o arquivo após recarregarConfigVoz', () => {
    inicializarConfigVoz(dir);
    expect(lerConfigVoz().revisao).toBe('abc123');

    writeFileSync(
      join(dir, 'instrucoes', 'transcricao.md'),
      ARQUIVO.replace('abc123', 'def456')
    );
    recarregarConfigVoz();
    expect(lerConfigVoz().revisao).toBe('def456');
  });
});
