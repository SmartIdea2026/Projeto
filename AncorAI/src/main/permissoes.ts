import { session } from 'electron';
import type { PermissaoMicrofone } from '../compartilhado/tipos';

/**
 * Política de permissões da sessão (ADR-0003, ADR-0008).
 *
 * A busca por voz é a única funcionalidade que pede acesso a hardware. A regra
 * é mínima: só microfone (áudio), só para a janela da própria aplicação, e nada
 * mais — câmera, tela, geolocalização, notificações são todas negadas. Sem esta
 * política o Electron concede `media` por padrão a qualquer pedido do renderer.
 *
 * O Chromium não persiste de forma confiável a decisão do usuário quando a
 * página é servida de `file://` (empacotado). Guardamos aqui o resultado da
 * última tentativa para a interface distinguir "microfone disponível" de
 * "negado — reabilite nas configurações do sistema".
 */

let ultimoResultado: PermissaoMicrofone = 'desconhecida';

export function permissaoMicrofone(): PermissaoMicrofone {
  return ultimoResultado;
}

/**
 * O pedido (`setPermissionRequestHandler`) traz `mediaTypes: string[]`; a
 * verificação (`setPermissionCheckHandler`) traz `mediaType: string` (singular)
 * — ou nada. Trata os dois: é áudio, e não vídeo.
 */
function pedeVideo(detalhes: unknown): boolean {
  const d = (detalhes ?? {}) as { mediaTypes?: string[]; mediaType?: string };
  return (d.mediaTypes ?? []).includes('video') || d.mediaType === 'video';
}

export function configurarPermissoes(): void {
  const alvo = session.defaultSession;

  alvo.setPermissionRequestHandler((_conteudo, permissao, callback, detalhes) => {
    if (permissao === 'media' && !pedeVideo(detalhes)) {
      ultimoResultado = 'concedida';
      callback(true);
      return;
    }
    if (permissao === 'media') {
      // Pedido de mídia com vídeo: a aplicação nunca precisa de câmera.
      ultimoResultado = 'negada';
    }
    callback(false);
  });

  // Precisa aprovar a verificação para o `getUserMedia` chegar a pedir: se o
  // check nega, o Chromium nem chama o handler de request. O request continua
  // sendo a barreira real (nega vídeo).
  alvo.setPermissionCheckHandler((_conteudo, permissao, _origem, detalhes) => {
    return permissao === 'media' && !pedeVideo(detalhes);
  });
}

/**
 * Registra que o renderer relatou uma recusa de microfone.
 *
 * O `getUserMedia` pode ser recusado sem passar pelo handler de request (o
 * usuário já negou antes, ou negou no diálogo do SO). O renderer informa, e a
 * interface passa a mostrar o microfone desabilitado com orientação.
 */
export function registrarRecusaMicrofone(): void {
  ultimoResultado = 'negada';
}
