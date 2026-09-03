// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Política de permissões da sessão (ADR-0003, ADR-0008).
 *
 * A regra é mínima: só microfone (áudio), só a janela da aplicação. O teste
 * dobra a sessão do Electron, captura os handlers registrados e os exercita.
 */

type Handler = (...args: unknown[]) => unknown;
const handlers: Record<string, Handler> = {};

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      setPermissionRequestHandler: (fn: Handler) => {
        handlers['request'] = fn;
      },
      setPermissionCheckHandler: (fn: Handler) => {
        handlers['check'] = fn;
      }
    }
  }
}));

const { configurarPermissoes, permissaoMicrofone, registrarRecusaMicrofone } = await import(
  '../../src/main/permissoes'
);

function pedir(permissao: string, mediaTypes?: string[]): boolean {
  let concedido = false;
  handlers['request']!({}, permissao, (ok: boolean) => (concedido = ok), { mediaTypes });
  return concedido;
}

beforeEach(() => {
  configurarPermissoes();
});

describe('permissão de microfone', () => {
  it('concede mídia quando o pedido é só de áudio', () => {
    expect(pedir('media', ['audio'])).toBe(true);
    expect(permissaoMicrofone()).toBe('concedida');
  });

  it('nega mídia quando o pedido inclui vídeo', () => {
    expect(pedir('media', ['audio', 'video'])).toBe(false);
    expect(permissaoMicrofone()).toBe('negada');
  });

  it('nega qualquer outra permissão (geolocalização, notificações…)', () => {
    expect(pedir('geolocation')).toBe(false);
    expect(pedir('notifications')).toBe(false);
  });

  it('o check handler aprova mídia sem vídeo (aceita mediaType singular ou nenhum)', () => {
    expect(handlers['check']!({}, 'media', 'file://', { mediaTypes: ['audio'] })).toBe(true);
    expect(handlers['check']!({}, 'media', 'file://', { mediaType: 'audio' })).toBe(true);
    expect(handlers['check']!({}, 'media', 'file://', {})).toBe(true);
    expect(handlers['check']!({}, 'media', 'file://', { mediaType: 'video' })).toBe(false);
    expect(handlers['check']!({}, 'media', 'file://', { mediaTypes: ['video'] })).toBe(false);
    expect(handlers['check']!({}, 'midi', 'file://', {})).toBe(false);
  });

  it('registra recusa relatada pelo renderer', () => {
    pedir('media', ['audio']);
    expect(permissaoMicrofone()).toBe('concedida');
    registrarRecusaMicrofone();
    expect(permissaoMicrofone()).toBe('negada');
  });
});
