// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Geração de resumos no processo principal.
 *
 * O que se verifica aqui é sobretudo **quando o sistema não chama a LLM** —
 * sem consentimento, sem chave, com resumo vigente já gravado, e para
 * documentos sem texto. Cada chamada evitada é cota preservada de um plano
 * gratuito cujo limite é por minuto.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn((chave: string) => (chave === 'gemini.chave' ? 'chave-ia' : 'token-gh')),
  definir: vi.fn(),
  remover: vi.fn(),
  existe: vi.fn(() => true)
}));

const banco = await import('../../src/main/banco/repositorio');
const github = await import('../../src/main/fontes/github');
const gemini = await import('../../src/main/llm/gemini');
const instrucao = await import('../../src/main/llm/instrucao');
const resumos = await import('../../src/main/llm/resumos');

let diretorio: string;

const documento: Documento = {
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
};

const PRODUZIDO = {
  resumo: 'Ata da reunião de planejamento.',
  categoria: 'Ata',
  assuntos: ['planejamento', 'sprint'],
  destaques: ['Decidiu-se adotar NoSQL']
};

async function comTexto(versao = 'sha-1', texto = 'Conteúdo da ata.') {
  await banco.gravarConteudo({
    _id: documento.id,
    versaoConteudo: versao,
    estado: 'extraido',
    texto,
    truncado: false
  });
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-resumos-'));
  await banco.abrirBanco(diretorio);
  await resumos.registrarConsentimento(true);

  // A instrução vem do arquivo versionado no repositório, e não do código.
  instrucao.inicializarInstrucao(join(__dirname, '../..'));
  instrucao.recarregarInstrucao();

  vi.spyOn(gemini, 'resumir').mockResolvedValue(PRODUZIDO);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('consentimento', () => {
  it('não submete nada antes da autorização', async () => {
    await resumos.registrarConsentimento(false);
    await comTexto();

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(resposta.motivo).toBe('sem-consentimento');
    expect(gemini.resumir).not.toHaveBeenCalled();
  });

  it('passa a submeter depois de autorizado', async () => {
    await comTexto();

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(resposta.resumo?.resumo).toBe(PRODUZIDO.resumo);
    expect(gemini.resumir).toHaveBeenCalledTimes(1);
  });
});

describe('reuso e invalidação', () => {
  it('reaproveita o resumo gravado, sem nova submissão', async () => {
    await comTexto();
    await resumos.resumoDoDocumento(documento);
    expect(gemini.resumir).toHaveBeenCalledTimes(1);

    const segunda = await resumos.resumoDoDocumento(documento);

    expect(gemini.resumir).toHaveBeenCalledTimes(1);
    expect(segunda.resumo?.resumo).toBe(PRODUZIDO.resumo);
  });

  it('regera quando o usuário pede, mesmo havendo resumo gravado', async () => {
    await comTexto();
    await resumos.resumoDoDocumento(documento);

    await resumos.resumoDoDocumento(documento, true);

    expect(gemini.resumir).toHaveBeenCalledTimes(2);
  });

  // O defeito que este teste previne é silencioso e plausível: `$set` só toca
  // os campos que nomeia, então sem limpeza o resumo antigo sobreviveria ao
  // texto novo e passaria a descrever outro documento.
  it('descarta o resumo quando o conteúdo é regravado com versão diferente', async () => {
    await comTexto('sha-1');
    await resumos.resumoDoDocumento(documento);
    expect((await banco.lerConteudo(documento.id))?.resumo).toBeTruthy();

    await comTexto('sha-2', 'Texto completamente novo.');

    const registro = await banco.lerConteudo(documento.id);
    expect(registro?.texto).toBe('Texto completamente novo.');
    expect(registro?.resumo).toBeUndefined();
    expect(registro?.resumoEm).toBeUndefined();
  });

  it('preserva o resumo quando o conteúdo é regravado com a mesma versão', async () => {
    await comTexto('sha-1');
    await resumos.resumoDoDocumento(documento);

    await comTexto('sha-1');

    expect((await banco.lerConteudo(documento.id))?.resumo).toBe(PRODUZIDO.resumo);
  });

  it('assinala como desatualizado quando a fonte já mostra outra versão', async () => {
    await comTexto('sha-1');
    await resumos.resumoDoDocumento(documento);

    const gravado = await resumos.resumoGravado({ ...documento, versaoConteudo: 'sha-9' });

    expect(gravado?.desatualizado).toBe(true);
  });
});

describe('documentos sem texto', () => {
  it('não submete documento registrado como sem texto', async () => {
    await banco.gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'sha-1',
      estado: 'sem-texto',
      texto: '',
      truncado: false,
      motivo: 'Planilhas não são lidas nesta versão.'
    });

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(resposta.motivo).toBe('sem-texto');
    expect(resposta.mensagem).toContain('Planilhas');
    expect(gemini.resumir).not.toHaveBeenCalled();
  });

  it('não submete documento excedente', async () => {
    await banco.gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'sha-1',
      estado: 'excedente',
      texto: '',
      truncado: false,
      motivo: 'O arquivo excede o limite de 2 MB por documento.'
    });

    expect((await resumos.resumoDoDocumento(documento)).motivo).toBe('sem-texto');
    expect(gemini.resumir).not.toHaveBeenCalled();
  });

  it('propaga a marca de texto truncado para o painel', async () => {
    await banco.gravarConteudo({
      _id: documento.id,
      versaoConteudo: 'sha-1',
      estado: 'extraido',
      texto: 'Primeira parte apenas.',
      truncado: true
    });

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(resposta.resumo?.baseTruncada).toBe(true);
  });
});

