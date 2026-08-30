import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';
import { CONECTADO, montarApi, instalarApi } from './apoio';

/**
 * Filtro de período em painel suspenso.
 *
 * Os dois campos de data ficavam soltos na barra de filtros. Cada um carrega o
 * próprio ícone de calendário, ancorado à direita pelo navegador, e lado a lado
 * o ícone acabava longe do rótulo a que pertence. Recolhidos num painel, os
 * campos ganham rótulo visível e o ícone fica junto do que controla.
 */

const doc: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://exemplo/ata'
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
  instalarApi(api);
});

async function abrirApp() {
  render(<App />);
  await waitFor(() => expect(api.recentes).toHaveBeenCalled());
  return screen.getByRole('button', { name: /Período/ });
}

describe('painel de período', () => {
  it('mantém os campos de data recolhidos até o botão ser acionado', async () => {
    await abrirApp();

    // Sem o painel aberto, os campos não ocupam a barra nem a tabulação.
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Até')).not.toBeInTheDocument();
  });

  it('abre o painel com os dois campos rotulados', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);

    expect(screen.getByLabelText('De')).toBeInTheDocument();
    expect(screen.getByLabelText('Até')).toBeInTheDocument();
    expect(screen.getByText('Período (modificação)')).toBeInTheDocument();
  });

  it('anuncia o estado de expansão para tecnologias assistivas', async () => {
    const botao = await abrirApp();
    expect(botao).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
  });

  it('aplica a data escolhida como filtro de consulta', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-08-01' } });

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as { dataInicial?: string };
      expect(ultima.dataInicial).toBe('2026-08-01');
    });
  });

  it('limpa as duas datas pelo botão do painel', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-08-01' } });

    await waitFor(() => expect(api.recentes).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as { dataInicial?: string };
      expect(ultima.dataInicial).toBeUndefined();
    });
  });

  it('desabilita Limpar filtros quando não há período aplicado', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);

    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  it('fecha com Escape e devolve o foco ao botão', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);
    expect(screen.getByLabelText('De')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText('De'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByLabelText('De')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(botao);
  });

  it('fecha ao clicar fora do painel', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);
    expect(screen.getByLabelText('De')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByLabelText('De')).not.toBeInTheDocument());
  });

  it('assinala o botão como ativo quando há período aplicado', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-08-01' } });

    // O estado ativo não depende só de cor: a classe muda borda e marcador.
    await waitFor(() => expect(botao.className).toContain('filtro--ativo'));
  });

  it('mostra o erro de período mesmo com o painel fechado', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-08-01' } });

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));

    fireEvent.mouseDown(document.body);

    // Fechar o painel não pode esconder o motivo de a busca não responder.
    await waitFor(() => expect(screen.queryByLabelText('De')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

/**
 * Alcance do filtro de período.
 *
 * A rota da coleta — janela de recentes ou acervo — é decidida no processo
 * principal, por `exigeAcervo`, e coberta por `test/busca/paginacao.test.ts`.
 * O que cabe verificar aqui é o lado da interface do mesmo contrato: o período
 * chega à consulta, limpá-lo devolve a tela aos recentes, e a espera é
 * sinalizada enquanto o acervo é percorrido.
 */
describe('período e a consulta ao acervo', () => {
  it('leva o período à consulta e o retira ao limpar', async () => {
    const botao = await abrirApp();
    fireEvent.click(botao);

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-01-31' } });

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as {
        dataInicial?: string;
        dataFinal?: string;
        termo: string;
      };
      expect(ultima.dataInicial).toBe('2026-01-01');
      expect(ultima.dataFinal).toBe('2026-01-31');
      // Sem termo: é o período, sozinho, que exige o acervo.
      expect(ultima.termo).toBe('');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    await waitFor(() => {
      const ultima = api.recentes.mock.calls.at(-1)![0] as {
        dataInicial?: string;
        dataFinal?: string;
      };
      expect(ultima.dataInicial).toBeUndefined();
      expect(ultima.dataFinal).toBeUndefined();
    });

    // A tela volta aos recentes: nenhuma busca por termo foi disparada.
    expect(api.buscar).not.toHaveBeenCalled();
  });

  it('apresenta o indicador de carregamento durante a consulta e o remove ao final', async () => {
    let liberar: (valor: ResultadoBusca) => void = () => {};
    const botao = await abrirApp();
    fireEvent.click(botao);

    api.recentes.mockImplementationOnce(
      () =>
        new Promise<ResultadoBusca>((resolve) => {
          liberar = resolve;
        })
    );

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });

    await waitFor(() =>
      expect(document.querySelectorAll('.esqueleto').length).toBeGreaterThan(0)
    );

    liberar(RESULTADO);

    await waitFor(() => expect(document.querySelectorAll('.esqueleto')).toHaveLength(0));
    // O nome aparece no cartão e também no painel de resumo: a busca é pelo
    // cartão, que é o que a lista de resultados apresenta.
    expect(document.querySelector('.cartao__nome')?.textContent).toBe('ata.md');
  });
});
