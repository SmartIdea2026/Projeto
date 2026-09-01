// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * A busca com termo ou período é servida do snapshot local da sincronização
 * (design, decisão 8).
 *
 * O que se verifica aqui: existindo snapshot, a busca não consulta a fonte —
 * nem o inventário, nem a autoria documento a documento; a autoria e a data
 * real gravadas são usadas; e um documento ainda sem autoria resolvida continua
 * encontrável pelo nome, com aviso. Sem snapshot, a busca cai na consulta ao
 * vivo.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste')
}));

const github = await import('../../src/main/fontes/github');
const banco = await import('../../src/main/banco/repositorio');
const servico = await import('../../src/main/busca/servico');

let diretorio: string;

function doc(nome: string, extras: Partial<Documento> = {}): Documento {
  return {
    id: `github:org/repo:${nome}`,
    nome,
    extensao: nome.split('.').pop() ?? 'md',
    fonte: 'github',
    dataModificacao: '2026-01-01T00:00:00Z',
    dataAproximada: true,
    link: `https://github.com/org/repo/blob/main/${nome}`,
    caminho: nome,
    repositorio: 'org/repo',
    versaoConteudo: `sha-${nome}`,
    tamanho: 100,
    ...extras
  };
}

const INVENTARIO = [doc('ata-2026-08.md'), doc('plano.md'), doc('requisitos.md')];

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-busca-snapshot-'));
  await banco.abrirBanco(diretorio);
  vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: INVENTARIO, aviso: null });
  vi.spyOn(github, 'documentosRecentes').mockResolvedValue({ dados: INVENTARIO, aviso: null });
  vi.spyOn(github, 'autoriaDoArquivo').mockResolvedValue(null);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Preenche o snapshot como uma sincronização faria. */
async function sincronizar(
  documentos: Documento[],
  autorias: Record<string, { autor: string; dataModificacao: string }> = {}
): Promise<void> {
  await banco.sincronizarInventario(documentos);
  for (const documento of documentos) {
    const autoria = autorias[documento.id];
    if (autoria) {
      await banco.gravarAutoria(documento.id, {
        ...autoria,
        versaoAutoria: documento.versaoConteudo ?? null
      });
    }
  }
}

describe('busca servida do snapshot', () => {
  it('não consulta a fonte quando há snapshot', async () => {
    await sincronizar(INVENTARIO, {
      'github:org/repo:ata-2026-08.md': { autor: 'gabi', dataModificacao: '2026-08-10T00:00:00Z' },
      'github:org/repo:plano.md': { autor: 'ana', dataModificacao: '2026-07-01T00:00:00Z' },
      'github:org/repo:requisitos.md': { autor: 'ze', dataModificacao: '2026-06-01T00:00:00Z' }
    });
    const inventariar = vi.mocked(github.buscarDocumentos);
    const autoria = vi.mocked(github.autoriaDoArquivo);
    inventariar.mockClear();
    autoria.mockClear();

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'ata' });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata-2026-08.md']);
    expect(inventariar).not.toHaveBeenCalled();
    expect(autoria).not.toHaveBeenCalled();
  });

  it('documento novo na fonte só aparece depois de sincronizar', async () => {
    await sincronizar(INVENTARIO);

    const antes = await servico.buscar({ ...FILTROS_PADRAO, termo: 'orcamento' });
    expect(antes.documentos).toHaveLength(0);

    await sincronizar([...INVENTARIO, doc('orcamento.md')]);

    const depois = await servico.buscar({ ...FILTROS_PADRAO, termo: 'orcamento' });
    expect(depois.documentos.map((d) => d.nome)).toEqual(['orcamento.md']);
  });

  it('usa a autoria gravada no snapshot para casar o termo', async () => {
    await sincronizar(INVENTARIO, {
      'github:org/repo:plano.md': { autor: 'mariana', dataModificacao: '2026-07-01T00:00:00Z' }
    });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'mariana' });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['plano.md']);
  });

  it('usa a data real do snapshot no filtro de período', async () => {
    await sincronizar(INVENTARIO, {
      'github:org/repo:ata-2026-08.md': { autor: 'gabi', dataModificacao: '2026-08-10T00:00:00Z' },
      'github:org/repo:plano.md': { autor: 'ana', dataModificacao: '2026-07-01T00:00:00Z' },
      'github:org/repo:requisitos.md': { autor: 'ze', dataModificacao: '2026-06-01T00:00:00Z' }
    });

    const resultado = await servico.buscar({
      ...FILTROS_PADRAO,
      dataInicial: '2026-08-01',
      dataFinal: '2026-08-31'
    });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata-2026-08.md']);
  });

  it('avisa sobre documentos ainda sem autoria e o aviso some quando todos têm', async () => {
    await sincronizar(INVENTARIO, {
      'github:org/repo:ata-2026-08.md': { autor: 'gabi', dataModificacao: '2026-08-10T00:00:00Z' }
    });

    // "plano" ainda está pendente de autoria, mas casa pelo nome.
    const parcial = await servico.buscar({ ...FILTROS_PADRAO, termo: 'plano' });
    expect(parcial.documentos.map((d) => d.nome)).toEqual(['plano.md']);
    expect(parcial.avisos.some((a) => a.mensagem.includes('sem autoria sincronizada'))).toBe(true);

    await sincronizar(INVENTARIO, {
      'github:org/repo:ata-2026-08.md': { autor: 'gabi', dataModificacao: '2026-08-10T00:00:00Z' },
      'github:org/repo:plano.md': { autor: 'ana', dataModificacao: '2026-07-01T00:00:00Z' },
      'github:org/repo:requisitos.md': { autor: 'ze', dataModificacao: '2026-06-01T00:00:00Z' }
    });

    const total = await servico.buscar({ ...FILTROS_PADRAO, termo: 'plano' });
    expect(total.avisos.some((a) => a.mensagem.includes('sem autoria sincronizada'))).toBe(false);
  });
});

describe('sem snapshot', () => {
  it('cai na consulta ao vivo', async () => {
    const inventariar = vi.mocked(github.buscarDocumentos);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'ata' });

    expect(inventariar).toHaveBeenCalled();
    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata-2026-08.md']);
  });
});
