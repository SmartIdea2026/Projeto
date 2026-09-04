import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';
import { CONECTADO, montarApi, instalarApi } from './apoio';

/**
 * Autoria preenchida sem bloquear a lista.
 *
 * Cada documento custa uma requisição ao GitHub. Segurar a tela por até dez
 * delas trocaria um incômodo pequeno — a linha de autoria aparecer com atraso —
 * por uma espera sentida em toda navegação.
 */

const base: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  dataAproximada: true,
  link: 'https://exemplo/ata',
  caminho: 'Docs/ata.md',
  repositorio: 'o/r'
};

const RECENTES: ResultadoBusca = {
  documentos: [base],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

const api = montarApi(RECENTES);

beforeEach(() => {
  vi.clearAllMocks();
  api.recentes.mockResolvedValue(RECENTES);
  instalarApi(api);
});

/**
 * Nomes dos documentos na lista — e só na lista.
 *
 * O painel de resumo também apresenta o nome do primeiro documento, então uma
 * busca global por "ata.md" casa com dois elementos assim que o resumo resolve.
 * Estas verificações são sobre a lista; a consulta acompanha isso.
 */
function nomesNaLista(): string[] {
  return Array.from(document.querySelectorAll('.cartao__nome')).map(
    (elemento) => elemento.textContent ?? ''
  );
}

describe('preenchimento da autoria', () => {
  it('apresenta a lista antes de a autoria chegar', async () => {
    let liberar: (docs: Documento[]) => void = () => {};
    api.detalharDocumentos.mockImplementation(
      () => new Promise<Documento[]>((resolver) => { liberar = resolver; })
    );

    render(<App />);

    // O documento está na tela com a consulta de autoria ainda pendente.
    await waitFor(() => expect(nomesNaLista()).toContain('ata.md'));
    expect(screen.queryByText('Autor:')).not.toBeInTheDocument();

    liberar([{ ...base, autor: 'GustavoMairinck', dataModificacao: '2026-08-22T10:00:00Z' }]);

    await waitFor(() => expect(screen.getByText('Autor:')).toBeInTheDocument());
    expect(screen.getByText('GustavoMairinck')).toBeInTheDocument();
  });

  it('mantém a lista utilizável quando o detalhamento falha', async () => {
    api.detalharDocumentos.mockRejectedValue(new Error('rede indisponível'));

    render(<App />);

    await waitFor(() => expect(nomesNaLista()).toContain('ata.md'));
    // Sem autoria e sem erro: os campos são complemento, não requisito.
    expect(screen.queryByText('Autor:')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('descarta o detalhamento quando a lista já mudou', async () => {
    let liberar: (docs: Documento[]) => void = () => {};
    api.detalharDocumentos.mockImplementation(
      () => new Promise<Documento[]>((resolver) => { liberar = resolver; })
    );

    render(<App />);
    await waitFor(() => expect(nomesNaLista()).toContain('ata.md'));

    // Chega o detalhe de um conjunto que não é mais o exibido.
    liberar([
      { ...base, id: 'github:o/r:outro.md', nome: 'outro.md', autor: 'Fulano' },
      { ...base, id: 'github:o/r:mais.md', nome: 'mais.md', autor: 'Ciclano' }
    ]);

    await waitFor(() => expect(nomesNaLista()).toEqual(['ata.md']));
    expect(screen.queryByText('outro.md')).not.toBeInTheDocument();
  });
});

describe('rótulos dos metadados', () => {
  it('nomeia cada dado em vez de apresentá-los soltos', async () => {
    api.detalharDocumentos.mockResolvedValue([
      {
        ...base,
        autor: 'Gabi Prajo',
        dataCriacao: '2026-02-02T00:00:00Z',
        dataModificacao: '2026-08-22T10:00:00Z',
        dataAproximada: undefined
      }
    ]);

    render(<App />);

    // Sem rótulo, a linha seria um nome e duas datas sem dizer o que são.
    await waitFor(() => expect(screen.getByText('Autor:')).toBeInTheDocument());
    expect(screen.getByText('Repositório:')).toBeInTheDocument();
    expect(screen.getByText('Criado em')).toBeInTheDocument();
    expect(screen.getByText('Modificado em')).toBeInTheDocument();
    expect(screen.getByText('Gabi Prajo')).toBeInTheDocument();
  });

  it('avisa quando a data é a do repositório, não a do arquivo', async () => {
    api.detalharDocumentos.mockResolvedValue([base]);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Repositório atualizado em')).toBeInTheDocument()
    );
    expect(screen.queryByText('Modificado em')).not.toBeInTheDocument();
  });
});

/**
 * A ordem apresentada acompanha as datas apresentadas.
 *
 * O detalhamento troca a data aproximada do repositório pela data real do
 * commit. Substituir o documento sem reposicioná-lo deixa a lista rotulada
 * "Data decrescente" exibindo datas fora de ordem — duas afirmações
 * incompatíveis ao mesmo tempo, sem que quem lê tenha como saber qual vale.
 */
describe('reposicionamento pela data real', () => {
  const zebra: Documento = {
    ...base,
    id: 'github:o/r:zebra.md',
    nome: 'zebra.md',
    caminho: 'Docs/zebra.md'
  };

  const LISTA: ResultadoBusca = {
    // Mesma data aproximada do repositório: a ordem inicial desempata por nome.
    documentos: [base, zebra],
    total: 2,
    pagina: 1,
    falhas: [],
    avisos: [],
    doCache: false
  };

  function nomesNaTela(): string[] {
    return Array.from(document.querySelectorAll('.cartao__nome')).map(
      (elemento) => elemento.textContent ?? ''
    );
  }

  beforeEach(() => {
    api.recentes.mockResolvedValue(LISTA);
  });

  it('move o documento cuja data real o coloca à frente', async () => {
    api.detalharDocumentos.mockResolvedValue([
      { ...base, autor: 'Marina Alves', dataModificacao: '2026-03-01T00:00:00Z' },
      { ...zebra, autor: 'Gabi Prajo', dataModificacao: '2026-08-22T10:00:00Z' }
    ]);

    render(<App />);

    // A data real põe `zebra.md` na frente, e a lista acompanha.
    await waitFor(() => expect(nomesNaTela()).toEqual(['zebra.md', 'ata.md']));
  });

  it('reposiciona sem consultar as fontes e sem indicador de carregamento', async () => {
    api.detalharDocumentos.mockResolvedValue([
      { ...base, autor: 'Marina Alves', dataModificacao: '2026-03-01T00:00:00Z' },
      { ...zebra, autor: 'Gabi Prajo', dataModificacao: '2026-08-22T10:00:00Z' }
    ]);

    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toEqual(['zebra.md', 'ata.md']));

    // Uma consulta só, a da abertura: o reposicionamento é local.
    expect(api.recentes).toHaveBeenCalledTimes(1);
    expect(api.buscar).not.toHaveBeenCalled();
    expect(api.reordenar).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.esqueleto')).toHaveLength(0);
  });
});

/**
 * Revalidação pela autoria real.
 *
 * O que decide se um documento entra numa busca por termo pode ser a autoria
 * do snapshot local, ainda não resincronizada. Quando a autoria real chega
 * (`detalharPagina`) e não bate mais com o termo buscado, o documento perde a
 * razão de estar na lista — mantê-lo mostraria um cartão cujo autor não tem
 * nenhuma relação com o termo, como se a ordenação tivesse ignorado a busca.
 */
describe('revalidação pela autoria real', () => {
  const porAutor: Documento = {
    ...base,
    id: 'github:o/r:por-autor.md',
    nome: 'por-autor.md',
    caminho: 'Docs/por-autor.md',
    autor: 'GustavoMairinck'
  };

  const porConteudo: Documento = {
    ...base,
    id: 'github:o/r:por-conteudo.md',
    nome: 'por-conteudo.md',
    caminho: 'Docs/por-conteudo.md',
    autor: 'Marina Alves',
    apenasConteudo: true
  };

  const RESULTADO_BUSCA: ResultadoBusca = {
    // Nessa ordem porque é a que o processo principal já devolveria: `apresentar`
    // (busca/servico.ts) ordena antes de responder, e apenasConteudo vai na
    // frente (compartilhado/ordenacao.ts).
    documentos: [porConteudo, porAutor],
    total: 2,
    pagina: 1,
    falhas: [],
    avisos: [],
    doCache: false
  };

  function nomesNaTela(): string[] {
    return Array.from(document.querySelectorAll('.cartao__nome')).map(
      (elemento) => elemento.textContent ?? ''
    );
  }

  async function buscarPor(termo: string): Promise<void> {
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: termo }
    });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
  }

  beforeEach(() => {
    api.buscar.mockResolvedValue(RESULTADO_BUSCA);
  });

  it('remove um resultado que só bateu pelo autor quando a autoria real já não bate mais com o termo', async () => {
    let liberar: (docs: Documento[]) => void = () => {};
    api.detalharDocumentos.mockImplementation(
      () => new Promise<Documento[]>((resolver) => { liberar = resolver; })
    );

    await buscarPor('gustavo');

    // Os dois aparecem primeiro, com a autoria do snapshot ainda vigente —
    // `por-conteudo.md` na frente porque é `apenasConteudo`.
    await waitFor(() => expect(nomesNaTela()).toEqual(['por-conteudo.md', 'por-autor.md']));

    liberar([porConteudo, { ...porAutor, autor: 'andrefsa16' }]);

    // A autoria real chega e `por-autor.md` deixa de justificar o resultado.
    await waitFor(() => expect(nomesNaTela()).toEqual(['por-conteudo.md']));
  });

  it('mantém um resultado marcado apenasConteudo mesmo que a autoria real não bata com o termo', async () => {
    api.detalharDocumentos.mockResolvedValue([
      { ...porConteudo, autor: 'ninguem-relacionado' },
      porAutor
    ]);

    await buscarPor('gustavo');

    await waitFor(() => expect(screen.getByText('ninguem-relacionado')).toBeInTheDocument());
    expect(nomesNaTela()).toEqual(['por-conteudo.md', 'por-autor.md']);
  });

  it('não mexe na lista quando a busca é sem termo (recentes)', async () => {
    api.recentes.mockResolvedValue(RESULTADO_BUSCA);
    api.detalharDocumentos.mockResolvedValue([
      porConteudo,
      { ...porAutor, autor: 'andrefsa16' }
    ]);

    render(<App />);

    // Sem termo, a revalidação por nome/autor não faz sentido — nada é
    // removido, mesmo que a autoria real não tenha relação com coisa alguma.
    await waitFor(() => expect(nomesNaTela()).toEqual(['por-conteudo.md', 'por-autor.md']));
  });
});
