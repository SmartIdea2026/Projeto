import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Filtro por categoria (categorizar-documentos-pelo-resumo).
 *
 * Dropdown de seleção única, populado dinamicamente com as categorias já
 * atribuídas no acervo pelo resumo por IA — ao contrário da extensão, que é
 * uma lista fixa. O que se verifica aqui: a lista aparece, selecionar uma
 * categoria entra na consulta, limpar volta à listagem completa, e reabrir o
 * dropdown busca a lista de novo (para refletir resumos gerados nesse
 * meio-tempo).
 */

const doc: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://exemplo/ata',
  categoria: 'Ata'
};

const RESULTADO: ResultadoBusca = {
  documentos: [doc],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

const api = montarApi(RESULTADO);

beforeEach(() => {
  vi.clearAllMocks();
  api.recentes.mockResolvedValue(RESULTADO);
  api.categoriasDisponiveis.mockResolvedValue(['Ata', 'Contrato']);
  instalarApi(api);
});

async function abrirApp() {
  render(<App />);
  await waitFor(() => expect(api.recentes).toHaveBeenCalled());
  await waitFor(() => expect(api.categoriasDisponiveis).toHaveBeenCalled());
  return screen.getByLabelText('Categoria:') as HTMLSelectElement;
}

describe('dropdown de categoria', () => {
  it('busca as categorias ao montar e as apresenta como opções', async () => {
    const select = await abrirApp();

    expect(screen.getByRole('option', { name: 'Ata' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Contrato' })).toBeInTheDocument();
    expect(select.value).toBe('');
  });

  it('não apresenta o filtro como ativo antes de qualquer seleção', async () => {
    const select = await abrirApp();

    expect(select.closest('label')?.className).not.toContain('filtro--ativo');
  });

  it('busca a lista de novo ao receber foco, refletindo resumos gerados nesse meio-tempo', async () => {
    const select = await abrirApp();
    api.categoriasDisponiveis.mockResolvedValueOnce(['Ata', 'Contrato', 'Edital']);

    fireEvent.focus(select);

    await waitFor(() => expect(api.categoriasDisponiveis).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Edital' })).toBeInTheDocument()
    );
  });
});

describe('seleção de categoria', () => {
  it('leva a categoria escolhida à consulta', async () => {
    const select = await abrirApp();

    fireEvent.change(select, { target: { value: 'Ata' } });

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as { categoria?: string };
      expect(ultima.categoria).toBe('Ata');
    });
  });

  it('assinala o filtro como ativo quando uma categoria está selecionada', async () => {
    const select = await abrirApp();

    fireEvent.change(select, { target: { value: 'Ata' } });

    await waitFor(() => expect(select.closest('label')?.className).toContain('filtro--ativo'));
  });

  it('volta à listagem completa ao limpar a categoria (selecionar "todas")', async () => {
    const select = await abrirApp();
    fireEvent.change(select, { target: { value: 'Ata' } });
    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(2));

    fireEvent.change(select, { target: { value: '' } });

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as { categoria?: string };
      expect(ultima.categoria).toBeUndefined();
    });
  });

  it('o contador de resultados aparece só com categoria selecionada', async () => {
    await abrirApp();

    expect(screen.queryByText(/resultado\(s\)/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria:'), { target: { value: 'Ata' } });

    await waitFor(() => expect(screen.getByText('1 resultado(s)')).toBeInTheDocument());
  });
});
