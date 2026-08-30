// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '../../src/main/fontes/comum';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * A busca não depende do conteúdo, e a recíproca não é verdadeira.
 *
 * Este arquivo existe para que a independência seja verificada, e não apenas
 * suposta. Ela é fácil de perder: basta alguém, mais tarde, resolver "melhorar"
 * a busca fazendo-a garantir o texto dos resultados que apresenta. A conta de
 * cota mudaria de uma requisição por repositório para uma por arquivo, e o
 * usuário passaria a esperar por download em toda consulta.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste')
}));

const github = await import('../../src/main/fontes/github');
const banco = await import('../../src/main/banco/repositorio');
const servico = await import('../../src/main/busca/servico');

let diretorio: string;

const inventario: Documento[] = [
  {
    id: 'github:org/repo:ata.md',
    nome: 'ata.md',
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: 'https://github.com/org/repo/blob/main/ata.md',
    caminho: 'ata.md',
    repositorio: 'org/repo',
    versaoConteudo: 'sha-1',
    tamanho: 100
  },
  {
    id: 'github:org/repo:manual.pdf',
    nome: 'manual.pdf',
    extensao: 'pdf',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: 'https://github.com/org/repo/blob/main/manual.pdf',
    caminho: 'manual.pdf',
    repositorio: 'org/repo',
    versaoConteudo: 'sha-2',
    tamanho: 100
  }
];

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-independencia-'));
  await banco.abrirBanco(diretorio);
  vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
    dados: inventario,
    aviso: null
  });
  vi.spyOn(github, 'autoriaDoArquivo').mockResolvedValue(null);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('a busca não obtém conteúdo', () => {
  it('não faz requisição de conteúdo alguma para montar os resultados', async () => {
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'manual' });

    expect(resultado.documentos).toHaveLength(1);
    expect(baixar).not.toHaveBeenCalled();
  });

  it('não carrega a coleção de conteúdo em memória para buscar', async () => {
    await servico.buscar({ ...FILTROS_PADRAO, termo: 'ata' });

    expect(banco.conteudoCarregado()).toBe(false);
  });
});

describe('falha de conteúdo não afeta o inventário', () => {
  it('o documento continua nos resultados quando a obtenção do conteúdo falha', async () => {
    const { ingerirAcervo } = await import('../../src/main/conteudo/ingestao');
    vi.spyOn(github, 'conteudoDoArquivo').mockRejectedValue(
      new ErroFonte('github', 'O GitHub respondeu com o código 404.')
    );

    const progresso = await ingerirAcervo();
    expect(progresso.falhas).toBe(2);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: '' });

    expect(resultado.documentos.map((d) => d.nome).sort()).toEqual([
      'ata.md',
      'manual.pdf'
    ]);
    expect(resultado.falhas).toHaveLength(0);
  });

  it('o documento acima do limite de tamanho continua nos resultados', async () => {
    const { ingerirDocumento } = await import('../../src/main/conteudo/ingestao');
    const enorme: Documento = {
      ...(inventario[1] as Documento),
      tamanho: 50 * 1024 * 1024
    };
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const registro = await ingerirDocumento(enorme, 'tok');
    expect(registro?.estado).toBe('excedente');
    expect(baixar).not.toHaveBeenCalled();

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'manual' });

    expect(resultado.documentos).toHaveLength(1);
    expect(resultado.documentos[0]?.link).toBe(enorme.link);
  });

  it('o documento continua sendo aberto por redirecionamento, com texto guardado', async () => {
    const { ingerirDocumento } = await import('../../src/main/conteudo/ingestao');
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(
      new TextEncoder().encode('Texto guardado da ata').buffer as ArrayBuffer
    );
    await ingerirDocumento(inventario[0] as Documento, 'tok');

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'ata' });
    const apresentado = resultado.documentos[0];

    // O que a busca entrega continua sendo o link da fonte, e nada do texto.
    expect(apresentado?.link).toBe(inventario[0]?.link);
    expect(JSON.stringify(apresentado)).not.toContain('Texto guardado');
  });

  it('o documento continua nos resultados quando seu formato não é lido', async () => {
    const { ingerirDocumento } = await import('../../src/main/conteudo/ingestao');
    const planilha: Documento = {
      ...(inventario[0] as Documento),
      id: 'github:org/repo:custos.xlsx',
      nome: 'custos.xlsx',
      extensao: 'xlsx'
    };
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(new ArrayBuffer(4));
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: [...inventario, planilha],
      aviso: null
    });

    const registro = await ingerirDocumento(planilha, 'tok');
    expect(registro?.estado).toBe('sem-texto');

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'custos' });

    expect(resultado.documentos).toHaveLength(1);
    expect(resultado.documentos[0]?.nome).toBe('custos.xlsx');
  });
});
