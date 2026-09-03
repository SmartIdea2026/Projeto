import { useEffect, useState } from 'react';
import type { Documento, MotivoSemResumo, ResumoDocumento } from '../../compartilhado/tipos';

/**
 * Painel de resumo por IA, à direita da lista.
 *
 * O painel não gera nada: recebe pronto o que apresentar. Quem orquestra a
 * geração é o `App`, porque é lá que se sabe qual documento está em foco — e
 * porque uma resposta atrasada de um documento que o usuário já abandonou não
 * pode substituir o que está na tela.
 */

const NOME_FONTE = { github: 'GitHub' } as const;

/**
 * Etapas de uma geração, na ordem em que acontecem.
 *
 * Cada uma corresponde a trabalho de verdade em andamento. Não existe estado
 * de espera fabricada: um resumo já gravado aparece pronto, sem passar por
 * aqui. Dizer "Gerando…" sobre algo que já estava gerado seria afirmar ao
 * usuário uma coisa que não é.
 */
export type EtapaResumo = 'lendo' | 'gerando' | 'demorando';

const MENSAGEM_ETAPA: Record<EtapaResumo, string> = {
  lendo: 'Lendo o documento…',
  gerando: 'Gerando o resumo…',
  demorando: 'Ainda gerando, aguarde…'
};

/** Frase que acompanha cada etapa, para a espera não ser um vazio. */
const DETALHE_ETAPA: Record<EtapaResumo, string> = {
  lendo: 'Obtendo o conteúdo do arquivo na fonte.',
  gerando: 'A IA está lendo o documento e redigindo o resumo.',
  demorando: 'A resposta está demorando mais que o normal. A lista continua utilizável.'
};

interface Props {
  documento: Documento;
  resumo: ResumoDocumento | null;
  etapa: EtapaResumo | null;
  motivo?: MotivoSemResumo;
  mensagem?: string;
  aoAbrir: (documento: Documento) => void;
  aoConsentir: () => void;
  aoRecusar: () => void;
  aoConfigurar: () => void;
  aoRegerar: () => void;
}

function Cabecalho({ documento }: { documento: Documento }) {
  return (
    <div className="painel__topo">
      <p className="painel__etiqueta">
        <span aria-hidden="true">✦</span> Resumo por IA
      </p>
      <h2 className="painel__nome">{documento.nome}</h2>
      <span className="painel__fonte">{NOME_FONTE[documento.fonte]}</span>
    </div>
  );
}

/**
 * Pedido de confirmação antes do primeiro envio.
 *
 * Aparece no lugar do resumo, e não sobre ele: o resumo do primeiro resultado é
 * automático, então sem este bloqueio o primeiro envio de conteúdo a um
 * serviço externo aconteceria sem ninguém ter clicado em nada.
 */
function Consentimento({
  aoConsentir,
  aoRecusar
}: {
  aoConsentir: () => void;
  aoRecusar: () => void;
}) {
  return (
    <div className="painel__corpo painel__consentimento">
      <p>
        Para resumir um documento, o <strong>texto dele é enviado ao Google Gemini</strong>,
        um serviço externo. Até aqui, nada do conteúdo dos seus documentos saía desta
        máquina.
      </p>
      <p className="painel__nota">
        Na chave gratuita, o conteúdo enviado pode ser usado pelo Google para melhorar
        seus produtos e passar por revisão humana.
      </p>
      <div className="painel__acoes">
        <button type="button" className="botao botao--primario" onClick={aoConsentir}>
          Permitir e gerar resumos
        </button>
        <button type="button" className="botao botao--secundario" onClick={aoRecusar}>
          Agora não
        </button>
      </div>
    </div>
  );
}

function Carregando({ etapa }: { etapa: EtapaResumo }) {
  return (
    <div className="painel__corpo painel__carregando">
      <div className="painel__pulso" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="painel__etapa">{MENSAGEM_ETAPA[etapa]}</p>
      <p className="painel__nota">{DETALHE_ETAPA[etapa]}</p>
    </div>
  );
}

/**
 * Falhas que passam sozinhas, e por isso merecem um botão de repetir.
 *
 * Sobrecarga do serviço, cota do minuto e queda de rede têm em comum não
 * dependerem de o usuário mudar coisa alguma — só de tentar outra vez. Sem o
 * botão, a única saída era trocar de documento e voltar, o que não parece uma
 * segunda tentativa e sim um jeito de contornar a tela.
 */
const REPETIVEIS: readonly MotivoSemResumo[] = ['falha', 'cota-excedida', 'sem-conexao'];

