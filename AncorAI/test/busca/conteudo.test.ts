// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * A busca alcança o conteúdo dos documentos.
 *
 * Fim a fim, por `servico.buscar`: um termo presente só no texto traz o
 * documento; a correspondência é aditiva — nome, autor ou conteúdo, num
 * resultado só; o que casou apenas pelo conteúdo é assinalado; nada do texto
 * atravessa a resposta (ADR-0005); e a busca avisa quando o alcance pelo
 * conteúdo cobriu só parte do acervo.
 */

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste')
}));

const github = await import('../../src/main/fontes/github');
const banco = await import('../../src/main/banco/repositorio');
const servico = await import('../../src/main/busca/servico');

let diretorio: string;

function doc(nome: string): Documento {
  return {
    id: `github:org/repo:${nome}`,
    nome,
    extensao: nome.split('.').pop() ?? 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: `https://github.com/org/repo/blob/main/${nome}`,
    caminho: nome,
    repositorio: 'org/repo',
    versaoConteudo: `sha-${nome}`,
    tamanho: 100
  };
}

const INVENTARIO = [
  doc('plano-de-marketing.md'),
  doc('ata-2026-08.md'),
  doc('requisitos.md')
];

const MARCA_TEXTO = 'CRONOGRAMA-DETALHADO-DE-MARKETING';

/** Grava o texto de um documento com o `versaoConteudo` que o inventário espera. */
async function sincronizar(nome: string, texto: string): Promise<void> {
  await banco.gravarConteudo({
    _id: `github:org/repo:${nome}`,
    versaoConteudo: `sha-${nome}`,
    estado: 'extraido',
    texto,
    truncado: false
  });
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-busca-conteudo-'));
  await banco.abrirBanco(diretorio);

  vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({ dados: INVENTARIO, aviso: null });
  vi.spyOn(github, 'autoriaDoArquivo').mockResolvedValue(null);

  // A ata é o único documento com texto armazenado, e o termo aparece só nele.
  await sincronizar('ata-2026-08.md', `Reunião de agosto. ${MARCA_TEXTO}. Encerramento.`);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function avisoDeConteudo(avisos: { mensagem: string }[]): string | undefined {
  return avisos.find((a) => a.mensagem.includes('alcançou parte do acervo'))?.mensagem;
}

describe('correspondência pelo conteúdo', () => {
  it('traz o documento cujo termo só existe no texto armazenado', async () => {
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'cronograma', buscarConteudo: true });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata-2026-08.md']);
    expect(resultado.documentos[0]?.apenasConteudo).toBe(true);
  });

  it('é aditiva: nome e conteúdo no mesmo resultado', async () => {
    // "marketing" está no nome de um documento e no conteúdo de outro.
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'marketing', buscarConteudo: true });

    expect(resultado.documentos.map((d) => d.nome).sort()).toEqual([
      'ata-2026-08.md',
      'plano-de-marketing.md'
    ]);
    const porNome = resultado.documentos.find((d) => d.nome === 'plano-de-marketing.md');
    const porConteudo = resultado.documentos.find((d) => d.nome === 'ata-2026-08.md');
    expect(porNome?.apenasConteudo).toBeUndefined();
    expect(porConteudo?.apenasConteudo).toBe(true);
  });

  it('não devolve o trecho onde o termo ocorreu', async () => {
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'cronograma', buscarConteudo: true });

    expect(JSON.stringify(resultado)).not.toContain(MARCA_TEXTO);
  });

  it('documento sem texto armazenado continua encontrável pelo nome', async () => {
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'requisitos', buscarConteudo: true });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['requisitos.md']);
    expect(resultado.documentos[0]?.apenasConteudo).toBeUndefined();
  });

  it('não faz requisição de conteúdo alguma para casar o termo', async () => {
    const baixar = vi.spyOn(github, 'conteudoDoArquivo');

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'cronograma', buscarConteudo: true });

    expect(baixar).not.toHaveBeenCalled();
  });

  it('com a busca no conteúdo desligada, o termo casa só nome e autor', async () => {
    const lerConteudo = vi.spyOn(banco, 'conteudoParaBusca');

    // "cronograma" só existe no texto da ata.
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'cronograma' });

    expect(resultado.documentos).toHaveLength(0);
    // Nem a coleção de conteúdo é aberta.
    expect(lerConteudo).not.toHaveBeenCalled();
  });
});

describe('aviso de alcance parcial', () => {
  it('avisa, com a contagem, quando parte do acervo ainda não tem texto', async () => {
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'reuniao', buscarConteudo: true });

    // `plano-de-marketing.md` e `requisitos.md` seguem sem texto sincronizado.
    expect(avisoDeConteudo(resultado.avisos)).toContain('2 documento(s)');
  });

  it('não avisa quando a cobertura do inventário é total', async () => {
    await sincronizar('plano-de-marketing.md', 'Plano com metas trimestrais.');
    await sincronizar('requisitos.md', 'Lista de requisitos funcionais.');

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'reuniao', buscarConteudo: true });

    expect(avisoDeConteudo(resultado.avisos)).toBeUndefined();
  });

  it('não avisa sobre alcance de conteúdo quando a consulta não tem termo', async () => {
    const resultado = await servico.buscar({ ...FILTROS_PADRAO, dataInicial: '2020-01-01' });

    expect(avisoDeConteudo(resultado.avisos)).toBeUndefined();
  });
});
