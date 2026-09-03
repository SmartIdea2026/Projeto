import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi, VOZ_PRONTA, VOZ_INATIVA } from './apoio';
import { iniciarCaptura, type ResultadoCaptura } from '../../src/renderer/audio/captura';

/**
 * Ditado na busca (openspec/specs/busca-por-voz).
 *
 * O módulo de captura é dublado — jsdom não grava áudio. O foco: o microfone só
 * aparece com o recurso ativo e o modelo pronto; a transcrição **preenche o
 * campo e não busca**; e silêncio/falha não mexem no campo.
 */

const { ErroPermissaoMicrofone } = await vi.importActual<
  typeof import('../../src/renderer/audio/captura')
>('../../src/renderer/audio/captura');

let resultadoCaptura: ResultadoCaptura | Promise<ResultadoCaptura> = {
  motivo: 'silencio',
  pcm: new ArrayBuffer(16)
};
let lancarNaCaptura: Error | null = null;
const parar = vi.fn();
const cancelar = vi.fn();

vi.mock('../../src/renderer/audio/captura', async () => {
  const real = await vi.importActual<typeof import('../../src/renderer/audio/captura')>(
    '../../src/renderer/audio/captura'
  );
  return {
    ...real,
    solicitarPermissaoMicrofone: vi.fn(async () => true),
    iniciarCaptura: vi.fn(async () => {
      if (lancarNaCaptura) throw lancarNaCaptura;
      return { parar, cancelar, resultado: Promise.resolve(resultadoCaptura) };
    })
  };
});

const documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github' as const,
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://github.com/o/r/blob/main/ata.md'
};
const RECENTES: ResultadoBusca = { documentos: [documento], falhas: [], avisos: [], doCache: false };

function micVisivel() {
  return screen.queryByRole('button', { name: /ditar o termo de busca/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  lancarNaCaptura = null;
  resultadoCaptura = { motivo: 'silencio', pcm: new ArrayBuffer(16) };
});

describe('presença do microfone', () => {
  it('não aparece com a busca por voz desligada', async () => {
    instalarApi(montarApi(RECENTES, { estadoVoz: vi.fn(async () => VOZ_INATIVA) }));
    render(<App />);
    await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());
    expect(micVisivel()).toBeNull();
  });

  it('aparece com a busca por voz ativa e o modelo pronto', async () => {
    instalarApi(montarApi(RECENTES, { estadoVoz: vi.fn(async () => VOZ_PRONTA) }));
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());
  });

  it('aparece desabilitado quando a permissão foi negada', async () => {
    instalarApi(
      montarApi(RECENTES, {
        estadoVoz: vi.fn(async () => ({ ...VOZ_PRONTA, permissao: 'negada' as const }))
      })
    );
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());
    expect(micVisivel()).toBeDisabled();
    expect(micVisivel()).toHaveAttribute('title', expect.stringMatching(/microfone/i));
  });
});

describe('fluxo do ditado', () => {
  async function abrirComMic() {
    instalarApi(
      montarApi(RECENTES, { estadoVoz: vi.fn(async () => VOZ_PRONTA) })
    );
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());
  }

  it('transcreve, preenche o campo e NÃO dispara a busca', async () => {
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_PRONTA),
      transcreverVoz: vi.fn(async () => ({ texto: 'roadmap de setembro' }))
    });
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    const chamadasBuscaAntes = api.buscar.mock.calls.length;
    fireEvent.click(micVisivel()!);

    const campo = screen.getByLabelText('Buscar pelo nome do documento') as HTMLInputElement;
    await waitFor(() => expect(campo.value).toBe('roadmap de setembro'));
    expect(document.activeElement).toBe(campo);
    expect(api.buscar.mock.calls.length).toBe(chamadasBuscaAntes);
  });

  it('substitui o texto já digitado no campo', async () => {
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_PRONTA),
      transcreverVoz: vi.fn(async () => ({ texto: 'novo termo' }))
    });
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    const campo = screen.getByLabelText('Buscar pelo nome do documento') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'digitado antes' } });
    fireEvent.click(micVisivel()!);
    await waitFor(() => expect(campo.value).toBe('novo termo'));
  });

  it('silêncio: avisa e não mexe no campo', async () => {
    resultadoCaptura = { motivo: 'silencio', pcm: new ArrayBuffer(16) };
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_PRONTA),
      transcreverVoz: vi.fn(async () => ({ texto: null, motivo: 'vazio' as const }))
    });
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    const campo = screen.getByLabelText('Buscar pelo nome do documento') as HTMLInputElement;
    fireEvent.click(micVisivel()!);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/não ouvi nada/i));
    expect(campo.value).toBe('');
  });

  it('falha na transcrição: avisa e não mexe no campo', async () => {
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_PRONTA),
      transcreverVoz: vi.fn(async () => ({ texto: null, motivo: 'falha-transcricao' as const }))
    });
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    fireEvent.click(micVisivel()!);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/não foi possível transcrever/i)
    );
  });

  it('permissão negada no clique: avisa e recarrega o estado da voz', async () => {
    lancarNaCaptura = new ErroPermissaoMicrofone();
    const estadoVoz = vi
      .fn()
      .mockResolvedValueOnce(VOZ_PRONTA)
      .mockResolvedValue({ ...VOZ_PRONTA, permissao: 'negada' });
    instalarApi(montarApi(RECENTES, { estadoVoz }));
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    fireEvent.click(micVisivel()!);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/permita o microfone/i)
    );
    expect(estadoVoz.mock.calls.length).toBeGreaterThan(1);
  });

  it('primeiro uso: o clique abre o modal de consentimento em vez de gravar', async () => {
    const semConsentimento = { ...VOZ_PRONTA, microfoneConsentido: false };
    instalarApi(montarApi(RECENTES, { estadoVoz: vi.fn(async () => semConsentimento) }));
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    fireEvent.click(micVisivel()!);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /usar o microfone/i })).toBeInTheDocument()
    );
    expect(iniciarCaptura).not.toHaveBeenCalled();
  });

  it('permitir no modal registra o consentimento e segue para a captura', async () => {
    const semConsentimento = { ...VOZ_PRONTA, microfoneConsentido: false };
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => semConsentimento),
      ajustarMicrofoneVoz: vi.fn(async () => VOZ_PRONTA),
      transcreverVoz: vi.fn(async () => ({ texto: 'ata de agosto' }))
    });
    resultadoCaptura = { motivo: 'manual', pcm: new ArrayBuffer(16) };
    instalarApi(api);
    render(<App />);
    await waitFor(() => expect(micVisivel()).not.toBeNull());

    fireEvent.click(micVisivel()!);
    fireEvent.click(await screen.findByRole('button', { name: /permitir o microfone/i }));

    await waitFor(() =>
      expect(api.ajustarMicrofoneVoz).toHaveBeenCalledWith({ consentido: true })
    );
    const campo = screen.getByLabelText('Buscar pelo nome do documento') as HTMLInputElement;
    await waitFor(() => expect(campo.value).toBe('ata de agosto'));
  });

  it('durante a escuta o botão vira "parar" e anuncia o estado', async () => {
    // resultado que nunca resolve: a captura fica "escutando"
    resultadoCaptura = new Promise<ResultadoCaptura>(() => undefined);
    await abrirComMic();

    fireEvent.click(micVisivel()!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /parar de ditar/i })).toBeInTheDocument()
    );
    expect(screen.getByRole('status')).toHaveTextContent(/ouvindo/i);

    fireEvent.click(screen.getByRole('button', { name: /parar de ditar/i }));
    expect(parar).toHaveBeenCalled();
  });
});
