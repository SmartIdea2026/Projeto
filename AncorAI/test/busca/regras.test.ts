import { describe, expect, it } from 'vitest';
import { extensaoDe, extensaoEhAceita } from '../../src/main/fontes/comum';
import {
  aplicarFiltros,
  fonteSelecionada,
  ordenar,
  unificar
} from '../../src/main/busca/regras';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

function doc(parcial: Partial<Documento> & { id: string; nome: string }): Documento {
  return {
    extensao: extensaoDe(parcial.nome),
    fonte: 'github',
    dataModificacao: '2026-08-01T12:00:00Z',
    link: 'https://exemplo/x',
    ...parcial
  };
}

describe('extensões aceitas', () => {
  it('aceita os tipos de documentação definidos pela equipe', () => {
    for (const nome of ['a.md', 'b.pdf', 'c.docx', 'd.xlsx', 'e.epub', 'f.txt']) {
      expect(extensaoEhAceita(nome)).toBe(true);
    }
  });

  it('rejeita código-fonte e configuração, incluindo o .json do protótipo', () => {
    for (const nome of ['index.ts', 'App.tsx', 'config.json', 'estilo.css']) {
      expect(extensaoEhAceita(nome)).toBe(false);
    }
  });

  it('trata arquivo sem extensão', () => {
    expect(extensaoDe('LICENSE')).toBe('');
    expect(extensaoEhAceita('LICENSE')).toBe(false);
  });
});

describe('filtro por termo', () => {
  const documentos = [
    doc({ id: '1', nome: 'roadmap-produto.md' }),
    doc({ id: '2', nome: 'ata-reuniao.md' })
  ];

  it('compara com o nome do arquivo, ignorando maiúsculas', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'ROADMAP' });
    expect(encontrados.map((item) => item.id)).toEqual(['1']);
  });

  it('devolve tudo quando o termo está vazio', () => {
    expect(aplicarFiltros(documentos, FILTROS_PADRAO)).toHaveLength(2);
  });
});

describe('filtro por tipo e período', () => {
  const documentos = [
    doc({ id: '1', nome: 'a.md', dataModificacao: '2026-01-10T00:00:00Z' }),
    doc({ id: '2', nome: 'b.pdf', dataModificacao: '2026-06-15T00:00:00Z' })
  ];

  it('restringe pela extensão', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, extensoes: ['pdf'] });
    expect(encontrados.map((item) => item.id)).toEqual(['2']);
  });

  it('restringe pelo intervalo de datas', () => {
    const encontrados = aplicarFiltros(documentos, {
      ...FILTROS_PADRAO,
      dataInicial: '2026-05-01',
      dataFinal: '2026-07-01'
    });
    expect(encontrados.map((item) => item.id)).toEqual(['2']);
  });

  it('inclui documentos do próprio dia informado como data final', () => {
    const encontrados = aplicarFiltros(documentos, {
      ...FILTROS_PADRAO,
      dataInicial: '2026-06-15',
      dataFinal: '2026-06-15'
    });
    expect(encontrados.map((item) => item.id)).toEqual(['2']);
  });
});

describe('seleção de fonte', () => {
  it('considera todas as fontes quando nenhuma é escolhida (RN04)', () => {
    expect(fonteSelecionada(FILTROS_PADRAO, 'github')).toBe(true);
  });

  it('consulta apenas a fonte escolhida (RN05)', () => {
    const filtros = { ...FILTROS_PADRAO, fontes: ['github' as const] };
    expect(fonteSelecionada(filtros, 'github')).toBe(true);
  });
});

describe('ordenação', () => {
  const documentos = [
    doc({ id: '1', nome: 'banana.md', dataModificacao: '2026-03-01T00:00:00Z' }),
    doc({ id: '2', nome: 'abacate.md', dataModificacao: '2026-08-01T00:00:00Z' })
  ];

  it('ordena pelos quatro critérios', () => {
    expect(ordenar(documentos, 'a-z').map((d) => d.id)).toEqual(['2', '1']);
    expect(ordenar(documentos, 'z-a').map((d) => d.id)).toEqual(['1', '2']);
    expect(ordenar(documentos, 'data-asc').map((d) => d.id)).toEqual(['1', '2']);
    expect(ordenar(documentos, 'data-desc').map((d) => d.id)).toEqual(['2', '1']);
  });

  it('não altera a lista original', () => {
    const original = [...documentos];
    ordenar(documentos, 'a-z');
    expect(documentos).toEqual(original);
  });
});

