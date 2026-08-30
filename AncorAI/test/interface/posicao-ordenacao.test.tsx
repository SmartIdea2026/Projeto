import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Posição do controle de ordenação.
 *
 * O controle governa a lista, não o painel de resumo. Enquanto a linha ocupava
 * a largura da página, alinhá-la à direita a punha acima do painel — sugerindo
 * uma relação que não existe e afastando o controle do que ele de fato altera.
 *
 * O teste é estrutural de propósito: a posição visual depende de a linha viver
 * dentro da coluna dos resultados, e é isso que o CSS toma como premissa.
 */

const doc: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://exemplo/ata'
};

const COM_RESULTADO: ResultadoBusca = {
  documentos: [doc],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

const VAZIO: ResultadoBusca = { ...COM_RESULTADO, documentos: [], total: 0 };

const api = montarApi(COM_RESULTADO);

beforeEach(() => {
  vi.clearAllMocks();
  api.recentes.mockResolvedValue(COM_RESULTADO);
  instalarApi(api);
});

describe('o controle fica junto da lista', () => {
  it('vive na coluna dos resultados, e não acima do painel de resumo', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Ordenação')).toBeInTheDocument());

    // O painel entra depois do primeiro documento: é ele quem o traz ao foco.
    const painel = await waitFor(() =>
      screen.getByRole('complementary', { name: 'Resumo do documento em foco' })
    );
    const coluna = document.querySelector('.coluna-resultados');
    const ordenacao = document.querySelector('.ordenacao');

    expect(coluna?.contains(ordenacao!)).toBe(true);
    // O painel é irmão da coluna: o controle não paira sobre ele.
    expect(coluna?.contains(painel)).toBe(false);
    expect(painel.parentElement?.className).toContain('area-resultados');
  });

  it('a linha precede a lista dentro da coluna', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Ordenação')).toBeInTheDocument());

    const filhos = Array.from(document.querySelector('.coluna-resultados')!.children);
    expect(filhos[0]?.className).toContain('linha-lista');
    expect(filhos[1]?.className).toContain('lista');
  });
});

describe('estados em que o controle não aparece', () => {
  it('não aparece enquanto a consulta está em andamento', async () => {
    api.recentes.mockImplementation(() => new Promise<ResultadoBusca>(() => {}));

    render(<App />);

    await waitFor(() =>
      expect(document.querySelectorAll('.esqueleto').length).toBeGreaterThan(0)
    );
    expect(screen.queryByLabelText('Ordenação')).not.toBeInTheDocument();
  });

  it('não aparece quando a consulta não retorna documento algum', async () => {
    api.recentes.mockResolvedValue(VAZIO);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Nenhum documento encontrado')).toBeInTheDocument()
    );
    expect(screen.queryByLabelText('Ordenação')).not.toBeInTheDocument();
  });
});

describe('alcance pelo teclado', () => {
  it('é identificado por rótulo acessível e recebe o foco', async () => {
    render(<App />);
    const seletor = await waitFor(() => screen.getByLabelText('Ordenação'));

    seletor.focus();

    expect(document.activeElement).toBe(seletor);
    expect(seletor.tagName).toBe('SELECT');
  });
});
