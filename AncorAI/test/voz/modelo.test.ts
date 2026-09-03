// @vitest-environment node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConfigVoz } from '../../src/main/voz/config';
import { apagarModelo, modeloIntegro, pastaDoModelo } from '../../src/main/voz/modelo';

/**
 * Estado do modelo no disco.
 *
 * O estado é derivado da presença e do hash dos arquivos do manifesto — nunca
 * de uma flag persistida. Um download interrompido deixa arquivos parciais;
 * `modeloIntegro` precisa recusá-los.
 */

const texto = 'conteúdo-de-exemplo';
const hash = createHash('sha256').update(texto).digest('hex');

const config: ConfigVoz = {
  modelo: 'onnx-community/whisper-small',
  revisao: 'r1',
  quantizacao: 'q8',
  idioma: 'portuguese',
  tarefa: 'transcribe',
  chunkLengthS: 30,
  noSpeechThreshold: 0.6,
  captura: {
    silencioLimiarRms: 0.01,
    silencioDuracaoMs: 1500,
    duracaoMaximaS: 30,
    taxaAmostragemHz: 16000
  },
  manifesto: {
    'config.json': hash,
    'onnx/encoder_model_quantized.onnx': hash
  }
};

let dados: string;

function escrever(relativo: string, conteudo: string): void {
  const caminho = join(pastaDoModelo(dados, config), ...relativo.split('/'));
  mkdirSync(join(caminho, '..'), { recursive: true });
  writeFileSync(caminho, conteudo);
}

beforeEach(() => {
  dados = mkdtempSync(join(tmpdir(), 'ancorai-modelo-voz-'));
});

afterEach(() => rmSync(dados, { recursive: true, force: true }));

describe('caminho do modelo', () => {
  it('inclui o segmento da revisão (é onde o transformers.js grava)', () => {
    const pasta = pastaDoModelo(dados, config);
    expect(pasta).toContain(join('onnx-community', 'whisper-small', config.revisao));
  });
});

describe('integridade do modelo', () => {
  it('é "ausente" quando não há arquivo nenhum', async () => {
    expect(await modeloIntegro(dados, config)).toBe(false);
  });

  it('é "pronto" quando todos os arquivos do manifesto batem com o hash', async () => {
    escrever('config.json', texto);
    escrever('onnx/encoder_model_quantized.onnx', texto);
    expect(await modeloIntegro(dados, config)).toBe(true);
  });

  it('recusa quando falta um arquivo do manifesto', async () => {
    escrever('config.json', texto);
    expect(await modeloIntegro(dados, config)).toBe(false);
  });

  it('recusa quando um arquivo existe mas o hash diverge', async () => {
    escrever('config.json', texto);
    escrever('onnx/encoder_model_quantized.onnx', 'bytes-corrompidos');
    expect(await modeloIntegro(dados, config)).toBe(false);
  });

  it('recusa arquivo de tamanho zero (download interrompido no começo)', async () => {
    escrever('config.json', texto);
    escrever('onnx/encoder_model_quantized.onnx', '');
    expect(await modeloIntegro(dados, config)).toBe(false);
  });
});

describe('apagarModelo', () => {
  it('remove a pasta inteira do modelo', async () => {
    escrever('config.json', texto);
    escrever('onnx/encoder_model_quantized.onnx', texto);
    expect(existsSync(pastaDoModelo(dados, config))).toBe(true);

    await apagarModelo(dados, config);
    expect(existsSync(pastaDoModelo(dados, config))).toBe(false);
  });

  it('não falha quando não há nada para apagar', async () => {
    await expect(apagarModelo(dados, config)).resolves.toBeUndefined();
  });
});