describe('unificação das fontes', () => {
  it('remove duplicatas por id preservando a ordem', () => {
    const unificados = unificar([
      doc({ id: 'x', nome: 'a.md' }),
      doc({ id: 'y', nome: 'b.md' }),
      doc({ id: 'x', nome: 'a.md' })
    ]);
    expect(unificados.map((item) => item.id)).toEqual(['x', 'y']);
  });
});

describe('desempate da ordenação por data', () => {
  // Situação comum no GitHub: a busca deriva a data do repositório, então todo
  // documento de um mesmo repositório carrega a mesma data.
  const mesmaData = [
    doc({ id: '1', nome: 'zebra.md', dataModificacao: '2026-08-01T00:00:00Z' }),
    doc({ id: '2', nome: 'abacate.md', dataModificacao: '2026-08-01T00:00:00Z' }),
    doc({ id: '3', nome: 'manga.md', dataModificacao: '2026-08-01T00:00:00Z' })
  ];

  it('desempata por nome A–Z nos dois sentidos da data', () => {
    expect(ordenar(mesmaData, 'data-desc').map((d) => d.nome)).toEqual([
      'abacate.md',
      'manga.md',
      'zebra.md'
    ]);
    expect(ordenar(mesmaData, 'data-asc').map((d) => d.nome)).toEqual([
      'abacate.md',
      'manga.md',
      'zebra.md'
    ]);
  });

  it('produz a mesma ordem em chamadas sucessivas', () => {
    const primeira = ordenar(mesmaData, 'data-desc').map((d) => d.id);
    const segunda = ordenar([...mesmaData].reverse(), 'data-desc').map((d) => d.id);
    expect(segunda).toEqual(primeira);
  });

  it('desempata pelo identificador quando nome e data empatam', () => {
    // `README.md` em repositórios diferentes é a regra, não a exceção: sem o
    // desempate final os dois trocam de lugar entre uma consulta e outra.
    const mesmoNome = [
      doc({ id: 'github:org/beta:README.md', nome: 'README.md' }),
      doc({ id: 'github:org/alfa:README.md', nome: 'README.md' })
    ];

    const primeira = ordenar(mesmoNome, 'data-desc').map((d) => d.id);
    const segunda = ordenar([...mesmoNome].reverse(), 'data-desc').map((d) => d.id);

    expect(primeira).toEqual(['github:org/alfa:README.md', 'github:org/beta:README.md']);
    expect(segunda).toEqual(primeira);
  });

  it('a data continua tendo precedência sobre o nome', () => {
    const datasDistintas = [
      doc({ id: 'a', nome: 'abacate.md', dataModificacao: '2026-01-01T00:00:00Z' }),
      doc({ id: 'b', nome: 'zebra.md', dataModificacao: '2026-08-01T00:00:00Z' })
    ];
    // O desempate só entra quando as datas empatam.
    expect(ordenar(datasDistintas, 'data-desc').map((d) => d.nome)).toEqual([
      'zebra.md',
      'abacate.md'
    ]);
  });
});

describe('busca pelo autor', () => {
  const documentos = [
    doc({ id: '1', nome: 'ata-reuniao.md', autor: 'Gabi Prajo' }),
    doc({ id: '2', nome: 'requisitos.md', autor: 'Marina Alves' }),
    doc({ id: '3', nome: 'gabi-notas.md' })
  ];

  it('encontra pelo nome de quem alterou o arquivo', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'marina' });
    expect(encontrados.map((d) => d.id)).toEqual(['2']);
  });

  it('casa por nome ou por autor, sem exigir os dois', () => {
    // "gabi" está no autor do primeiro e no nome do terceiro.
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'gabi' });
    expect(encontrados.map((d) => d.id)).toEqual(['1', '3']);
  });

  it('ignora diferença de caixa no autor', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'PRAJO' });
    expect(encontrados.map((d) => d.id)).toEqual(['1']);
  });

  it('encontra por sobrenome, não só pelo início do nome', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'alves' });
    expect(encontrados.map((d) => d.id)).toEqual(['2']);
  });

  it('documento sem autor continua encontrável pelo nome', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'notas' });
    expect(encontrados.map((d) => d.id)).toEqual(['3']);
  });

  it('não confunde ausência de autor com correspondência', () => {
    const encontrados = aplicarFiltros(documentos, { ...FILTROS_PADRAO, termo: 'inexistente' });
    expect(encontrados).toEqual([]);
  });
});
