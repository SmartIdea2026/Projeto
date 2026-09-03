import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  apagarResumosExistentes,
  fecharBanco,
  gravarConteudo,
  lerConteudo,
  migrarCategoriaSeNecessario
} from '../../src/main/banco/repositorio';

/**
 * Migração dos resumos existentes (categorizar-documentos-pelo-resumo).
 *
 * Resumos gerados sob o vocabulário aberto anterior não têm como corrigir só
 * o campo de categoria — são apagados por inteiro, para nascerem de novo já
 * sob a lista fechada. O que se verifica aqui: a operação em si (apaga quem
 * tem resumo, preserva quem não tem) e a garantia de rodar uma vez só por
 * instalação.
 */

let diretorio: string;

async function comResumo(id: string) {
  await gravarConteudo({
    _id: id,
    versaoConteudo: `sha-${id}`,
    estado: 'extraido',
    texto: 'Conteúdo qualquer.',
    truncado: false,
    resumo: 'Um resumo qualquer.',
    categoria: 'Ata',
    assuntos: ['exemplo'],
    destaques: ['Um ponto'],
    resumoEm: '2026-08-01T00:00:00Z'
  });
}

async function semResumo(id: string) {
  await gravarConteudo({
    _id: id,
    versaoConteudo: `sha-${id}`,
    estado: 'extraido',
    texto: 'Conteúdo qualquer, ainda sem resumo.',
    truncado: false
  });
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-migracao-'));
  await abrirBanco(diretorio);
});

afterEach(() => {
  fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
});

describe('apagarResumosExistentes', () => {
  it('apaga resumo, categoria, assuntos, destaques e resumoEm de quem tem resumo', async () => {
    await comResumo('com-resumo');

    await apagarResumosExistentes();

    const registro = await lerConteudo('com-resumo');
    expect(registro?.resumo).toBeUndefined();
    expect(registro?.categoria).toBeUndefined();
    expect(registro?.assuntos).toBeUndefined();
    expect(registro?.destaques).toBeUndefined();
    expect(registro?.resumoEm).toBeUndefined();
    // O texto e o estado não são resumo: continuam intactos.
    expect(registro?.texto).toBe('Conteúdo qualquer.');
    expect(registro?.estado).toBe('extraido');
  });

  it('não toca em registros sem resumo', async () => {
    await semResumo('sem-resumo');

    await apagarResumosExistentes();

    const registro = await lerConteudo('sem-resumo');
    expect(registro?.texto).toBe('Conteúdo qualquer, ainda sem resumo.');
    expect(registro?.estado).toBe('extraido');
  });
});

describe('migrarCategoriaSeNecessario', () => {
  it('roda no máximo uma vez: resumo gerado depois da migração não é apagado por ela de novo', async () => {
    await comResumo('primeiro');
    // `abrirBanco`, no `beforeEach`, já rodou a migração uma vez (acervo
    // vazio na ocasião) e gravou a marca — daqui em diante ela não roda mais
    // nesta instalação. Chamar de novo explicitamente confirma isso.
    await migrarCategoriaSeNecessario();

    const registro = await lerConteudo('primeiro');
    // Resumo gravado depois da marca: seguiria intacto mesmo que a migração
    // rodasse de novo por engano.
    expect(registro?.resumo).toBe('Um resumo qualquer.');
    expect(registro?.categoria).toBe('Ata');
  });
});
