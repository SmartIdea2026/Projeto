import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import { ordenar } from '../../src/compartilhado/ordenacao';
import {
  POR_PAGINA,
  type Documento,
  type Ordenacao,
  type ResultadoBusca
} from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Reordenação do resultado inteiro, sem nova consulta às fontes.
 *
 * A especificação exige duas coisas ao mesmo tempo, e é a combinação delas que
 * está sob teste: o critério escolhido vale para **todo** o resultado — a
 * primeira página passa a trazer os documentos de maior precedência segundo o
 * novo critério — e trocá-lo **não** consulta as fontes, porque isso gastaria
 * cota e faria o usuário esperar por uma reorganização de dados que já vieram.
 *
 * Reordenar só a página visível satisfaz a segunda e falha na primeira: devolve
 * a ordem alfabética de um recorte arbitrário, não a do resultado.
 */

/**
 * Doze documentos em que a ordem alfabética é o inverso da ordem por data.
 *
 * `a.md` é o mais antigo: ele fica na segunda página por data decrescente e na
 * primeira por nome A–Z. É o que distingue reordenar o resultado de reordenar
 * a página.
 */
const ACERVO: Documento[] = Array.from({ length: 12 }, (_, i) => {
  const nome = `${String.fromCharCode(97 + i)}.md`;
  return {
    id: `github:o/r:${nome}`,
    nome,
    extensao: 'md',
    fonte: 'github' as const,
    dataModificacao: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    link: `https://exemplo/${nome}`
  };
});

/** Dublê do processo principal: ordena o acervo inteiro e recorta a página. */
function pagina(criterio: Ordenacao, numero = 1): ResultadoBusca {
  const ordenados = ordenar(ACERVO, criterio);
  const inicio = (numero - 1) * POR_PAGINA;

  return {
    documentos: ordenados.slice(inicio, inicio + POR_PAGINA),
    total: ACERVO.length,
    pagina: numero,
    falhas: [],
    avisos: [],
    doCache: false
  };
}

const api = montarApi(pagina('data-desc'));

beforeEach(() => {
  vi.clearAllMocks();

  const responder = async (filtros: { ordenacao: Ordenacao; pagina?: number }) =>
    pagina(filtros.ordenacao, filtros.pagina ?? 1);

  api.recentes.mockImplementation(responder);
  api.buscar.mockImplementation(responder);
  api.reordenar.mockImplementation(responder);

  instalarApi(api);
});

function nomesNaTela(): string[] {
  return Array.from(document.querySelectorAll('.cartao__nome')).map(
    (elemento) => elemento.textContent ?? ''
  );
}

describe('troca do critério de ordenação', () => {
  it('reordena o resultado inteiro, e não apenas a página visível', async () => {
    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toHaveLength(POR_PAGINA));
    // Página 1 por data decrescente: do mais recente para o mais antigo.
    expect(nomesNaTela()[0]).toBe('l.md');
    expect(nomesNaTela()).not.toContain('a.md');

    fireEvent.change(screen.getByLabelText('Ordenação'), { target: { value: 'a-z' } });

    // `a.md` estava na segunda página. Reordenar apenas os dez visíveis daria
    // `c.md` no topo — o primeiro em ordem alfabética de um recorte arbitrário.
    await waitFor(() => expect(nomesNaTela()[0]).toBe('a.md'));
    expect(nomesNaTela()).toEqual([
      'a.md',
      'b.md',
      'c.md',
      'd.md',
      'e.md',
      'f.md',
      'g.md',
      'h.md',
      'i.md',
      'j.md'
    ]);
  });

  it('não consulta as fontes ao trocar o critério', async () => {
    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toHaveLength(POR_PAGINA));
    expect(api.recentes).toHaveBeenCalledTimes(1);

    const seletor = screen.getByLabelText('Ordenação');
    fireEvent.change(seletor, { target: { value: 'a-z' } });
    await waitFor(() => expect(nomesNaTela()[0]).toBe('a.md'));

    fireEvent.change(seletor, { target: { value: 'z-a' } });
    await waitFor(() => expect(nomesNaTela()[0]).toBe('l.md'));

    // Duas reordenações e nenhuma consulta a mais: o canal de reordenação
    // responde a partir do conjunto já obtido.
    expect(api.recentes).toHaveBeenCalledTimes(1);
    expect(api.buscar).not.toHaveBeenCalled();
    expect(api.reordenar).toHaveBeenCalledTimes(2);
  });

  it('volta à primeira página ao trocar o critério fora dela', async () => {
    render(<App />);
    await waitFor(() => expect(nomesNaTela()).toHaveLength(POR_PAGINA));

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Ordenação'), { target: { value: 'a-z' } });

    // Reorganizado o resultado, a página 2 de antes não guarda relação com a
    // de agora: permanecer nela deixaria o usuário num recorte sem sentido.
    await waitFor(() => {
      const enviado = api.reordenar.mock.calls.at(-1)![0] as { pagina?: number };
      expect(enviado.pagina).toBe(1);
    });
    await waitFor(() => expect(nomesNaTela()[0]).toBe('a.md'));
    expect(api.buscar).not.toHaveBeenCalled();
  });

  it('alterar outro filtro continua disparando nova consulta', async () => {
    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toHaveLength(POR_PAGINA));
    expect(api.recentes).toHaveBeenCalledTimes(1);

    // Extensão é filtro de consulta: a especificação exige ir às fontes.
    const tipo = document.querySelectorAll('.filtros select')[0]!;
    fireEvent.change(tipo, { target: { value: 'pdf' } });

    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(2));
  });
});

describe('persistência do critério de ordenação', () => {
  it('mantém o critério escolhido quando outro filtro recarrega a lista', async () => {
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Ordenação'), { target: { value: 'a-z' } });
    await waitFor(() => expect(api.reordenar).toHaveBeenCalled());

    // Alterar a extensão recarrega a lista: o critério escolhido tem de ir junto.
    const tipo = document.querySelectorAll('.filtros select')[0]!;
    fireEvent.change(tipo, { target: { value: 'pdf' } });

    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(2));

    const filtrosEnviados = api.recentes.mock.calls[1]![0] as { ordenacao: string };
    expect(filtrosEnviados.ordenacao).toBe('a-z');
  });
});