describe('obtenção do texto', () => {
  it('não requisita a fonte quando o texto já está armazenado', async () => {
    await comTexto();
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    await resumos.resumoDoDocumento(documento);

    expect(baixar).not.toHaveBeenCalled();
  });

  it('obtém o texto na fonte quando ainda não há', async () => {
    const baixar = vi
      .spyOn(github, 'conteudoDoArquivo')
      .mockResolvedValue(new TextEncoder().encode('Texto vindo da fonte.').buffer as ArrayBuffer);

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(baixar).toHaveBeenCalledTimes(1);
    expect(resposta.resumo).not.toBeNull();
  });
});

describe('documentos vindos dos commits, sem identidade de conteúdo', () => {
  /*
   * A tela inicial mostra os documentos recentes, que vêm dos commits e não da
   * árvore Git. Enquanto eles chegavam sem `versaoConteudo`, NENHUM documento
   * dessa tela podia ser resumido — e o texto muitas vezes já estava no banco,
   * ingerido pela varredura de fundo, sendo recusado por não haver como
   * confirmar que era o mais recente.
   */
  const semVersao = { ...documento, versaoConteudo: undefined };

  it('aproveita o texto já guardado quando a versão não vem da fonte', async () => {
    await comTexto('sha-1', 'Texto que a varredura de fundo já ingeriu.');
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    const resposta = await resumos.resumoDoDocumento(semVersao);

    expect(resposta.motivo).toBeUndefined();
    expect(resposta.resumo?.resumo).toBe(PRODUZIDO.resumo);
    expect(baixar).not.toHaveBeenCalled();
  });

  it('o preparo reporta pronto, e não "sem texto"', async () => {
    await comTexto();

    expect(await resumos.prepararConteudo(semVersao)).toEqual({
      pronto: true,
      temResumo: false
    });
  });

  it('não afirma que o resumo está desatualizado quando não há como saber', async () => {
    await comTexto();
    await resumos.resumoDoDocumento(documento);

    const gravado = await resumos.resumoGravado(semVersao);

    // Sem versão para comparar, dizer "desatualizado" seria afirmar algo que o
    // sistema não sabe. Dizer nada é o correto.
    expect(gravado?.desatualizado).toBe(false);
  });
});

describe('preparo em duas etapas', () => {
  it('informa que está pronto e se já existe resumo', async () => {
    await comTexto();

    expect(await resumos.prepararConteudo(documento)).toEqual({
      pronto: true,
      temResumo: false
    });

    await resumos.resumoDoDocumento(documento);

    expect(await resumos.prepararConteudo(documento)).toEqual({
      pronto: true,
      temResumo: true
    });
  });

  it('não devolve texto algum, apenas situação', async () => {
    await comTexto('sha-1', 'SEGREDO-DO-DOCUMENTO');

    const preparo = await resumos.prepararConteudo(documento);

    expect(JSON.stringify(preparo)).not.toContain('SEGREDO-DO-DOCUMENTO');
  });
});

describe('instrução versionada muda o que é enviado', () => {
  it('aplica a instrução nova depois de o arquivo mudar', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');

    const raiz = mkdtempSync(join(tmpdir(), 'ancorai-instrucao-'));
    mkdirSync(join(raiz, 'instrucoes'));
    writeFileSync(join(raiz, 'instrucoes', 'resumo.md'), 'PRIMEIRA VERSÃO');
    instrucao.inicializarInstrucao(raiz);

    await comTexto();
    await resumos.resumoDoDocumento(documento);
    expect(vi.mocked(gemini.resumir).mock.calls[0]?.[1]).toBe('PRIMEIRA VERSÃO');

    // A equipe revisa o arquivo em Pull Request; a próxima geração usa o texto
    // novo, sem recompilar nada.
    writeFileSync(join(raiz, 'instrucoes', 'resumo.md'), 'SEGUNDA VERSÃO');
    instrucao.recarregarInstrucao();

    await resumos.resumoDoDocumento(documento, true);
    expect(vi.mocked(gemini.resumir).mock.calls[1]?.[1]).toBe('SEGUNDA VERSÃO');
  });

  it('falha de forma explícita quando o arquivo não existe', async () => {
    instrucao.inicializarInstrucao('/caminho/que/nao/existe');
    instrucao.recarregarInstrucao();
    await comTexto();

    const resposta = await resumos.resumoDoDocumento(documento);

    // Sem instrução não se submete nada: gerar com prompt vazio produziria um
    // resumo qualquer, e gastaria cota para isso.
    expect(resposta.resumo).toBeNull();
    expect(gemini.resumir).not.toHaveBeenCalled();
  });
});