function Indisponivel({
  motivo,
  mensagem,
  aoConfigurar,
  aoRegerar
}: {
  motivo: MotivoSemResumo;
  mensagem?: string;
  aoConfigurar: () => void;
  aoRegerar: () => void;
}) {
  // Cada motivo pede uma ação diferente de quem lê: configurar, tentar de
  // novo, ou nada. Um texto único para todos deixaria o usuário sem saber o
  // que fazer a seguir.
  const precisaConfigurar = motivo === 'sem-credencial' || motivo === 'credencial-invalida';

  return (
    <div className="painel__corpo painel__indisponivel">
      <p className="painel__aviso" role="status">
        {mensagem ?? 'Não foi possível gerar o resumo.'}
      </p>
      {precisaConfigurar && (
        <button type="button" className="botao botao--secundario" onClick={aoConfigurar}>
          Abrir configurações
        </button>
      )}
      {REPETIVEIS.includes(motivo) && (
        <button type="button" className="botao botao--secundario" onClick={aoRegerar}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

function Conteudo({
  resumo,
  aoRegerar
}: {
  resumo: ResumoDocumento;
  aoRegerar: () => void;
}) {
  return (
    <div className="painel__corpo">
      {(resumo.tipo || resumo.assuntos.length > 0) && (
        <ul className="painel__classificacao">
          {resumo.tipo && (
            <li>
              <span className="painel__rotulo">Tipo identificado:</span> {resumo.tipo}
            </li>
          )}
          {resumo.assuntos.length > 0 && (
            <li>
              <span className="painel__rotulo">Assuntos detectados:</span>{' '}
              {resumo.assuntos.join(', ')}
            </li>
          )}
        </ul>
      )}

      <p className="painel__texto">{resumo.resumo}</p>

      {resumo.destaques.length > 0 && (
        <>
          <h3 className="painel__subtitulo">Destaques principais</h3>
          <ul className="painel__destaques">
            {resumo.destaques.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {resumo.baseTruncada && (
        <p className="painel__nota painel__nota--atencao">
          O documento é longo e o resumo se baseia apenas na primeira parte dele.
        </p>
      )}

      {resumo.desatualizado && (
        <div className="painel__nota painel__nota--atencao">
          <p>O documento mudou depois que este resumo foi gerado.</p>
          <button type="button" className="botao botao--secundario" onClick={aoRegerar}>
            Gerar novamente
          </button>
        </div>
      )}
    </div>
  );
}

export function PainelResumo({
  documento,
  resumo,
  etapa,
  motivo,
  mensagem,
  aoAbrir,
  aoConsentir,
  aoRecusar,
  aoConfigurar,
  aoRegerar
}: Props) {
  return (
    <aside className="painel" aria-label="Resumo do documento em foco">
      <Cabecalho documento={documento} />

      {/*
        A região viva anuncia a troca de conteúdo e a conclusão da geração.
        Sem isso, quem usa leitor de tela veria o painel mudar sem saber que
        mudou — e a mudança é justamente o que ele comunica.
      */}
      <div aria-live="polite" aria-atomic="true">
        {motivo === 'sem-consentimento' ? (
          <Consentimento aoConsentir={aoConsentir} aoRecusar={aoRecusar} />
        ) : etapa ? (
          <Carregando etapa={etapa} />
        ) : resumo ? (
          <Conteudo resumo={resumo} aoRegerar={aoRegerar} />
        ) : (
          <Indisponivel
            motivo={motivo ?? 'falha'}
            mensagem={mensagem}
            aoConfigurar={aoConfigurar}
            aoRegerar={aoRegerar}
          />
        )}
      </div>

      <div className="painel__rodape">
        <button
          type="button"
          className="botao botao--primario painel__abrir"
          onClick={() => aoAbrir(documento)}
        >
          <span aria-hidden="true">↗</span> Abrir documento no{' '}
          {NOME_FONTE[documento.fonte]}
        </button>
      </div>
    </aside>
  );
}

/**
 * Avança a etapa apresentada conforme a espera se prolonga.
 *
 * O avanço para `demorando` é temporal, e é o único que é: ele aparece porque
 * a espera **está** longa, não para simular atividade.
 */
export function useEtapaProlongada(etapa: EtapaResumo | null, apos = 8000): EtapaResumo | null {
  const [prolongada, setProlongada] = useState(false);

  useEffect(() => {
    setProlongada(false);
    if (etapa !== 'gerando') return;

    const relogio = setTimeout(() => setProlongada(true), apos);
    return () => clearTimeout(relogio);
  }, [etapa, apos]);

  if (etapa === 'gerando' && prolongada) return 'demorando';
  return etapa;
}
