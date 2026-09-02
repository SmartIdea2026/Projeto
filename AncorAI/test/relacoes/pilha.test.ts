// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Pilha de documentos relacionados.
 *
 * O eixo dos testes: a proximidade sai da sobreposição dos assuntos, com
 * assunto raro pesando mais; o limiar mantém fora quem só compartilha um
 * assunto comum; e a análise diz, por aviso, quando parte do acervo ainda não
 * foi classificada.
 */

const banco = await import('../../src/main/banco/repositorio');
const { pilhaDe, pesoInverso, TETO_PILHA } = await import('../../src/main/relacoes/pilha');

let diretorio: string;
let inventario: Documento[] = [];

function doc(nome: string): Documento {
  return {
    id: `github:org/repo:${nome}`,
    nome,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: `https://github.com/org/repo/blob/main/${nome}`
  };
}

/** Acrescenta um documento ao inventário e, se `rotulos` vier, o classifica. */
async function registrar(
  documento: Documento,
  rotulos?: { tipo: string; assuntos: string[] }
) {
  inventario.push(documento);
  await banco.sincronizarInventario(inventario);
  if (!rotulos) return;
  await banco.gravarConteudo({
    _id: documento.id,
    versaoConteudo: 'sha-1',
    estado: 'extraido',
    texto: 'texto qualquer',
    truncado: false
  });
  await banco.gravarResumo(documento.id, {
    resumo: 'Resumo.',
    tipo: rotulos.tipo,
    assuntos: rotulos.assuntos,
    destaques: ['ponto']
  });
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-relacoes-'));
  inventario = [];
  await banco.abrirBanco(diretorio);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
});

describe('peso inverso à frequência', () => {
  it('um assunto em quase todo documento pesa perto de zero', () => {
    expect(pesoInverso(100, 95)).toBeLessThan(0.1);
  });

  it('um assunto raro pesa alto', () => {
    expect(pesoInverso(100, 3)).toBeGreaterThan(3);
  });
});

describe('montagem da pilha', () => {
  it('relaciona documentos pela sobreposição de assuntos, do mais próximo ao menos', async () => {
    // "comum" está em todo mundo; "nicho" e "raro" em poucos.
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['comum', 'nicho', 'raro'] });
    await registrar(doc('proximo.md'), { tipo: 'Nota', assuntos: ['comum', 'nicho', 'raro'] });
    await registrar(doc('meio.md'), { tipo: 'Nota', assuntos: ['comum', 'nicho'] });
    await registrar(doc('distante.md'), { tipo: 'Nota', assuntos: ['comum', 'solto'] });
    await registrar(doc('enche1.md'), { tipo: 'Nota', assuntos: ['comum'] });
    await registrar(doc('enche2.md'), { tipo: 'Nota', assuntos: ['comum'] });

    const { pilha, semClassificacao } = await pilhaDe('github:org/repo:foco.md');

    expect(semClassificacao).toBe(false);
    const nomes = pilha.map((item) => item.nome);
    // "distante" compartilha só "comum" (frequente) — abaixo do limiar, fora.
    expect(nomes).toEqual(['proximo.md', 'meio.md']);
  });

  it('um único assunto raro em comum já basta para entrar', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['raro', 'a', 'b'] });
    await registrar(doc('so-raro.md'), { tipo: 'Nota', assuntos: ['raro', 'x', 'y'] });
    // Enchimento com assuntos próprios: "raro" fica em 2 de 16 documentos, e
    // seu peso passa do limiar — um assunto em comum só, mas raro, basta.
    for (let i = 0; i < 14; i += 1) {
      await registrar(doc(`enche${i}.md`), { tipo: 'Nota', assuntos: [`t${i}`, `u${i}`] });
    }

    const { pilha } = await pilhaDe('github:org/repo:foco.md');

    expect(pilha.map((item) => item.nome)).toContain('so-raro.md');
  });

  it('deixa fora quem compartilha só um assunto comum', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['comum', 'x'] });
    await registrar(doc('so-comum.md'), { tipo: 'Nota', assuntos: ['comum', 'z'] });
    await registrar(doc('enche1.md'), { tipo: 'Nota', assuntos: ['comum'] });
    await registrar(doc('enche2.md'), { tipo: 'Nota', assuntos: ['comum'] });

    const { pilha } = await pilhaDe('github:org/repo:foco.md');

    expect(pilha).toEqual([]);
  });

  it('nunca inclui o próprio documento em foco', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });
    await registrar(doc('outro.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });

    const { pilha } = await pilhaDe('github:org/repo:foco.md');

    expect(pilha.map((item) => item.id)).not.toContain('github:org/repo:foco.md');
  });

  it('corta a pilha no teto', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['a', 'b', 'c'] });
    for (let i = 0; i < TETO_PILHA + 3; i += 1) {
      await registrar(doc(`rel${i}.md`), { tipo: 'Nota', assuntos: ['a', 'b', 'c'] });
    }

    const { pilha } = await pilhaDe('github:org/repo:foco.md');

    expect(pilha).toHaveLength(TETO_PILHA);
  });

  it('desempata pelo mesmo tipo do documento em foco', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });
    await registrar(doc('mesma-especie.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });
    await registrar(doc('outra-especie.md'), { tipo: 'Relatório', assuntos: ['a', 'b'] });

    const { pilha } = await pilhaDe('github:org/repo:foco.md');

    expect(pilha.map((item) => item.nome)).toEqual([
      'mesma-especie.md',
      'outra-especie.md'
    ]);
  });
});

describe('cobertura parcial', () => {
  it('avisa quantos documentos ainda não foram classificados', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });
    await registrar(doc('rel.md'), { tipo: 'Nota', assuntos: ['a', 'b'] });
    await registrar(doc('sem1.md'));
    await registrar(doc('sem2.md'));
    await registrar(doc('sem3.md'));

    const { aviso } = await pilhaDe('github:org/repo:foco.md');

    expect(aviso?.mensagem).toContain('3 documento(s)');
  });

  it('não avisa quando todo o inventário está classificado', async () => {
    await registrar(doc('foco.md'), { tipo: 'Ata', assuntos: ['a', 'b'] });
    await registrar(doc('rel.md'), { tipo: 'Nota', assuntos: ['a', 'b'] });

    const { aviso } = await pilhaDe('github:org/repo:foco.md');

    expect(aviso).toBeUndefined();
  });
});

describe('documento em foco sem classificação', () => {
  it('devolve pilha vazia e a marca de sem classificação, sem erro', async () => {
    await registrar(doc('foco.md'));
    await registrar(doc('rel.md'), { tipo: 'Nota', assuntos: ['a', 'b'] });

    const resposta = await pilhaDe('github:org/repo:foco.md');

    expect(resposta).toEqual({ pilha: [], semClassificacao: true });
  });
});
