import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';
import { CONECTADO, montarApi, instalarApi } from './apoio';

/**
 * Ordem de tabulação e alcance por teclado (ui-spec, seção 5).
 *
 * O que este arquivo verifica de fato: que não existe `tabindex` positivo — e
 * portanto a ordem de tabulação é a ordem do DOM —, que a sequência do DOM
 * corresponde à leitura visual da tela, e que o diálogo de configurações
 * recebe, confina e devolve o foco.
 *
 * O que ele NÃO verifica: a travessia nativa do Tab entre elementos e a
 * aparência do indicador de foco. O jsdom não move o foco sozinho ao teclar
 * Tab, então o confinamento é exercitado pelo manipulador, e não pelo
 * comportamento do navegador. A conferência com teclado real continua
 * necessária para essas duas coisas.
 */

const documento: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://github.com/o/r/blob/main/ata.md'
};

const RECENTES: ResultadoBusca = {
  documentos: [documento],
  falhas: [],
  avisos: [],
  doCache: false
};

const api = montarApi(RECENTES);

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

beforeEach(() => {
  vi.clearAllMocks();
  instalarApi(api);
});

function focaveis(raiz: ParentNode = document): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
}

describe('ordem de tabulação da tela principal', () => {
  it('não usa tabindex positivo, então a ordem é a do documento', async () => {
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    const positivos = Array.from(document.querySelectorAll('[tabindex]')).filter(
      (elemento) => Number(elemento.getAttribute('tabindex')) > 0
    );

    // tabindex positivo cria uma ordem paralela à do documento e é a causa
    // mais comum de tabulação que não acompanha a leitura visual.
    expect(positivos).toEqual([]);
  });

  it('segue a leitura visual: cabeçalho, busca, filtros e depois os resultados', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());
    // O painel chega depois da lista, quando o resumo resolve. Medir antes
    // disso mediria uma tela intermediária que o usuário mal chega a ver.
    await waitFor(() => expect(document.querySelector('.painel')).not.toBeNull());

    /** Região da tela a que o elemento pertence, pelo contêiner que o envolve. */
    const regiaoDe = (elemento: HTMLElement): string => {
      if (elemento.closest('.conexoes')) return 'cabecalho';
      if (elemento.closest('.busca')) return 'busca';
      if (elemento.closest('.filtros')) return 'filtros';
      if (elemento.closest('.linha-lista')) return 'ordenacao';
      if (elemento.closest('.cartao')) return 'resultados';
      if (elemento.closest('.painel')) return 'painel';
      if (elemento.closest('.paginacao')) return 'paginacao';
      return 'outro';
    };

    // A ordem do DOM é a ordem de tabulação, já que não há tabindex positivo.
    // A ordenação fica entre os filtros e a lista, à direita do contador,
    // conforme o protótipo — e a tabulação acompanha essa leitura.
    //
    // Os filtros são dois: a extensão e o botão de período. Os campos de data
    // vivem dentro do painel do período e só entram na tabulação quando ele
    // está aberto, que é o comportamento correto para conteúdo recolhido.
    //
    // Cada resultado tem duas ações — gerar resumo e abrir na fonte — e o
    // painel de resumo vem depois da lista, que é onde ele aparece na tela.
    expect(focaveis().map(regiaoDe)).toEqual([
      'cabecalho',
      'busca',
      'busca',
      'filtros',
      'filtros',
      'ordenacao',
      'resultados',
      'resultados',
      'painel'
    ]);
  });

  it('o campo da chave de IA entra na tabulação do diálogo, na ordem visual', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /GitHub conectada/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dentro = focaveis(screen.getByRole('dialog'));
    const rotulos = dentro.map((elemento) =>
      elemento.tagName === 'INPUT'
        ? (elemento.getAttribute('placeholder') ?? '')
        : (elemento.textContent ?? '').trim()
    );

    // GitHub vem antes da IA, como na tela; e o botão de fechar, por último.
    expect(rotulos.indexOf('ghp_…')).toBeLessThan(
      rotulos.indexOf('Cole a chave do Google AI Studio')
    );
    expect(rotulos.at(-1)).toBe('Fechar');
  });

  it('o campo de busca recebe o foco na abertura', async () => {
    render(<App />);

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Buscar pelo nome do documento'
      )
    );
  });

  it('todo resultado é alcançável por teclado', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());

    const cartao = document.querySelector('.cartao')!;
    expect(focaveis(cartao).length).toBeGreaterThan(0);
  });
});

describe('foco no diálogo de configurações', () => {
  async function abrirDialogo() {
    render(<App />);
    await waitFor(() => expect(api.recentes).toHaveBeenCalled());

    const gatilho = document.querySelector<HTMLElement>('.conexao')!;
    gatilho.focus();
    fireEvent.click(gatilho);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    return gatilho;
  }

  it('leva o foco para dentro ao abrir', async () => {
    await abrirDialogo();

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it('confina a tabulação: do último volta ao primeiro', async () => {
    await abrirDialogo();

    const dialogo = screen.getByRole('dialog');
    const dentro = focaveis(dialogo);
    const primeiro = dentro[0]!;
    const ultimo = dentro[dentro.length - 1]!;

    ultimo.focus();
    fireEvent.keyDown(dialogo, { key: 'Tab' });

    expect(document.activeElement).toBe(primeiro);
  });

  it('confina a tabulação: Shift+Tab do primeiro vai ao último', async () => {
    await abrirDialogo();

    const dialogo = screen.getByRole('dialog');
    const dentro = focaveis(dialogo);
    const primeiro = dentro[0]!;
    const ultimo = dentro[dentro.length - 1]!;

    primeiro.focus();
    fireEvent.keyDown(dialogo, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(ultimo);
  });

  it('fecha com Escape e devolve o foco a quem o abriu', async () => {
    const gatilho = await abrirDialogo();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(gatilho);
  });
});
