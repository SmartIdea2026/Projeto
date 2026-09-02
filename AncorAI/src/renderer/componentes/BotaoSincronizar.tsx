import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MotivoSuspensao,
  RetratoSincronizacao
} from '../../compartilhado/tipos';

/**
 * Botão de sincronização do acervo, no cabeçalho.
 *
 * Dispara a mesma varredura que corre na abertura (canal `conteudo:indexar`) e
 * acompanha o andamento consultando `sincronizacao:estado` — request/response,
 * como o resto do renderer, e não evento empurrado (design, seção 6).
 *
 * O que o botão apresenta é sempre contagem e estado. O texto dos documentos
 * não chega aqui em canal algum (ADR-0005).
 */

/** Intervalo entre consultas de progresso, enquanto a varredura corre. */
const INTERVALO_CONSULTA = 1500;

const RETRATO_INICIAL: RetratoSincronizacao = {
  estado: 'parada',
  total: 0,
  ingeridos: 0,
  reaproveitados: 0,
  semTexto: 0,
  falhas: 0,
  suspensa: false
};

/** Redação de cada motivo de suspensão — o processo principal manda só o código. */
const MOTIVO_TEXTO: Record<MotivoSuspensao, string> = {
  'limite-requisicoes':
    'Limite de requisições do GitHub atingido. A sincronização continua mais tarde.',
  'limite-armazenamento':
    'O limite de texto armazenado foi atingido. O que já foi obtido continua disponível.',
  'sem-credencial': 'Configure o token do GitHub para sincronizar o acervo.',
  'falha-inventario': 'Não foi possível obter a lista de documentos do GitHub.',
  interrompida: 'A sincronização foi interrompida.'
};

export function BotaoSincronizar() {
  const [retrato, setRetrato] = useState<RetratoSincronizacao>(RETRATO_INICIAL);
  const vivo = useRef(true);

  const consultar = useCallback(async () => {
    try {
      const atual = await window.ancorai.estadoSincronizacao();
      if (vivo.current) setRetrato(atual);
      return atual;
    } catch {
      // Falhar a consulta de progresso não é motivo para o botão sumir nem para
      // travar o resto da tela: o estado apresentado apenas deixa de avançar.
      return null;
    }
  }, []);

  // Uma consulta ao montar, para refletir uma varredura que já esteja em curso
  // (a da abertura, por exemplo).
  useEffect(() => {
    vivo.current = true;
    void consultar();
    return () => {
      vivo.current = false;
    };
  }, [consultar]);

  // Enquanto a varredura corre, reconsulta em intervalo modesto. O laço para
  // sozinho: quando o estado deixa de ser `em-andamento`, o efeito sai sem
  // agendar a próxima consulta.
  useEffect(() => {
    if (retrato.estado !== 'em-andamento') return;
    const relogio = setTimeout(() => void consultar(), INTERVALO_CONSULTA);
    return () => clearTimeout(relogio);
  }, [retrato, consultar]);

  const emAndamento = retrato.estado === 'em-andamento';

  const sincronizar = useCallback(() => {
    if (emAndamento) return;

    // Otimista: o botão passa a "em andamento" já no clique, e a consulta
    // seguinte traz as contagens reais. Sem isto haveria uma janela em que o
    // clique não teria efeito visível — e nela um segundo clique escaparia.
    setRetrato((atual) => ({ ...atual, estado: 'em-andamento', suspensa: false }));
    void window.ancorai.indexarConteudo().catch(() => undefined);
    void consultar();
  }, [emAndamento, consultar]);

  const processados =
    retrato.ingeridos +
    retrato.reaproveitados +
    retrato.semTexto +
    retrato.falhas;

  // As contagens do andamento, na ordem da spec: total, obtidos agora,
  // reaproveitados, sem texto, falhas. Nunca texto de documento.
  const contagens =
    `${retrato.total} documento(s): ${retrato.ingeridos} com texto obtido, ` +
    `${retrato.reaproveitados} reaproveitado(s), ${retrato.semTexto} sem texto, ` +
    `${retrato.falhas} falha(s)`;

  const mostraContagens =
    emAndamento || retrato.estado === 'concluida' || retrato.estado === 'suspensa';

  return (
    <div className="sincronizacao">
      <button
        type="button"
        className="sincronizar"
        data-estado={retrato.estado}
        onClick={sincronizar}
        disabled={emAndamento}
        aria-label="Sincronizar o acervo de documentos"
      >
        <span aria-hidden="true">⟳</span>
        {emAndamento
          ? `Sincronizando… ${processados}/${retrato.total}`
          : 'Sincronizar'}
      </button>

      {retrato.estado === 'concluida' && (
        <p className="sincronizacao__nota" role="status">
          <span aria-hidden="true">✓</span> Acervo sincronizado
        </p>
      )}

      {retrato.estado === 'suspensa' && retrato.motivoSuspensao && (
        <p className="sincronizacao__nota sincronizacao__nota--erro" role="status">
          <span aria-hidden="true">⚠</span> {MOTIVO_TEXTO[retrato.motivoSuspensao]}
        </p>
      )}

      {mostraContagens && (
        <p className="sincronizacao__contagens" role="status">
          {contagens}
        </p>
      )}
    </div>
  );
}
