import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Controle "Buscar no conteúdo".
 *
 * A busca no conteúdo alcança todo documento que mencione o termo no corpo, e
 * nem sempre é isso que se procura — então ela é ligada sob demanda, não por
 * padrão. Aqui se verifica que a busca padrão não pede o conteúdo e que acionar
 * o botão de alternância refaz a consulta pedindo-o.
 */

const RESULTADO: ResultadoBusca = {
  documentos: [
    {
      id: 'github:org/repo:ata.md',
      nome: 'ata.md',
      extensao: 'md',
      fonte: 'github',
      dataModificacao: '2026-08-27T12:00:00Z',
      link: 'https://github.com/org/repo/blob/main/ata.md',
      repositorio: 'org/repo',
      versaoConteudo: 'sha-1'
    }
  ],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

beforeEach(() => vi.clearAllMocks());

const ROTULO = /buscar no conteúdo/i;

describe('busca no conteúdo é opt-in', () => {
  it('a busca padrão não pede o conteúdo', async () => {
    const api = montarApi(RESULTADO);
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'ata' }
    });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
    const filtros = api.buscar.mock.calls.at(-1)?.[0];
    expect(filtros.buscarConteudo).toBeFalsy();
  });

  it('acionar o botão refaz a consulta pedindo o conteúdo', async () => {
    const api = montarApi(RESULTADO);
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'ata' }
    });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(api.buscar).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: ROTULO }));

    await waitFor(() => {
      const filtros = api.buscar.mock.calls.at(-1)?.[0];
      expect(filtros.buscarConteudo).toBe(true);
    });
  });

  it('o botão começa desligado', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: ROTULO })).toBeInTheDocument());

    expect(screen.getByRole('button', { name: ROTULO })).toHaveAttribute('aria-pressed', 'false');
  });
});
