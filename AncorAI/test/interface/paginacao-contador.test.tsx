import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';

/**
 * Paginação e contador na interface.
 *
 * O contador informa o total encontrado, não o tamanho da página — a distinção
 * é a razão de ele existir. E some quando não há consulta ativa, porque na tela
 * inicial de recentes o número não responde a pergunta nenhuma.
 */

function doc(n: number): Documento {
  return {
    id: `github:o/r:doc${n}.md`,
    nome: `doc${n}.md`,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-01T00:00:00Z',
    link: `https://exemplo/${n}`
  };
}

function resultado(qtd: number, total: number, pagina = 1): ResultadoBusca {
  return {
    documentos: Array.from({ length: qtd }, (_, i) => doc(i + (pagina - 1) * 10)),
    total,
    pagina,
    falhas: [],
    avisos: [],
    doCache: false
  };
}

const CONECTADO: StatusFonte[] = [{ fonte: 'github', estado: 'conectada', conta: 'equipe' }];

const api = {
  status: vi.fn(async () => CONECTADO),
  recentesDoCache: vi.fn(async () => null),
  recentes: vi.fn(async () => resultado(10, 10)),
  buscar: vi.fn(async () => resultado(10, 25)),
  verificarCredenciais: vi.fn(),
  definirCredencial: vi.fn(),
  removerCredencial: vi.fn(),
  detalharDocumentos: vi.fn(async (docs: unknown[]) => docs),
  abrirDocumento: vi.fn(),
  documentosAcessados: vi.fn(async () => [])
};

beforeEach(() => {
  vi.clearAllMocks();
  api.recentes.mockResolvedValue(resultado(10, 10));
  api.buscar.mockResolvedValue(resultado(10, 25));
  Object.defineProperty(window, 'ancorai', { value: api, writable: true, configurable: true });
});

async function buscar(termo: string) {
  render(<App />);
  await waitFor(() => expect(api.recentes).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
    target: { value: termo }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(api.buscar).toHaveBeenCalled());
}

describe('contador de resultados', () => {
  it('mostra o total encontrado, e não o tamanho da página', async () => {
    await buscar('doc');
    // 10 na tela, 25 no total: é o total que o contador informa.
    await waitFor(() => expect(screen.getByText('25 resultado(s)')).toBeInTheDocument());
  });

  it('não aparece na tela inicial, sem termo nem filtro', async () => {
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    expect(screen.queryByText(/resultado\(s\)/)).not.toBeInTheDocument();
  });

  it('aparece quando há filtro aplicado sem termo de busca', async () => {
    api.recentes.mockResolvedValue(resultado(3, 3));
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    fireEvent.change(document.querySelectorAll('.filtros select')[0]!, {
      target: { value: 'pdf' }
    });

    await waitFor(() => expect(screen.getByText('3 resultado(s)')).toBeInTheDocument());
  });
});

describe('navegação entre páginas', () => {
  it('aparece quando o resultado excede uma página', async () => {
    await buscar('doc');
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Navegação entre páginas' })).toBeInTheDocument()
    );
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('não aparece quando tudo cabe em uma página', async () => {
    api.buscar.mockResolvedValue(resultado(4, 4));
    await buscar('doc');

    await waitFor(() => expect(screen.getByText('4 resultado(s)')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Navegação entre páginas' })).toBeNull();
  });

  it('avança de página consultando a página pedida', async () => {
    await buscar('doc');
    await waitFor(() => expect(screen.getByText('Página 1 de 3')).toBeInTheDocument());

    api.buscar.mockResolvedValue(resultado(10, 25, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      const ultima = api.buscar.mock.calls.at(-1)![0] as { pagina?: number };
      expect(ultima.pagina).toBe(2);
    });
  });

  it('desabilita Anterior na primeira página', async () => {
    await buscar('doc');
    await waitFor(() => expect(screen.getByText('Página 1 de 3')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('nova busca volta para a primeira página', async () => {
    await buscar('doc');
    await waitFor(() => expect(screen.getByText('Página 1 de 3')).toBeInTheDocument());

    api.buscar.mockResolvedValue(resultado(10, 25, 3));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(api.buscar).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'outro' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      const ultima = api.buscar.mock.calls.at(-1)![0] as { pagina?: number };
      expect(ultima.pagina).toBe(1);
    });
  });

  it('alterar um filtro de consulta volta para a primeira página', async () => {
    await buscar('doc');
    await waitFor(() => expect(screen.getByText('Página 1 de 3')).toBeInTheDocument());

    api.buscar.mockResolvedValue(resultado(10, 25, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(api.buscar).toHaveBeenCalledTimes(2));

    fireEvent.change(document.querySelectorAll('.filtros select')[0]!, {
      target: { value: 'pdf' }
    });

    await waitFor(() => {
      const ultima = api.buscar.mock.calls.at(-1)![0] as { pagina?: number };
      expect(ultima.pagina).toBe(1);
    });
  });
});
