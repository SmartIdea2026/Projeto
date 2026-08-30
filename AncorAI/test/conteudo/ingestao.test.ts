// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '../../src/main/fontes/comum';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Ingestão de conteúdo.
 *
 * O eixo é o custo: cada download consome cota do GitHub, a mesma de que a
 * busca depende. Por isso o que se verifica aqui é sobretudo **quando o
 * sistema não baixa** — quando o registro está vigente, quando o arquivo é
 * grande demais, quando a cota acabou e quando o usuário está esperando uma
 * busca.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste')
}));

const github = await import('../../src/main/fontes/github');
const banco = await import('../../src/main/banco/repositorio');
const { ingerirAcervo, ingerirDocumento, textoDoDocumento } = await import(
  '../../src/main/conteudo/ingestao'
);
const { comoInterativa } = await import('../../src/main/conteudo/prioridade');

let diretorio: string;

function documento(extras: Partial<Documento> = {}): Documento {
  return {
    id: 'github:org/repo:ata.md',
    nome: 'ata.md',
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: 'https://github.com/org/repo/blob/main/ata.md',
    caminho: 'ata.md',
    repositorio: 'org/repo',
    versaoConteudo: 'sha-1',
    tamanho: 100,
    ...extras
  };
}

function bytesDe(texto: string): ArrayBuffer {
  return new TextEncoder().encode(texto).buffer as ArrayBuffer;
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-ingestao-'));
  await banco.abrirBanco(diretorio);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('revalidação pelo sha do blob', () => {
  it('reaproveita o texto guardado quando o sha não mudou, sem baixar', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValue(bytesDe('Conteúdo original'));

    await ingerirDocumento(documento(), 'tok');
    expect(baixar).toHaveBeenCalledTimes(1);

    const registro = await ingerirDocumento(documento(), 'tok');

    expect(baixar).toHaveBeenCalledTimes(1);
    expect(registro?.texto).toBe('Conteúdo original');
  });

  it('baixa de novo e substitui o texto quando o sha muda', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValueOnce(bytesDe('Versão antiga'))
      .mockResolvedValueOnce(bytesDe('Versão nova'));

    await ingerirDocumento(documento({ versaoConteudo: 'sha-1' }), 'tok');
    const registro = await ingerirDocumento(documento({ versaoConteudo: 'sha-2' }), 'tok');

    expect(baixar).toHaveBeenCalledTimes(2);
    expect(registro?.texto).toBe('Versão nova');
    expect(registro?.versaoConteudo).toBe('sha-2');

    const guardado = await banco.lerConteudo(documento().id);
    expect(guardado?.texto).toBe('Versão nova');
  });

  // A data do inventário é o `pushed_at` do repositório, igual para todos os
  // arquivos: se a revalidação olhasse a data, um push em qualquer arquivo
  // faria o acervo inteiro ser baixado de novo.
  it('não baixa de novo quando só a data mudou e o conteúdo é o mesmo', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValue(bytesDe('Conteúdo estável'));

    await ingerirDocumento(documento(), 'tok');
    await ingerirDocumento(
      documento({ dataModificacao: '2026-09-30T23:59:00Z' }),
      'tok'
    );

    expect(baixar).toHaveBeenCalledTimes(1);
  });
});

describe('descarte por tamanho', () => {
  it('não faz requisição alguma para um arquivo acima do limite', async () => {
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const registro = await ingerirDocumento(
      documento({ tamanho: 5 * 1024 * 1024 }),
      'tok'
    );

    expect(baixar).not.toHaveBeenCalled();
    expect(registro?.estado).toBe('excedente');
    expect(registro?.motivo).toContain('excede o limite');
  });

  it('grava o excedente, para não reconsiderá-lo a cada varredura', async () => {
    await ingerirDocumento(documento({ tamanho: 5 * 1024 * 1024 }), 'tok');

    const guardado = await banco.lerConteudo(documento().id);
    expect(guardado?.estado).toBe('excedente');
  });
});

describe('estados negativos também são definitivos', () => {
  // A cláusula é do cenário "Documento sem texto útil": o sistema não repete a
  // extração enquanto o documento não mudar na fonte. Sem isto, todo PDF
  // digitalizado do acervo seria baixado e processado de novo a cada varredura
  // para chegar sempre à mesma conclusão.
  it('não baixa de novo um documento registrado como sem texto', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValue(bytesDe('   '));

    const primeiro = await ingerirDocumento(documento(), 'tok');
    expect(primeiro?.estado).toBe('sem-texto');

    await ingerirDocumento(documento(), 'tok');

    expect(baixar).toHaveBeenCalledTimes(1);
  });

  it('não reconsidera um documento registrado como excedente', async () => {
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');
    const grande = documento({ tamanho: 5 * 1024 * 1024 });

    await ingerirDocumento(grande, 'tok');
    const segundo = await ingerirDocumento(grande, 'tok');

    expect(baixar).not.toHaveBeenCalled();
    expect(segundo?.estado).toBe('excedente');
  });

  it('volta a tentar quando o documento muda na fonte', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValueOnce(bytesDe('   '))
      .mockResolvedValueOnce(bytesDe('Agora tem texto'));

    await ingerirDocumento(documento({ versaoConteudo: 'sha-1' }), 'tok');
    const segundo = await ingerirDocumento(documento({ versaoConteudo: 'sha-2' }), 'tok');

    expect(baixar).toHaveBeenCalledTimes(2);
    expect(segundo?.estado).toBe('extraido');
  });
});

