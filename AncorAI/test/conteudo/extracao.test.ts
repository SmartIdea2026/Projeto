// @vitest-environment node
//
// Código do processo principal. A configuração global usa jsdom, por causa dos
// testes de interface, mas jsdom troca `ArrayBuffer`, `Blob` e `window` pelos
// equivalentes dele — e as bibliotecas de extração seguem o caminho de
// navegador quando enxergam um `window`, pedindo worker e falhando aqui.
// Rodar no ambiente que este código realmente usa é o que torna o teste
// representativo.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIMITE_CARACTERES_POR_DOCUMENTO, motivoParaNaoIngerir } from '../../src/main/conteudo/limites';
import { extrairTexto } from '../../src/main/conteudo/extracao';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Extração do texto por formato.
 *
 * O eixo destes testes é a distinção entre os três estados. Um documento que
 * não se deixa ler não é um erro do sistema, e tratá-lo como erro faria a
 * ingestão parar em cima de um PDF digitalizado.
 */

const EXEMPLOS = join(__dirname, 'exemplos');

function bytesDe(arquivo: string): ArrayBuffer {
  const conteudo = readFileSync(join(EXEMPLOS, arquivo));
  return conteudo.buffer.slice(
    conteudo.byteOffset,
    conteudo.byteOffset + conteudo.byteLength
  ) as ArrayBuffer;
}

function texto(conteudo: string): ArrayBuffer {
  return new TextEncoder().encode(conteudo).buffer as ArrayBuffer;
}

describe('formatos textuais', () => {
  it('lê markdown preservando a acentuação', async () => {
    const resultado = await extrairTexto(
      texto('# Ata da reunião\n\nDecisão: manter a persistência NoSQL.'),
      'md'
    );

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toContain('reunião');
    expect(resultado.texto).toContain('persistência');
  });

  it('lê txt', async () => {
    const resultado = await extrairTexto(texto('Cronograma da sprint'), 'txt');

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toBe('Cronograma da sprint');
  });
});

describe('formatos estruturados', () => {
  it('lê o texto de um PDF', async () => {
    const resultado = await extrairTexto(bytesDe('exemplo.pdf'), 'pdf');

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toContain('Levantamento de requisitos');
  });

  it('lê o texto de um DOCX', async () => {
    const resultado = await extrairTexto(bytesDe('exemplo.docx'), 'docx');

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toContain('Ata da reuniao de planejamento');
    expect(resultado.texto).toContain('NoSQL');
  });

  it('lê o texto de um EPUB, sem trazer script nem estilo', async () => {
    const resultado = await extrairTexto(bytesDe('exemplo.epub'), 'epub');

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toContain('O sistema unifica a busca de documentos');
    expect(resultado.texto).not.toContain('var oculto');
    expect(resultado.texto).not.toContain('color: red');
  });
});

describe('formatos sem leitor', () => {
  it.each(['xls', 'xlsx', 'doc'])(
    'registra %s como sem texto, com motivo, e não como falha',
    async (extensao) => {
      const resultado = await extrairTexto(texto('qualquer coisa'), extensao);

      expect(resultado.estado).toBe('sem-texto');
      expect(resultado.motivo).toBeTruthy();
      expect(resultado.texto).toBe('');
    }
  );

  it('não gasta processamento tentando ler um formato sem leitor', async () => {
    // Bytes que não são planilha alguma: se houvesse tentativa de análise, o
    // resultado seria `falha`, e não `sem-texto`.
    const resultado = await extrairTexto(texto('\x00\x01lixo binário'), 'xlsx');

    expect(resultado.estado).toBe('sem-texto');
  });
});

describe('ausência de texto e falha são coisas diferentes', () => {
  it('trata documento vazio como sem texto, não como falha', async () => {
    const resultado = await extrairTexto(texto('   \n\t  '), 'md');

    expect(resultado.estado).toBe('sem-texto');
    expect(resultado.motivo).toContain('não contém texto');
  });

  it('trata arquivo corrompido de formato conhecido como falha', async () => {
    const resultado = await extrairTexto(texto('isto não é um pdf'), 'pdf');

    expect(resultado.estado).toBe('falha');
    expect(resultado.motivo).toBeTruthy();
  });
});

describe('truncamento', () => {
  it('corta no limite e registra que cortou', async () => {
    const gigante = 'a'.repeat(LIMITE_CARACTERES_POR_DOCUMENTO + 500);
    const resultado = await extrairTexto(texto(gigante), 'txt');

    expect(resultado.estado).toBe('extraido');
    expect(resultado.texto).toHaveLength(LIMITE_CARACTERES_POR_DOCUMENTO);
    expect(resultado.truncado).toBe(true);
  });

  it('não marca truncamento quando o texto cabe', async () => {
    const resultado = await extrairTexto(texto('curto'), 'txt');

    expect(resultado.truncado).toBe(false);
  });
});

describe('descarte por tamanho, antes de baixar', () => {
  function documento(extras: Partial<Documento>): Documento {
    return {
      id: 'github:org/repo:a.pdf',
      nome: 'a.pdf',
      extensao: 'pdf',
      fonte: 'github',
      dataModificacao: '2026-08-27T12:00:00Z',
      link: 'https://github.com/org/repo/blob/main/a.pdf',
      versaoConteudo: 'abc',
      ...extras
    };
  }

  it('recusa o arquivo acima do limite', () => {
    const motivo = motivoParaNaoIngerir(documento({ tamanho: 5 * 1024 * 1024 }));

    expect(motivo).toContain('excede o limite');
  });

  it('aceita o arquivo dentro do limite', () => {
    expect(motivoParaNaoIngerir(documento({ tamanho: 1024 }))).toBeNull();
  });

  it('aceita quando a fonte não informou o tamanho', () => {
    expect(motivoParaNaoIngerir(documento({}))).toBeNull();
  });

  it('recusa documento sem identidade de conteúdo, que não há como endereçar', () => {
    const motivo = motivoParaNaoIngerir(documento({ versaoConteudo: undefined }));

    expect(motivo).toContain('identidade do conteúdo');
  });
});
