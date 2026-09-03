// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANAIS } from '../../src/compartilhado/canais';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Garante a fronteira de conteúdo da ADR-0005.
 *
 * O teste de credenciais ao lado inspeciona o código-fonte; este exercita os
 * canais de verdade. A diferença importa: uma inspeção textual não alcança um
 * canal que devolva texto por caminho indireto — um campo a mais em `Documento`,
 * um objeto repassado inteiro em vez de projetado.
 *
 * O procedimento é: gravar no banco um texto com marca reconhecível, registrar
 * os handlers reais contra um `ipcMain` falso, invocar **todos** eles, e falhar
 * se a marca aparecer em qualquer resposta. Introduzir um canal que devolva
 * conteúdo faz este teste falhar sem que ninguém precise lembrar de atualizá-lo.
 */

const MARCA = 'CONTEUDO-QUE-NAO-PODE-ATRAVESSAR-O-IPC';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (canal: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(canal, fn);
    }
  },
  shell: { openExternal: vi.fn(async () => undefined) }
}));

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste'),
  definir: vi.fn(),
  remover: vi.fn(),
  existe: vi.fn(() => true)
}));

const banco = await import('../../src/main/banco/repositorio');
const github = await import('../../src/main/fontes/github');
const gemini = await import('../../src/main/llm/gemini');
const { registrarCanais } = await import('../../src/main/ipc');

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

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-fronteira-'));
  await banco.abrirBanco(diretorio);

  await banco.gravarConteudo({
    _id: documento.id,
    versaoConteudo: 'sha-1',
    estado: 'extraido',
    // "planejamento" só existe no texto — não no nome do arquivo nem no autor —,
    // então uma busca por esse termo só casa pela via do conteúdo.
    texto: `Ata de reunião sobre planejamento. ${MARCA}. Fim da ata.`,
    truncado: false
  });

  vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
    dados: [documento],
    aviso: null
  });
  vi.spyOn(github, 'documentosRecentes').mockResolvedValue({
    dados: [documento],
    aviso: null
  });
  vi.spyOn(github, 'autoriaDoArquivo').mockResolvedValue(null);
  vi.spyOn(github, 'verificarCredencial').mockResolvedValue('conta-de-teste');
  vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(
    new TextEncoder().encode(`Outro texto. ${MARCA}.`).buffer as ArrayBuffer
  );

  // A LLM é dublada para que os canais de resumo cheguem ao fim sem rede. O
  // texto enviado a ela leva a marca de propósito: é justamente o caminho por
  // onde o conteúdo poderia voltar disfarçado de resumo.
  vi.spyOn(gemini, 'verificarChave').mockResolvedValue(undefined);
  vi.spyOn(gemini, 'resumir').mockResolvedValue({
    resumo: 'Resumo sem nada do texto original.',
    categoria: 'Ata',
    assuntos: ['exemplo'],
    destaques: ['Um ponto']
  });

  handlers.clear();
  registrarCanais();
  await banco.registrarAcesso(documento);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Argumentos plausíveis para cada canal, para que a invocação chegue ao fim. */
const ARGUMENTOS: Record<string, unknown[]> = {
  [CANAIS.credenciaisDefinir]: ['github', 'ghp_token_qualquer'],
  [CANAIS.credenciaisRemover]: ['github'],
  // Termo que só casa pelo conteúdo: é o caminho por onde o texto poderia
  // voltar disfarçado de trecho ou de campo repassado inteiro.
  [CANAIS.buscar]: [
    { termo: 'planejamento', fontes: [], extensoes: [], ordenacao: 'data-desc', buscarConteudo: true }
  ],
  [CANAIS.recentes]: [{ termo: '', fontes: [], extensoes: [], ordenacao: 'data-desc' }],
  [CANAIS.recentesDoCache]: [
    { termo: '', fontes: [], extensoes: [], ordenacao: 'data-desc' }
  ],
  [CANAIS.detalharDocumentos]: [[documento]],
  [CANAIS.abrirDocumento]: [documento],
  [CANAIS.llmDefinir]: ['AQ.Ab8RChaveQualquer'],
  [CANAIS.llmConsentir]: [true],
  [CANAIS.resumoDoDocumento]: [documento],
  [CANAIS.resumoGravado]: [documento],
  [CANAIS.prepararConteudo]: [documento],
  [CANAIS.relacionadosDoDocumento]: [documento]
};