describe('ingestão sob demanda', () => {
  it('obtém e entrega o texto de um documento ainda não ingerido', async () => {
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(bytesDe('Texto do documento'));

    expect(await textoDoDocumento(documento())).toBe('Texto do documento');
  });

  it('devolve texto vazio, e não erro, quando a obtenção falha', async () => {
    vi.spyOn(github, 'conteudoDoArquivo').mockRejectedValue(
      new ErroFonte('github', 'Não foi possível alcançar o GitHub.')
    );

    expect(await textoDoDocumento(documento())).toBe('');
  });

  it('devolve texto vazio para documento sem texto extraível', async () => {
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(bytesDe('planilha'));

    expect(await textoDoDocumento(documento({ extensao: 'xlsx' }))).toBe('');
  });
});

describe('ingestão de segundo plano', () => {
  function inventario(quantidade: number): Documento[] {
    return Array.from({ length: quantidade }, (_, i) =>
      documento({
        id: `github:org/repo:doc${i}.md`,
        nome: `doc${i}.md`,
        versaoConteudo: `sha-${i}`
      })
    );
  }

  it('nunca mantém duas obtenções simultâneas', async () => {
    let simultaneas = 0;
    let pico = 0;

    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(6),
      aviso: null
    });
    vi.spyOn(github, 'conteudoDoArquivo').mockImplementation(async () => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await new Promise((r) => setTimeout(r, 5));
      simultaneas -= 1;
      return bytesDe('texto');
    });

    const progresso = await ingerirAcervo();

    expect(pico).toBe(1);
    expect(progresso.ingeridos).toBe(6);
  });

  it('retomada processa só o que falta', async () => {
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(4),
      aviso: null
    });
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValue(bytesDe('texto'));

    await ingerirAcervo();
    expect(baixar).toHaveBeenCalledTimes(4);

    const segunda = await ingerirAcervo();

    expect(baixar).toHaveBeenCalledTimes(4);
    expect(segunda.reaproveitados).toBe(4);
    expect(segunda.ingeridos).toBe(0);
  });

  it('um documento ilegível não interrompe os demais', async () => {
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(3),
      aviso: null
    });
    vi.spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValueOnce(bytesDe('primeiro'))
      .mockRejectedValueOnce(new ErroFonte('github', 'O GitHub respondeu com o código 404.'))
      .mockResolvedValueOnce(bytesDe('terceiro'));

    const progresso = await ingerirAcervo();

    expect(progresso.ingeridos).toBe(2);
    expect(progresso.falhas).toBe(1);
    expect(progresso.suspensa).toBe(false);
  });

  it('suspende sem perda quando a cota do GitHub acaba', async () => {
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(5),
      aviso: null
    });
    vi.spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValueOnce(bytesDe('primeiro'))
      .mockResolvedValueOnce(bytesDe('segundo'))
      .mockRejectedValue(
        new ErroFonte('github', 'O limite de requisições do GitHub foi atingido.', true)
      );

    const progresso = await ingerirAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(progresso.motivoSuspensao).toContain('limite de requisições');
    expect(progresso.ingeridos).toBe(2);

    // O que já foi ingerido continua no banco.
    expect(await banco.lerConteudo('github:org/repo:doc0.md')).not.toBeNull();
  });

  it('descarta o texto de documentos que saíram do inventário', async () => {
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(bytesDe('texto'));

    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(3),
      aviso: null
    });
    await ingerirAcervo();
    expect(await banco.lerConteudo('github:org/repo:doc2.md')).not.toBeNull();

    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(2),
      aviso: null
    });
    await ingerirAcervo();

    expect(await banco.lerConteudo('github:org/repo:doc2.md')).toBeNull();
    expect(await banco.lerConteudo('github:org/repo:doc0.md')).not.toBeNull();
  });

  it('suspende ao atingir o teto de texto armazenado', async () => {
    vi.spyOn(banco, 'totalDeCaracteres').mockResolvedValue(60 * 1024 * 1024);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: inventario(3),
      aviso: null
    });
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const progresso = await ingerirAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(progresso.motivoSuspensao).toContain('limite de texto armazenado');
    expect(baixar).not.toHaveBeenCalled();
  });

  it('suspende sem tentar nada quando não há credencial', async () => {
    const cofre = await import('../../src/main/credenciais/cofre');
    vi.mocked(cofre.obter).mockReturnValueOnce(undefined as unknown as string);
    const inventariar = vi.spyOn(github, 'buscarDocumentos');

    const progresso = await ingerirAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(inventariar).not.toHaveBeenCalled();
  });
});

describe('prioridade da busca sobre a ingestão', () => {
  it('a ingestão espera a busca, e a busca não espera a ingestão', async () => {
    const ordem: string[] = [];
    let liberarBusca: () => void = () => {};
    const buscaEmCurso = new Promise<void>((r) => {
      liberarBusca = r;
    });

    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: [documento()],
      aviso: null
    });
    vi.spyOn(github, 'conteudoDoArquivo').mockImplementation(async () => {
      ordem.push('ingestao');
      return bytesDe('texto');
    });

    // Uma busca começa e ainda não terminou.
    const busca = comoInterativa(async () => {
      await buscaEmCurso;
      ordem.push('busca');
      return 'resultado';
    });

    const ingestao = ingerirAcervo();

    // Enquanto a busca não termina, a ingestão não toca a rede.
    await new Promise((r) => setTimeout(r, 20));
    expect(ordem).toEqual([]);

    liberarBusca();
    await expect(busca).resolves.toBe('resultado');
    await ingestao;

    expect(ordem).toEqual(['busca', 'ingestao']);
  });
});
