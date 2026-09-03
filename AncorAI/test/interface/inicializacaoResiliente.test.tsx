import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * A lista guardada (`recentesDoCache`) é um atalho para a tela aparecer antes
 * de qualquer requisição — não um requisito da inicialização. Uma falha ali
 * (por exemplo, a corrida de carregamento do acervo em
 * `categorizar-documentos-pelo-resumo`, vista em uso real) não pode travar a
 * tela no estado "carregando" para sempre: o resto da rotina — status das
 * credenciais, foco no campo de busca, recentes ao vivo — precisa seguir.
 */

const documento: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://github.com/o/r/blob/main/ata.md'
};

const RESULTADO: ResultadoBusca = {
  documentos: [documento],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

describe('resiliência da inicialização', () => {
  it('uma falha ao ler os recentes guardados não impede o resto da inicialização', async () => {
    const api = montarApi(RESULTADO, {
      recentesDoCache: vi.fn(async () => {
        throw new Error('falha simulada de leitura do cache');
      })
    });
    instalarApi(api);

    render(<App />);

    // A inicialização segue adiante mesmo com a falha: credenciais
    // verificadas e os recentes buscados ao vivo, como sem a lista guardada.
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());
  });
});
