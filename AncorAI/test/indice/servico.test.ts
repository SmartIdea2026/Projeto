// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Indexação de fundo: registro no índice e classificação por IA.
 *
 * O eixo aqui é o mesmo da ingestão de conteúdo — cada submissão à LLM custa
 * cota, então o que importa é sobretudo **quando o sistema não classifica**:
 * documento já classificado, documento sem texto, cota estourada, indexação
 * interrompida. A classificação nunca baixa texto: ela lê o que a ingestão já
 * guardou, e desiste sem erro quando não há nada extraído.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn((chave: string) => (chave === 'gemini.chave' ? 'chave-ia' : 'token-gh'))
}));

const github = await import('../../src/main/fontes/github');
const banco = await import('../../src/main/banco/repositorio');
const gemini = await import('../../src/main/llm/gemini');
const { indexarAcervo, cancelarIndexacao, progressoIndexacao } = await import(
  '../../src/main/indice/servico'
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

function inventario(quantidade: number): Documento[] {
  return Array.from({ length: quantidade }, (_, i) =>
    documento({
      id: `github:org/repo:doc${i}.md`,
      nome: `doc${i}.md`,
      versaoConteudo: `sha-${i}`
    })
  );
}

const PRODUZIDO = {
  tipo: 'Ata',
  assuntos: ['planejamento'],
  etiquetas: ['sprint', 'reunião']
};

async function comTextoExtraido(id: string, versao = 'sha-1', texto = 'Conteúdo do documento.') {
  await banco.gravarConteudo({
    _id: id,
    versaoConteudo: versao,
    estado: 'extraido',
    texto,
    truncado: false
  });
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-indice-'));
  await banco.abrirBanco(diretorio);
  vi.spyOn(gemini, 'classificar').mockResolvedValue(PRODUZIDO);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('registro no índice', () => {
  it('registra os documentos do inventário, sem gravar texto', async () => {
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: [documento()],
      aviso: null
    });

    await indexarAcervo();

    const registro = await banco.lerIndice(documento().id);
    expect(registro).toMatchObject({ nome: 'ata.md', fonte: 'github', link: documento().link });
    expect(registro).not.toHaveProperty('texto');
  });
});

describe('classificação', () => {
  it('classifica um documento com texto já armazenado, sem requisitar a fonte de novo', async () => {
    const doc = documento();
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: [doc], aviso: null });
    await comTextoExtraido(doc.id, 'sha-1');
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const progresso = await indexarAcervo();

    expect(baixar).not.toHaveBeenCalled();
    expect(progresso.classificados).toBe(1);
    const registro = await banco.lerIndice(doc.id);
    expect(registro?.tipo).toBe('Ata');
    expect(registro?.etiquetas).toEqual(['sprint', 'reunião']);
  });

  it('não reclassifica um documento já classificado', async () => {
    const doc = documento();
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: [doc], aviso: null });
    await comTextoExtraido(doc.id);

    await indexarAcervo();
    expect(gemini.classificar).toHaveBeenCalledTimes(1);

    const segunda = await indexarAcervo();

    expect(gemini.classificar).toHaveBeenCalledTimes(1);
    expect(segunda.reaproveitados).toBe(1);
    expect(segunda.classificados).toBe(0);
  });

  it('reclassifica quando a identidade de conteúdo muda', async () => {
    const doc = documento({ versaoConteudo: 'sha-1' });
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValueOnce({ dados: [doc], aviso: null });
    await comTextoExtraido(doc.id, 'sha-1');
    await indexarAcervo();

    const docNovo = documento({ versaoConteudo: 'sha-2' });
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValueOnce({
      dados: [docNovo],
      aviso: null
    });
    await comTextoExtraido(doc.id, 'sha-2', 'Texto novo.');

    const segunda = await indexarAcervo();

    expect(gemini.classificar).toHaveBeenCalledTimes(2);
    expect(segunda.classificados).toBe(1);
  });

  it('não fica sem classificação por engano quando a data muda sem versão de conteúdo', async () => {
    // Documento vindo dos commits: sem versaoConteudo. A data mudar sozinha
    // não pode disparar reclassificação, ou o acervo inteiro de um repositório
    // seria marcado desatualizado a cada push nele.
    const semVersao = documento({ versaoConteudo: undefined });
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: [semVersao],
      aviso: null
    });
    await comTextoExtraido(semVersao.id);

    await indexarAcervo();
    const segunda = await indexarAcervo();

    expect(gemini.classificar).toHaveBeenCalledTimes(1);
    expect(segunda.reaproveitados).toBe(1);
  });
});

describe('documentos sem texto disponível', () => {
  it.each([
    ['sem-texto', {}],
    ['excedente', { motivo: 'O arquivo excede o limite de 2 MB por documento.' }],
    ['falha', { motivo: 'Não foi possível extrair o texto.' }]
  ] as const)('não classifica um documento em estado "%s"', async (estado, extras) => {
    const doc = documento();
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: [doc], aviso: null });
    await banco.gravarConteudo({
      _id: doc.id,
      versaoConteudo: 'sha-1',
      estado,
      texto: '',
      truncado: false,
      ...extras
    });

    const progresso = await indexarAcervo();

    expect(progresso.semTexto).toBe(1);
    expect(progresso.classificados).toBe(0);
    expect(gemini.classificar).not.toHaveBeenCalled();
  });

  it('trata como sem texto um documento cujo conteúdo ainda não foi ingerido', async () => {
    const doc = documento();
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: [doc], aviso: null });

    const progresso = await indexarAcervo();

    expect(progresso.semTexto).toBe(1);
    expect(progresso.falhas).toBe(0);
  });
});

