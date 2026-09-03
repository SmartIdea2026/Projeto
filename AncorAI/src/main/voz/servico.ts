import type {
  AjusteMicrofoneVoz,
  EstadoModeloVoz,
  EstadoVoz,
  ProgressoModeloVoz,
  RespostaTranscricao
} from '../../compartilhado/tipos';
import {
  gravarPreferencia,
  gravarPreferenciaTexto,
  lerPreferencia,
  lerPreferenciaTexto
} from '../banco/repositorio';
import { permissaoMicrofone } from '../permissoes';
import { lerConfigVoz } from './config';
import {
  baixarModelo,
  encerrarVoz,
  modeloEstaPronto,
  transcrever as transcreverPcm
} from './transcricao';

/**
 * Fachada da busca por voz para a camada IPC (ADR-0008).
 *
 * Junta a preferência do usuário (`voz.ativa`), o estado do modelo no disco e o
 * resultado da última tentativa de microfone num só retrato. O download é
 * disparado aqui ao ativar; uma falha volta a preferência para desligado, para
 * que o estado nunca prometa um microfone que não vai funcionar.
 */

export const CHAVE_VOZ_ATIVA = 'voz.ativa';
/** Consentimento do primeiro uso do microfone (o "permitir" do modal). */
export const CHAVE_MIC_CONSENTIDO = 'voz.microfoneConsentido';
/** `deviceId` do microfone escolhido nas configurações. Vazio = padrão do sistema. */
export const CHAVE_MIC_ID = 'voz.microfone';

let baixando = false;
let ultimoErro: string | undefined;

async function estadoModelo(): Promise<EstadoModeloVoz> {
  if (baixando) return 'baixando';
  if (ultimoErro) return 'erro';
  return (await modeloEstaPronto()) ? 'pronto' : 'ausente';
}

/** Valores de captura usados quando a configuração ainda não foi lida. */
const CAPTURA_PADRAO = {
  silencioLimiarRms: 0.01,
  silencioDuracaoMs: 1500,
  duracaoMaximaS: 30,
  taxaAmostragemHz: 16000
};

export async function estado(): Promise<EstadoVoz> {
  const vozAtiva = (await lerPreferencia(CHAVE_VOZ_ATIVA)) === true;
  const microfoneConsentido = (await lerPreferencia(CHAVE_MIC_CONSENTIDO)) === true;
  const microfoneId = (await lerPreferenciaTexto(CHAVE_MIC_ID)) || null;
  let captura = CAPTURA_PADRAO;
  try {
    captura = lerConfigVoz().captura;
  } catch {
    // Sem o arquivo de configuração o recurso não funciona, mas o estado ainda
    // precisa responder — a interface só não apresenta o microfone.
  }
  return {
    vozAtiva,
    modelo: await estadoModelo(),
    permissao: permissaoMicrofone(),
    microfoneConsentido,
    microfoneId,
    captura,
    ...(ultimoErro ? { mensagemErro: ultimoErro } : {})
  };
}

/**
 * Registra o consentimento do primeiro uso e/ou o microfone escolhido.
 *
 * Nada aqui toca o áudio: são preferências que a barra de busca lê para saber
 * se ainda precisa pedir o "permitir" e de qual dispositivo captar.
 */
export async function ajustarMicrofone(ajuste: AjusteMicrofoneVoz): Promise<EstadoVoz> {
  if (typeof ajuste.consentido === 'boolean') {
    await gravarPreferencia(CHAVE_MIC_CONSENTIDO, ajuste.consentido);
  }
  if (ajuste.dispositivoId !== undefined) {
    await gravarPreferenciaTexto(CHAVE_MIC_ID, ajuste.dispositivoId ?? '');
  }
  return estado();
}

/**
 * Liga ou desliga a busca por voz.
 *
 * Ligar grava a preferência e baixa o modelo (se faltar), informando o
 * progresso pelo callback. Se o download falhar, a preferência volta para
 * desligado e o erro fica no estado. Desligar encerra o worker e mantém o
 * modelo já baixado no disco.
 */
export async function ativar(
  valor: boolean,
  aoProgresso: (p: ProgressoModeloVoz) => void
): Promise<EstadoVoz> {
  if (!valor) {
    await gravarPreferencia(CHAVE_VOZ_ATIVA, false);
    encerrarVoz();
    ultimoErro = undefined;
    return estado();
  }

  await gravarPreferencia(CHAVE_VOZ_ATIVA, true);
  ultimoErro = undefined;
  baixando = true;
  try {
    await baixarModelo(aoProgresso);
  } catch (erro) {
    ultimoErro = erro instanceof Error ? erro.message : 'Não foi possível baixar o modelo de voz.';
    await gravarPreferencia(CHAVE_VOZ_ATIVA, false);
  } finally {
    baixando = false;
  }

  return estado();
}

/** Transcreve o PCM recebido do renderer. Nunca lança. */
export function transcrever(pcm: ArrayBuffer): Promise<RespostaTranscricao> {
  return transcreverPcm(pcm);
}
