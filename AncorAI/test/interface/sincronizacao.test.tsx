import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotaoSincronizar } from '../../src/renderer/componentes/BotaoSincronizar';
import { App } from '../../src/renderer/App';
import type {
  EstadoSincronizacao,
  MotivoSuspensao,
  ResultadoBusca,
  RetratoSincronizacao
} from '../../src/compartilhado/tipos';
import { montarApi, instalarApi } from './apoio';

/**
 * Botão de sincronização do acervo, no cabeçalho.
 *
 * O que se verifica: que o clique dispara a varredura, que os quatro estados
 * têm apresentação distinta, que o acompanhamento é por consulta em intervalo e
 * cessa fora de `em-andamento`, que um clique durante uma varredura não inicia
 * outra, e que a falha da sincronização não derruba a busca.
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

function retrato(
  estado: EstadoSincronizacao,
  extras: Partial<RetratoSincronizacao> = {}
): RetratoSincronizacao {
  return {
    estado,
    total: 0,
    ingeridos: 0,
    reaproveitados: 0,
    semTexto: 0,
    falhas: 0,
    suspensa: estado === 'suspensa',
    ...extras
  };
}

const NOME_BOTAO = /sincronizar o acervo/i;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('disparo da sincronização', () => {
  it('o clique aciona o canal de indexação', async () => {
    const api = montarApi(RESULTADO, {
      estadoSincronizacao: vi.fn(async () => retrato('parada'))
    });
    instalarApi(api);
    render(<BotaoSincronizar />);

    fireEvent.click(await screen.findByRole('button', { name: NOME_BOTAO }));

    await waitFor(() => expect(api.indexarConteudo).toHaveBeenCalledTimes(1));
  });
});

describe('estados do botão', () => {
  it('parada: acionável, sem nota de estado', async () => {
    instalarApi(
      montarApi(RESULTADO, { estadoSincronizacao: vi.fn(async () => retrato('parada')) })
    );
    render(<BotaoSincronizar />);

    const botao = await screen.findByRole('button', { name: NOME_BOTAO });
    expect(botao).toBeEnabled();
    expect(botao).toHaveTextContent('Sincronizar');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('em andamento: progresso em contagens, não acionável', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        estadoSincronizacao: vi.fn(async () =>
          retrato('em-andamento', {
            total: 5,
            ingeridos: 2,
            reaproveitados: 1,
            semTexto: 1,
            falhas: 0
          })
        )
      })
    );
    render(<BotaoSincronizar />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: NOME_BOTAO })).toBeDisabled()
    );
    expect(screen.getByRole('button', { name: NOME_BOTAO })).toHaveTextContent(
      'Sincronizando… 4/5'
    );
    // As cinco contagens da spec, sem texto de documento.
    expect(
      screen.getByText(
        /5 documento\(s\): 2 com texto obtido, 1 reaproveitado\(s\), 1 sem texto, 0 falha\(s\)/
      )
    ).toBeInTheDocument();
  });

  it('concluída: acionável, com a nota de conclusão e as contagens', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        estadoSincronizacao: vi.fn(async () =>
          retrato('concluida', { total: 5, ingeridos: 4, reaproveitados: 1 })
        )
      })
    );
    render(<BotaoSincronizar />);

    await waitFor(() =>
      expect(screen.getByText(/acervo sincronizado/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: NOME_BOTAO })).toBeEnabled();
    expect(
      screen.getByText(/5 documento\(s\): 4 com texto obtido, 1 reaproveitado/)
    ).toBeInTheDocument();
  });

  it('suspensa: motivo visível, acionável para tentar de novo', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        estadoSincronizacao: vi.fn(async () =>
          retrato('suspensa', { motivoSuspensao: 'sem-credencial' as MotivoSuspensao })
        )
      })
    );
    render(<BotaoSincronizar />);

    await waitFor(() =>
      expect(screen.getByText(/configure o token do github/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: NOME_BOTAO })).toBeEnabled();
  });
});

describe('acompanhamento por consulta', () => {
  it('consulta enquanto em-andamento e para quando o estado deixa de ser em-andamento', async () => {
    vi.useFakeTimers();
    let n = 0;
    const estadoSincronizacao = vi.fn(async () => {
      n += 1;
      return n < 3
        ? retrato('em-andamento', { total: 4, ingeridos: n })
        : retrato('concluida', { total: 4, ingeridos: 4 });
    });
    instalarApi(montarApi(RESULTADO, { estadoSincronizacao }));
    render(<BotaoSincronizar />);

    // Consulta ao montar.
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(estadoSincronizacao).toHaveBeenCalledTimes(1);

    // Cada intervalo dispara uma reconsulta enquanto o estado for em-andamento.
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(estadoSincronizacao).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(estadoSincronizacao).toHaveBeenCalledTimes(3);

    // A terceira resposta veio "concluida": nenhuma consulta a mais.
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(estadoSincronizacao).toHaveBeenCalledTimes(3);
  });
});

describe('uma sincronização de cada vez', () => {
  it('acionar o botão durante uma varredura não inicia outra', async () => {
    const api = montarApi(RESULTADO, {
      estadoSincronizacao: vi.fn(async () =>
        retrato('em-andamento', { total: 3, ingeridos: 1 })
      )
    });
    instalarApi(api);
    render(<BotaoSincronizar />);

    const botao = await screen.findByRole('button', { name: NOME_BOTAO });
    await waitFor(() => expect(botao).toBeDisabled());

    fireEvent.click(botao);

    expect(api.indexarConteudo).not.toHaveBeenCalled();
    // A interface reflete que já há uma sincronização em curso.
    expect(botao).toHaveTextContent('Sincronizando… 1/3');
  });
});

describe('aviso de alcance parcial da busca pelo conteúdo', () => {
  it('é apresentado pelo mesmo caminho dos demais avisos de resultado parcial', async () => {
    const comAviso: ResultadoBusca = {
      ...RESULTADO,
      avisos: [
        {
          fonte: 'github',
          mensagem:
            'A busca pelo conteúdo alcançou parte do acervo: 3 documento(s) ' +
            'ainda sem texto sincronizado foram procurados apenas por nome e autor.'
        }
      ]
    };
    const api = montarApi(RESULTADO, { buscar: vi.fn(async () => comAviso) });
    instalarApi(api);
    render(<App />);

    // Deixa a carga inicial (recentes) assentar antes de buscar, senão a
    // resposta atrasada dela sobrescreve o resultado da busca.
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'ata' }
    });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
    const aviso = await screen.findByText(/alcançou parte do acervo/i);
    expect(aviso.closest('.aviso--info')).not.toBeNull();
    expect(aviso.closest('.aviso--info')).toHaveTextContent('Resultado parcial:');
  });
});

describe('a sincronização não derruba a busca', () => {
  it('busca e lista seguem utilizáveis quando a sincronização é suspensa', async () => {
    const api = montarApi(RESULTADO, {
      estadoSincronizacao: vi.fn(async () =>
        retrato('suspensa', { motivoSuspensao: 'falha-inventario' as MotivoSuspensao })
      ),
      indexarConteudo: vi.fn(async () => {
        throw new Error('A sincronização falhou.');
      })
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() => expect(document.querySelectorAll('.cartao')).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'ata' }
    });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
    expect(document.querySelectorAll('.cartao')).toHaveLength(1);
    expect(
      screen.getByText(/não foi possível obter a lista de documentos/i)
    ).toBeInTheDocument();
  });
});
