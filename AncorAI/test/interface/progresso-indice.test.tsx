import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Aviso de indexação em segundo plano (`indice-local`).
 *
 * A busca nunca espera pela classificação por assunto; este aviso só existe
 * para que a ausência de correspondência por contexto, enquanto o acervo
 * ainda está sendo classificado, não pareça um defeito.
 */

function documento(indice: number): Documento {
  return {
    id: `github:org/repo:doc${indice}.md`,
    nome: `doc${indice}.md`,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: `https://github.com/org/repo/blob/main/doc${indice}.md`,
    caminho: `doc${indice}.md`,
    repositorio: 'org/repo',
    versaoConteudo: `sha-${indice}`
  };
}

const RESULTADO: ResultadoBusca = {
  documentos: [documento(1)],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

describe('aviso de indexação em segundo plano', () => {
  it('aparece enquanto a indexação está em andamento', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        progressoIndice: async () => ({
          total: 10,
          classificados: 3,
          reaproveitados: 1,
          semTexto: 0,
          falhas: 0,
          suspensa: false,
          emAndamento: true
        })
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Classificando o acervo por assunto/)).toBeInTheDocument();
    });
    expect(screen.getByText(/4 de 10 documento/)).toBeInTheDocument();
  });

  it('não aparece quando a indexação não está em andamento', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('doc1.md')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Classificando o acervo/)).not.toBeInTheDocument();
  });

  it('a busca continua funcionando com a indexação em andamento', async () => {
    const resultadoDaBusca: ResultadoBusca = {
      documentos: [documento(2)],
      total: 1,
      pagina: 1,
      falhas: [],
      avisos: [],
      doCache: false
    };
    const buscar = async () => resultadoDaBusca;

    instalarApi(
      montarApi(RESULTADO, {
        buscar,
        progressoIndice: async () => ({
          total: 10,
          classificados: 3,
          reaproveitados: 1,
          semTexto: 0,
          falhas: 0,
          suspensa: false,
          emAndamento: true
        })
      })
    );

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Classificando o acervo por assunto/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Buscar pelo nome do documento/), {
      target: { value: 'doc2' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(screen.getByText('doc2.md')).toBeInTheDocument();
    });
    // O aviso de indexação segue no ar: a busca não a interrompeu nem foi
    // bloqueada por ela.
    expect(screen.getByText(/Classificando o acervo por assunto/)).toBeInTheDocument();
  });
});