describe('nenhum canal devolve conteúdo de documento', () => {
  it('cobre todos os canais declarados, sem esquecer nenhum', () => {
    // Sem esta asserção, um canal novo passaria despercebido: ele não estaria
    // no `it.each` abaixo, e a suíte continuaria verde sem tê-lo examinado.
    expect([...handlers.keys()].sort()).toEqual(Object.values(CANAIS).sort());
  });

  it.each(Object.values(CANAIS))('%s não carrega o texto ingerido', async (canal) => {
    const handler = handlers.get(canal);
    expect(handler).toBeDefined();

    const resposta = await (handler as (...args: unknown[]) => unknown)(
      {},
      ...(ARGUMENTOS[canal] ?? [])
    );

    expect(JSON.stringify(resposta ?? null)).not.toContain(MARCA);
  });

  it('o canal de indexação devolve apenas contagens e mensagens do sistema', async () => {
    const handler = handlers.get(CANAIS.indexarConteudo);
    const progresso = (await (handler as () => Promise<Record<string, unknown>>)()) ?? {};

    for (const [campo, valor] of Object.entries(progresso)) {
      expect(
        ['number', 'boolean', 'string'].includes(typeof valor),
        `campo ${campo} deveria ser escalar`
      ).toBe(true);
    }
    expect(Object.keys(progresso).sort()).toEqual(
      ['falhas', 'ingeridos', 'reaproveitados', 'semTexto', 'suspensa', 'total'].sort()
    );
  });

  it('a ingestão realmente gravou texto — o teste acima não passou por vazio', async () => {
    const registro = await banco.lerConteudo(documento.id);

    expect(registro?.texto).toContain(MARCA);
  });

  it('a busca pelo conteúdo devolve a marca, e nunca o trecho', async () => {
    const handler = handlers.get(CANAIS.buscar) as (...args: unknown[]) => Promise<unknown>;
    const resposta = await handler({}, {
      termo: 'planejamento',
      fontes: [],
      extensoes: [],
      ordenacao: 'data-desc',
      buscarConteudo: true
    });

    const serial = JSON.stringify(resposta);
    // A correspondência aconteceu de fato — o documento veio assinalado…
    expect(serial).toContain('apenasConteudo');
    // …mas nada do texto de onde ela saiu.
    expect(serial).not.toContain(MARCA);
    expect(serial).not.toContain('Ata de reunião sobre');
  });

  it('a pilha de relacionados nunca devolve o texto de onde os rótulos saíram', async () => {
    // Classifica o documento: a pilha só cruza os rótulos de quem já tem
    // resumo. O texto por trás dos rótulos continua com a marca.
    await banco.sincronizarInventario([documento]);
    await banco.gravarResumo(documento.id, {
      resumo: 'Resumo sem nada do texto.',
      categoria: 'Ata',
      assuntos: ['planejamento'],
      destaques: ['Um ponto']
    });

    const handler = handlers.get(CANAIS.relacionadosDoDocumento) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    const resposta = await handler({}, documento);

    const serial = JSON.stringify(resposta);
    expect(serial).not.toContain(MARCA);
    expect(serial).not.toContain('Ata de reunião sobre');
  });

  it('o canal de estado da sincronização devolve só estado e contagens', async () => {
    const handler = handlers.get(CANAIS.sincronizacaoEstado) as () => Promise<
      Record<string, unknown>
    >;
    const retrato = (await handler()) ?? {};

    for (const [campo, valor] of Object.entries(retrato)) {
      expect(
        ['number', 'boolean', 'string'].includes(typeof valor),
        `campo ${campo} deveria ser escalar`
      ).toBe(true);
    }
    expect(JSON.stringify(retrato)).not.toContain(MARCA);
  });
});

describe('o preload não alcança o conteúdo', () => {
  it('não expõe operação de leitura de texto', async () => {
    const { readFileSync } = await import('node:fs');
    const preload = readFileSync(
      join(__dirname, '../../src/preload/index.ts'),
      'utf8'
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(preload).not.toMatch(/\btexto\b/i);
    expect(preload).not.toMatch(/lerConteudo|textoDoDocumento/);
    expect(preload).not.toMatch(/from '.*conteudo/);
  });
});
