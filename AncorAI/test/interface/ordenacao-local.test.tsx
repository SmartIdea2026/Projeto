import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';

/**
 * Reordenação sem nova consulta às fontes.
 *
 * A especificação de busca exige que trocar o critério de ordenação reorganize
 * os resultados já obtidos, e não dispare consulta. A regra tem custo real por
 * trás: cada consulta ao GitHub gasta cota e faz o usuário esperar por algo que
 * é reordenação local de uma lista já presente na tela.
 */

function doc(nome: string, data: string): Documento {
  return {
    id: `github:o/r:${nome}`,
    nome,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: data,
    link: `https://github.com/o/r/blob/main/${nome}`
  };
}

const RECENTES: ResultadoBusca = {
  documentos: [
    doc('banana.md', '2026-08-01T00:00:00Z'),
    doc('abacate.md', '2026-03-01T00:00:00Z')
  ],
  falhas: [],
  avisos: [],
  doCache: false
};

const CONECTADO: StatusFonte[] = [{ fonte: 'github', estado: 'conectada', conta: 'equipe' }];

const api = {
  status: vi.fn(async () => CONECTADO),
  recentesDoCache: vi.fn(async () => null),
  recentes: vi.fn(async () => RECENTES),
  buscar: vi.fn(async () => RECENTES),
  verificarCredenciais: vi.fn(),
  definirCredencial: vi.fn(),
  removerCredencial: vi.fn(),
  detalharDocumentos: vi.fn(async (docs: unknown[]) => docs),
  abrirDocumento: vi.fn(),
  documentosAcessados: vi.fn(async () => [])
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'ancorai', { value: api, writable: true, configurable: true });
});

function nomesNaTela(): string[] {
  return Array.from(document.querySelectorAll('.cartao__nome')).map(
    (elemento) => elemento.textContent ?? ''
  );
}

describe('troca do critério de ordenação', () => {
  it('reordena a lista sem consultar as fontes de novo', async () => {
    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toHaveLength(2));
    expect(api.recentes).toHaveBeenCalledTimes(1);

    const seletor = screen.getByLabelText('Ordenação');

    fireEvent.change(seletor, { target: { value: 'a-z' } });
    await waitFor(() => expect(nomesNaTela()).toEqual(['abacate.md', 'banana.md']));

    fireEvent.change(seletor, { target: { value: 'z-a' } });
    await waitFor(() => expect(nomesNaTela()).toEqual(['banana.md', 'abacate.md']));

    // O ponto do teste: duas reordenações, nenhuma consulta adicional.
    expect(api.recentes).toHaveBeenCalledTimes(1);
    expect(api.buscar).not.toHaveBeenCalled();
  });

  it('alterar outro filtro continua disparando nova consulta', async () => {
    render(<App />);

    await waitFor(() => expect(nomesNaTela()).toHaveLength(2));
    expect(api.recentes).toHaveBeenCalledTimes(1);

    // Tipo é filtro de consulta: a especificação exige nova consulta às fontes.
    // O rótulo "Tipo:" casa com mais de um nó, então o alvo é o próprio select.
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

    // Alterar o tipo recarrega os recentes: o critério escolhido tem de ir junto.
    const tipo = document.querySelectorAll('.filtros select')[0]!;
    fireEvent.change(tipo, { target: { value: 'pdf' } });

    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(2));

    const filtrosEnviados = api.recentes.mock.calls[1]![0] as { ordenacao: string };
    expect(filtrosEnviados.ordenacao).toBe('a-z');
  });
});
