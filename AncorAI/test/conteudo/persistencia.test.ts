// @vitest-environment node

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  conteudoCarregado,
  descartarConteudoAusente,
  fecharBanco,
  gravarConteudo,
  idsComConteudo,
  lerConteudo,
  listarAcessados,
  registrarAcesso,
  totalDeCaracteres
} from '../../src/main/banco/repositorio';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Persistência do texto, contra um banco real em diretório temporário.
 *
 * Dois pontos justificam este arquivo além do teste de persistência existente:
 * a coleção de conteúdo não pode ser carregada na inicialização, e o registro
 * de acesso não pode ter passado a guardar texto por tabela ao lado.
 */

let diretorio: string;

const documento: Documento = {
  id: 'github:SmartIdea2026/Projeto:Docs/ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-27T12:00:00Z',
  link: 'https://github.com/SmartIdea2026/Projeto/blob/main/Docs/ata.md',
  caminho: 'Docs/ata.md',
  repositorio: 'SmartIdea2026/Projeto',
  versaoConteudo: 'abc123'
};

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-conteudo-'));
  await abrirBanco(diretorio);
});

afterEach(() => {
  fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
});

describe('gravação e leitura do texto', () => {
  it('grava e devolve o texto com sua versão e estado', async () => {
    await gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'abc123',
      estado: 'extraido',
      texto: 'Decisão: manter a persistência NoSQL.',
      truncado: false
    });

    const registro = await lerConteudo(documento.id);

    expect(registro?.estado).toBe('extraido');
    expect(registro?.texto).toContain('NoSQL');
    expect(registro?.versaoConteudo).toBe('abc123');
    expect(registro?.extraidoEm).toBeTruthy();
  });

  it('devolve nulo para documento nunca ingerido', async () => {
    expect(await lerConteudo('github:org/repo:inexistente.md')).toBeNull();
  });

  it('grava o motivo dos estados sem texto, para não repetir a tentativa', async () => {
    await gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'abc123',
      estado: 'sem-texto',
      texto: '',
      truncado: false,
      motivo: 'Planilhas não são lidas nesta versão.'
    });

    const registro = await lerConteudo(documento.id);

    expect(registro?.estado).toBe('sem-texto');
    expect(registro?.motivo).toContain('Planilhas');
  });

  it('soma apenas o texto realmente extraído no total do acervo', async () => {
    await gravarConteudo({
      _id: 'a',
      versaoConteudo: '1',
      estado: 'extraido',
      texto: '12345',
      truncado: false
    });
    await gravarConteudo({
      _id: 'b',
      versaoConteudo: '2',
      estado: 'sem-texto',
      texto: '',
      truncado: false
    });

    expect(await totalDeCaracteres()).toBe(5);
  });
});

describe('abertura sob demanda', () => {
  it('não carrega a coleção de conteúdo ao abrir o banco', () => {
    expect(conteudoCarregado()).toBe(false);
  });

  it('não carrega a coleção de conteúdo ao listar os documentos acessados', async () => {
    await registrarAcesso(documento);
    await listarAcessados();

    expect(conteudoCarregado()).toBe(false);
  });

  it('carrega a coleção quando alguém pede o texto', async () => {
    await lerConteudo(documento.id);

    expect(conteudoCarregado()).toBe(true);
  });

  it('só cria o arquivo da coleção quando ela é usada', async () => {
    expect(readdirSync(diretorio)).not.toContain('conteudo_documentos.db');

    await gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'abc123',
      estado: 'extraido',
      texto: 'algo',
      truncado: false
    });

    expect(readdirSync(diretorio)).toContain('conteudo_documentos.db');
  });
});

describe('o que não é gravado', () => {
  it('não persiste bytes: o registro é texto e nada mais', async () => {
    await gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'abc123',
      estado: 'extraido',
      texto: 'Conteúdo legível',
      truncado: false
    });

    const bruto = readFileSync(join(diretorio, 'conteudo_documentos.db'), 'utf-8');
    const registro = JSON.parse(bruto.trim().split('\n').at(-1) as string);

    // Cada valor gravado é escalar. Um Buffer ou Uint8Array serializado em
    // JSON viraria objeto ou vetor de números — é isso que se recusa aqui.
    for (const valor of Object.values(registro)) {
      expect(['string', 'boolean', 'number']).toContain(typeof valor);
    }
    expect(bruto).not.toContain('"type":"Buffer"');
  });

  it('mantém o registro de acesso com apenas os cinco campos de sempre', async () => {
    await registrarAcesso(documento);
    await gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'abc123',
      estado: 'extraido',
      texto: 'Texto que não pode vazar para o registro de acesso',
      truncado: false
    });

    const [acessado] = await listarAcessados();

    expect(Object.keys(acessado).sort()).toEqual([
      'acessadoEm',
      'fonte',
      'id',
      'link',
      'nome'
    ]);

    const bruto = readFileSync(join(diretorio, 'documentos_acessados.db'), 'utf-8');
    expect(bruto).not.toContain('não pode vazar');
  });
});

describe('descarte do que saiu da fonte', () => {
  it('remove o texto de documentos ausentes do inventário e preserva os demais', async () => {
    for (const id of ['a', 'b', 'c']) {
      await gravarConteudo({
        _id: id,
        versaoConteudo: '1',
        estado: 'extraido',
        texto: 'x',
        truncado: false
      });
    }

    const removidos = await descartarConteudoAusente(['a', 'c']);

    expect(removidos).toBe(1);
    expect((await idsComConteudo()).sort()).toEqual(['a', 'c']);
  });
});