describe('fila de submissões', () => {
  it('nunca mantém duas submissões simultâneas', async () => {
    let simultaneas = 0;
    let pico = 0;
    vi.mocked(gemini.resumir).mockImplementation(async () => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await new Promise((r) => setTimeout(r, 5));
      simultaneas -= 1;
      return PRODUZIDO;
    });

    const documentos = [1, 2, 3, 4].map((i) => ({
      ...documento,
      id: `github:org/repo:doc${i}.md`,
      versaoConteudo: `sha-${i}`
    }));
    for (const doc of documentos) {
      await banco.gravarConteudo({
        _id: doc.id,
        versaoConteudo: doc.versaoConteudo as string,
        estado: 'extraido',
        texto: 'texto',
        truncado: false
      });
    }

    await Promise.all(documentos.map((doc) => resumos.resumoDoDocumento(doc)));

    expect(pico).toBe(1);
  });

  it('uma submissão que falha não derruba as seguintes', async () => {
    await comTexto();
    const outro = { ...documento, id: 'github:org/repo:b.md', versaoConteudo: 'sha-b' };
    await banco.gravarConteudo({
      _id: outro.id,
      versaoConteudo: 'sha-b',
      estado: 'extraido',
      texto: 'texto',
      truncado: false
    });

    vi.mocked(gemini.resumir)
      .mockRejectedValueOnce(new gemini.ErroLLM('cota-excedida', 'Limite atingido.'))
      .mockResolvedValueOnce(PRODUZIDO);

    const [primeira, segunda] = await Promise.all([
      resumos.resumoDoDocumento(documento),
      resumos.resumoDoDocumento(outro)
    ]);

    expect(primeira.motivo).toBe('cota-excedida');
    expect(segunda.resumo).not.toBeNull();
  });
});

describe('falhas da LLM chegam distinguidas', () => {
  it.each([
    ['credencial-invalida', 'A chave da API de IA não foi aceita.'],
    ['cota-excedida', 'O limite foi atingido.'],
    ['sem-conexao', 'Não foi possível alcançar o serviço de IA.'],
    ['falha', 'O serviço de IA devolveu uma resposta ilegível.']
  ] as const)('%s chega ao painel com o motivo correto', async (motivo, mensagem) => {
    await comTexto();
    vi.mocked(gemini.resumir).mockRejectedValue(new gemini.ErroLLM(motivo, mensagem));

    const resposta = await resumos.resumoDoDocumento(documento);

    expect(resposta.resumo).toBeNull();
    expect(resposta.motivo).toBe(motivo);
    expect(resposta.mensagem).toBe(mensagem);
  });
});

describe('instrução versionada', () => {
  it('envia junto à submissão a instrução lida do arquivo', async () => {
    await comTexto();

    await resumos.resumoDoDocumento(documento);

    const [, instrucaoEnviada] = vi.mocked(gemini.resumir).mock.calls[0] as [
      string,
      string,
      unknown
    ];
    expect(instrucaoEnviada).toContain('Atenha-se ao texto recebido');
  });
});

describe('categoria espelhada no acervo (categorizar-documentos-pelo-resumo)', () => {
  it('aparece no acervo depois de gerar o resumo, para o filtro por categoria', async () => {
    await banco.sincronizarInventario([documento]);
    await comTexto();

    await resumos.resumoDoDocumento(documento);

    const [reconstruido] = await banco.inventarioSincronizado();
    expect(reconstruido?.categoria).toBe('Ata');
  });

  it('não aparece quando o resumo não encontrou categoria com confiança', async () => {
    await banco.sincronizarInventario([documento]);
    await comTexto();
    vi.mocked(gemini.resumir).mockResolvedValue({ ...PRODUZIDO, categoria: '' });

    await resumos.resumoDoDocumento(documento);

    const [reconstruido] = await banco.inventarioSincronizado();
    expect(reconstruido?.categoria).toBeUndefined();
  });

  it('é atualizada no acervo quando o resumo é regerado com uma categoria diferente', async () => {
    await banco.sincronizarInventario([documento]);
    await comTexto();
    await resumos.resumoDoDocumento(documento);

    vi.mocked(gemini.resumir).mockResolvedValue({ ...PRODUZIDO, categoria: 'ADR' });
    await resumos.resumoDoDocumento(documento, true);

    const [reconstruido] = await banco.inventarioSincronizado();
    expect(reconstruido?.categoria).toBe('ADR');
  });
});
