import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { EstadoVoz, ResultadoBusca } from '../../src/compartilhado/tipos';
import { montarApi, instalarApi, VOZ_INATIVA, VOZ_PRONTA } from './apoio';
import { enumerarMicrofones } from '../../src/renderer/audio/captura';

// jsdom não tem Web Audio nem enumeração de dispositivos — dublados aqui.
vi.mock('../../src/renderer/audio/captura', async () => {
  const real = await vi.importActual<typeof import('../../src/renderer/audio/captura')>(
    '../../src/renderer/audio/captura'
  );
  return {
    ...real,
    solicitarPermissaoMicrofone: vi.fn(async () => true),
    enumerarMicrofones: vi.fn(async () => [] as { id: string; rotulo: string }[])
  };
});

/**
 * Seção "Busca por voz" nas configurações (openspec/specs/busca-por-voz).
 *
 * O controle parte desligado. Ativar dispara o download com progresso; uma
 * falha volta o controle para desligado e informa o motivo, distinguindo-o de
 * uma recusa do usuário.
 */

const RECENTES: ResultadoBusca = {
  documentos: [
    {
      id: 'github:o/r:ata.md',
      nome: 'ata.md',
      extensao: 'md',
      fonte: 'github',
      dataModificacao: '2026-08-01T00:00:00Z',
      link: 'https://github.com/o/r/blob/main/ata.md'
    }
  ],
  falhas: [],
  avisos: [],
  doCache: false
};

async function abrirConfiguracoes() {
  await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

beforeEach(() => vi.clearAllMocks());

describe('ativação da busca por voz', () => {
  it('parte de desligada', async () => {
    instalarApi(montarApi(RECENTES, { estadoVoz: vi.fn(async () => VOZ_INATIVA) }));
    render(<App />);
    await abrirConfiguracoes();

    expect(
      screen.getByRole('button', { name: /ativar busca por voz/i })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('ativar baixa o modelo e passa a mostrar "Ativa"', async () => {
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_INATIVA),
      ativarVoz: vi.fn(async () => VOZ_PRONTA)
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    fireEvent.click(screen.getByRole('button', { name: /ativar busca por voz/i }));

    await waitFor(() => expect(api.ativarVoz).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /desativar busca por voz/i })).toBeInTheDocument()
    );
  });

  it('mostra o progresso do download conforme os eventos chegam', async () => {
    let emitir: ((p: { recebidos: number; total: number; arquivo: string }) => void) | undefined;
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_INATIVA),
      aoProgressoModeloVoz: vi.fn((ouvinte) => {
        emitir = ouvinte;
        return () => undefined;
      }),
      ativarVoz: vi.fn(
        () =>
          new Promise<EstadoVoz>((resolve) => {
            emitir?.({ recebidos: 40, total: 100, arquivo: 'encoder.onnx' });
            setTimeout(() => resolve(VOZ_PRONTA), 10);
          })
      )
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    fireEvent.click(screen.getByRole('button', { name: /ativar busca por voz/i }));
    await waitFor(() => expect(screen.getByText(/baixando o modelo: 40%/i)).toBeInTheDocument());
  });

  it('sem permissão, oferece o botão para permitir o microfone', async () => {
    vi.mocked(enumerarMicrofones).mockResolvedValue([]);
    instalarApi(montarApi(RECENTES, { estadoVoz: vi.fn(async () => VOZ_PRONTA) }));
    render(<App />);
    await abrirConfiguracoes();

    expect(
      await screen.findByRole('button', { name: /permitir o microfone para escolher/i })
    ).toBeInTheDocument();
  });

  it('lista os microfones e grava a escolha do dispositivo', async () => {
    vi.mocked(enumerarMicrofones).mockResolvedValue([
      { id: 'padrao', rotulo: 'Microfone interno' },
      { id: 'usb', rotulo: 'Headset USB' }
    ]);
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_PRONTA),
      ajustarMicrofoneVoz: vi.fn(async () => ({ ...VOZ_PRONTA, microfoneId: 'usb' }))
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    const seletor = await screen.findByRole('combobox', { name: /microfone/i });
    fireEvent.change(seletor, { target: { value: 'usb' } });

    await waitFor(() =>
      expect(api.ajustarMicrofoneVoz).toHaveBeenCalledWith({ dispositivoId: 'usb' })
    );
  });

  it('falha no download volta para desligada e informa o motivo', async () => {
    const comErro: EstadoVoz = {
      ...VOZ_INATIVA,
      modelo: 'erro',
      mensagemErro: 'a conexão caiu durante o download'
    };
    const api = montarApi(RECENTES, {
      estadoVoz: vi.fn(async () => VOZ_INATIVA),
      ativarVoz: vi.fn(async () => comErro)
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    fireEvent.click(screen.getByRole('button', { name: /ativar busca por voz/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/a conexão caiu durante o download/i)
    );
    expect(
      screen.getByRole('button', { name: /ativar busca por voz/i })
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