describe('indexação de segundo plano', () => {
  it('nunca mantém duas submissões simultâneas à LLM', async () => {
    let simultaneas = 0;
    let pico = 0;
    const docs = inventario(4);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    vi.mocked(gemini.classificar).mockImplementation(async () => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await new Promise((r) => setTimeout(r, 5));
      simultaneas -= 1;
      return PRODUZIDO;
    });

    const progresso = await indexarAcervo();

    expect(pico).toBe(1);
    expect(progresso.classificados).toBe(4);
  });

  it('retomada processa só o que falta', async () => {
    const docs = inventario(3);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    await indexarAcervo();
    expect(gemini.classificar).toHaveBeenCalledTimes(3);

    const segunda = await indexarAcervo();

    expect(gemini.classificar).toHaveBeenCalledTimes(3);
    expect(segunda.reaproveitados).toBe(3);
    expect(segunda.classificados).toBe(0);
  });

  it('uma classificação com falha não interrompe as demais', async () => {
    const docs = inventario(3);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    vi.mocked(gemini.classificar)
      .mockResolvedValueOnce(PRODUZIDO)
      .mockRejectedValueOnce(new gemini.ErroLLM('falha', 'Resposta ilegível.'))
      .mockResolvedValueOnce(PRODUZIDO);

    const progresso = await indexarAcervo();

    expect(progresso.classificados).toBe(2);
    expect(progresso.falhas).toBe(1);
    expect(progresso.suspensa).toBe(false);
  });

  it('suspende sem perda quando a cota da LLM se esgota', async () => {
    const docs = inventario(3);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    vi.mocked(gemini.classificar)
      .mockResolvedValueOnce(PRODUZIDO)
      .mockRejectedValue(new gemini.ErroLLM('cota-excedida', 'Limite atingido.'));

    const progresso = await indexarAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(progresso.motivoSuspensao).toBe('Limite atingido.');
    expect(progresso.classificados).toBe(1);

    // O que já foi classificado continua no índice.
    const registro = await banco.lerIndice(docs[0]!.id);
    expect(registro?.tipo).toBe('Ata');
  });

  it('interrompe sem perder o que já foi classificado', async () => {
    const docs = inventario(3);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    vi.mocked(gemini.classificar).mockImplementation(async () => {
      cancelarIndexacao();
      return PRODUZIDO;
    });

    const progresso = await indexarAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(progresso.motivoSuspensao).toContain('interrompida');
    expect(progresso.classificados).toBe(1);
  });

  it('suspende sem tentar nada quando não há credencial do GitHub', async () => {
    const cofre = await import('../../src/main/credenciais/cofre');
    vi.mocked(cofre.obter).mockReturnValueOnce(undefined as unknown as string);
    const inventariar = vi.spyOn(github, 'buscarDocumentos');

    const progresso = await indexarAcervo();

    expect(progresso.suspensa).toBe(true);
    expect(inventariar).not.toHaveBeenCalled();
  });

  it('mantém o progresso ao vivo consultável durante a passagem', async () => {
    const docs = inventario(2);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    for (const doc of docs) await comTextoExtraido(doc.id, doc.versaoConteudo);

    let vistoEmAndamento = false;
    vi.mocked(gemini.classificar).mockImplementation(async () => {
      if (progressoIndexacao().emAndamento) vistoEmAndamento = true;
      return PRODUZIDO;
    });

    const progresso = await indexarAcervo();

    expect(vistoEmAndamento).toBe(true);
    expect(progresso.emAndamento).toBe(false);
    expect(progressoIndexacao().emAndamento).toBe(false);
  });
});

describe('prioridade da busca e do resumo sobre a indexação', () => {
  it('a indexação espera o trabalho interativo, que não espera por ela', async () => {
    const ordem: string[] = [];
    let liberar: () => void = () => {};
    const interativaEmCurso = new Promise<void>((r) => {
      liberar = r;
    });

    const docs = inventario(1);
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: docs, aviso: null });
    await comTextoExtraido(docs[0]!.id, docs[0]!.versaoConteudo);
    vi.mocked(gemini.classificar).mockImplementation(async () => {
      ordem.push('indexacao');
      return PRODUZIDO;
    });

    const interativa = comoInterativa(async () => {
      await interativaEmCurso;
      ordem.push('interativa');
      return 'ok';
    });

    const indexacao = indexarAcervo();

    await new Promise((r) => setTimeout(r, 20));
    expect(ordem).toEqual([]);

    liberar();
    await expect(interativa).resolves.toBe('ok');
    await indexacao;

    expect(ordem).toEqual(['interativa', 'indexacao']);
  });
});
