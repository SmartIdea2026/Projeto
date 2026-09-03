import { useEffect, useRef, useState } from 'react';
import type { EstadoVoz } from '../../compartilhado/tipos';
import {
  ErroPermissaoMicrofone,
  iniciarCaptura,
  solicitarPermissaoMicrofone,
  type ControleCaptura
} from '../audio/captura';

type EstadoDitado = 'ocioso' | 'solicitando' | 'escutando' | 'transcrevendo';

interface Props {
  estadoVoz: EstadoVoz | null;
  /** Recebe o texto transcrito, para preencher o campo de busca. */
  aoTranscrever: (texto: string) => void;
  /** Chamado quando o navegador nega o microfone de forma persistente. */
  aoNegarPermissao?: () => void;
  /** Recebe o estado atualizado após o consentimento do primeiro uso. */
  aoAtualizarEstadoVoz?: (estado: EstadoVoz) => void;
}

const ANUNCIO: Record<EstadoDitado, string> = {
  ocioso: '',
  solicitando: 'Pedindo acesso ao microfone.',
  escutando: 'Ouvindo. Fale o termo de busca.',
  transcrevendo: 'Transcrevendo o que você falou.'
};

/** Microfone com ondas sonoras — cápsula, suporte e duas ondas laterais. */
function IconeMicrofone() {
  return (
    <svg
      className="busca__voz-icone"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="2" width="6" height="13" rx="3" fill="currentColor" />
      <path
        d="M5 11.5a7 7 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M12 18.5V22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 22h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M2.6 9a4.6 4.6 0 0 0 0 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M21.4 9a4.6 4.6 0 0 1 0 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Quadrado arredondado — o "parar" durante a escuta. */
function IconeParar() {
  return (
    <svg
      className="busca__voz-icone"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Controle de ditado na barra de busca (ADR-0008).
 *
 * Só aparece com a busca por voz ativa e o modelo pronto. No primeiro uso, um
 * modal pede o consentimento explícito para usar o microfone — depois disso o
 * clique grava direto. A transcrição **preenche o campo e não busca** — a
 * confirmação continua sendo um ato do usuário. Uma captura sem fala
 * reconhecível não mexe no campo e avisa.
 *
 * Os estados de escuta e transcrição são dois carregamentos distintos, cada um
 * anunciado a leitores de tela; nenhum depende só de cor.
 */
export function BotaoMicrofone({
  estadoVoz,
  aoTranscrever,
  aoNegarPermissao,
  aoAtualizarEstadoVoz
}: Props) {
  const [estado, setEstado] = useState<EstadoDitado>('ocioso');
  const [aviso, setAviso] = useState<string | null>(null);
  const [pedindoConsentimento, setPedindoConsentimento] = useState(false);
  const controle = useRef<ControleCaptura | null>(null);

  useEffect(() => {
    return () => controle.current?.cancelar();
  }, []);

  if (!estadoVoz || !estadoVoz.vozAtiva || estadoVoz.modelo !== 'pronto') return null;

  const permissaoNegada = estadoVoz.permissao === 'negada';

  /** Roda a captura e a transcrição de fato, com o dispositivo escolhido. */
  async function capturar(estadoAtual: EstadoVoz): Promise<void> {
    setAviso(null);
    setEstado('solicitando');

    let sessao: ControleCaptura;
    try {
      sessao = await iniciarCaptura(estadoAtual.captura, estadoAtual.microfoneId);
    } catch (erro) {
      setEstado('ocioso');
      if (erro instanceof ErroPermissaoMicrofone) {
        setAviso('Permita o microfone nas configurações do sistema para ditar.');
        aoNegarPermissao?.();
      } else {
        setAviso('Não foi possível acessar o microfone.');
      }
      return;
    }

    controle.current = sessao;
    setEstado('escutando');

    const { motivo, pcm, nivel } = await sessao.resultado;
    controle.current = null;

    if (motivo === 'cancelado') {
      setEstado('ocioso');
      return;
    }
    if (!pcm) {
      setEstado('ocioso');
      // Nível quase zero: provável microfone errado, mudo ou sem permissão real.
      setAviso(
        nivel !== undefined && nivel < 0.002
          ? 'Não captei som do microfone. Escolha o microfone certo em Configurações e confira se ele não está mudo.'
          : 'Não ouvi nada, tente de novo — fale um pouco mais alto ou mais perto.'
      );
      return;
    }

    setEstado('transcrevendo');
    const resposta = await window.ancorai.transcreverVoz(pcm);
    setEstado('ocioso');

    if (resposta.texto) {
      aoTranscrever(resposta.texto);
      setAviso(null);
    } else if (resposta.motivo === 'vazio') {
      setAviso('Não ouvi nada, tente de novo.');
    } else {
      setAviso('Não foi possível transcrever. Tente de novo ou digite.');
    }
  }

  async function iniciar(): Promise<void> {
    if (estado !== 'ocioso' || pedindoConsentimento) return;
    // Primeiro uso: o modal pede o "permitir" antes de qualquer getUserMedia.
    if (!estadoVoz!.microfoneConsentido) {
      setAviso(null);
      setPedindoConsentimento(true);
      return;
    }
    await capturar(estadoVoz!);
  }

  async function confirmarConsentimento(): Promise<void> {
    setPedindoConsentimento(false);
    // Abre o microfone uma vez para o navegador registrar a concessão.
    const concedido = await solicitarPermissaoMicrofone();
    const novo = await window.ancorai.ajustarMicrofoneVoz({ consentido: true });
    aoAtualizarEstadoVoz?.(novo);
    if (!concedido) {
      setAviso('Permita o microfone nas configurações do sistema para ditar.');
      aoNegarPermissao?.();
      return;
    }
    await capturar(novo);
  }

  const escutando = estado === 'escutando';
  const ocupado = estado === 'transcrevendo' || estado === 'solicitando';

  return (
    <>
      <button
        type="button"
        className={`busca__voz busca__voz--${estado}`}
        aria-label={escutando ? 'Parar de ditar' : 'Ditar o termo de busca'}
        aria-pressed={escutando}
        disabled={permissaoNegada || ocupado}
        title={
          permissaoNegada
            ? 'Permita o microfone nas configurações do sistema'
            : undefined
        }
        onClick={() => (escutando ? controle.current?.parar() : void iniciar())}
      >
        <span className="busca__voz-glifo" aria-hidden="true">
          {escutando ? <IconeParar /> : ocupado ? '…' : <IconeMicrofone />}
        </span>
      </button>

      {/* Estado e avisos para leitores de tela e para quem enxerga. */}
      <span className="busca__voz-status" role="status" aria-live="polite">
        {aviso ?? ANUNCIO[estado]}
      </span>

      {pedindoConsentimento && (
        <div
          className="modal-fundo"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-consentimento-microfone"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setPedindoConsentimento(false);
          }}
        >
          <div className="modal modal--estreito">
            <h2 id="titulo-consentimento-microfone">Usar o microfone?</h2>
            <p className="modal__descricao">
              O AncorAI vai ouvir o microfone para transcrever o termo de busca que
              você falar. A transcrição acontece <strong>na sua máquina</strong>; o
              áudio não é enviado a nenhum serviço externo nem gravado. Você pode
              escolher qual microfone usar em Configurações.
            </p>
            <div className="campo__acoes">
              <button
                type="button"
                className="botao botao--primario"
                onClick={() => void confirmarConsentimento()}
              >
                Permitir o microfone
              </button>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => setPedindoConsentimento(false)}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
