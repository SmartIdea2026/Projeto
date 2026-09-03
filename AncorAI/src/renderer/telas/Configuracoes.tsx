import { useEffect, useRef, useState } from 'react';
import type {
  EstadoVoz,
  MicrofoneDisponivel,
  StatusFonte,
  StatusLLM
} from '../../compartilhado/tipos';
import { enumerarMicrofones, solicitarPermissaoMicrofone } from '../audio/captura';

interface Props {
  status: StatusFonte[];
  aoFechar: () => void;
  aoAtualizarStatus: (status: StatusFonte[]) => void;
  statusLLM: StatusLLM | null;
  aoAtualizarStatusLLM: (status: StatusLLM) => void;
  estadoVoz: EstadoVoz | null;
  aoAtualizarEstadoVoz: (estado: EstadoVoz) => void;
}

/**
 * Elementos que recebem foco, na ordem do documento.
 *
 * Sem `tabindex` positivo em lugar algum da aplicação, a ordem de tabulação é
 * a ordem do DOM — que por sua vez segue a leitura visual da tela.
 */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

const DESCRICAO_ESTADO: Record<string, string> = {
  conectada: 'Conectada',
  invalida: 'Credencial inválida',
  'nao-configurada': 'Não configurada',
  'sem-conexao': 'Sem conexão',
  verificando: 'Verificando…'
};

export function Configuracoes({
  status,
  aoFechar,
  aoAtualizarStatus,
  statusLLM,
  aoAtualizarStatusLLM,
  estadoVoz,
  aoAtualizarEstadoVoz
}: Props) {
  const dialogo = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const [token, setToken] = useState('');
  const [chaveLLM, setChaveLLM] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [progressoVoz, setProgressoVoz] = useState<number | null>(null);
  const [microfones, setMicrofones] = useState<MicrofoneDisponivel[]>([]);
  const [listandoMic, setListandoMic] = useState(false);

  // O progresso do download chega por evento enquanto o worker baixa o modelo.
  useEffect(() => {
    return window.ancorai.aoProgressoModeloVoz(({ recebidos, total }) => {
      setProgressoVoz(total > 0 ? recebidos / total : null);
    });
  }, []);

  // Com a voz pronta, lista os microfones para a escolha do dispositivo. Os
  // nomes só vêm depois de a permissão ter sido concedida ao menos uma vez.
  const vozPronta = Boolean(estadoVoz?.vozAtiva) && estadoVoz?.modelo === 'pronto';
  useEffect(() => {
    if (vozPronta) void enumerarMicrofones().then(setMicrofones);
  }, [vozPronta]);

  const rotulosDisponiveis = microfones.some((m) => m.rotulo);

  async function permitirEListarMicrofones(): Promise<void> {
    setListandoMic(true);
    try {
      await solicitarPermissaoMicrofone();
      setMicrofones(await enumerarMicrofones());
      aoAtualizarEstadoVoz(await window.ancorai.ajustarMicrofoneVoz({ consentido: true }));
    } finally {
      setListandoMic(false);
    }
  }

  async function escolherMicrofone(id: string): Promise<void> {
    aoAtualizarEstadoVoz(
      await window.ancorai.ajustarMicrofoneVoz({ dispositivoId: id || null })
    );
  }

  async function alternarVoz(ativar: boolean): Promise<void> {
    setOcupado('voz');
    setErro((atual) => ({ ...atual, voz: '' }));
    setProgressoVoz(ativar ? 0 : null);
    try {
      const novo = await window.ancorai.ativarVoz(ativar);
      aoAtualizarEstadoVoz(novo);
      if (novo.modelo === 'erro' && novo.mensagemErro) {
        setErro((atual) => ({ ...atual, voz: novo.mensagemErro! }));
      }
    } catch {
      setErro((atual) => ({ ...atual, voz: 'Não foi possível alterar a busca por voz.' }));
    } finally {
      setOcupado(null);
      setProgressoVoz(null);
    }
  }

  const github = status.find((item) => item.fonte === 'github');

  /**
   * Grava a chave da LLM.
   *
   * Separada de `executar` porque o retorno é outro: a LLM não é uma fonte de
   * documentos, e forçá-la no formato de `StatusFonte` faria a interface tratar
   * a ausência da chave como fonte indisponível — o que desligaria a busca.
   */
  async function executarLLM(acao: () => Promise<StatusLLM>) {
    setOcupado('llm');
    setErro((atual) => ({ ...atual, llm: '' }));
    try {
      aoAtualizarStatusLLM(await acao());
      setChaveLLM('');
    } catch (falha) {
      const mensagem =
        falha instanceof Error ? falha.message.replace(/^Error: /, '') : 'Falha inesperada.';
      setErro((atual) => ({ ...atual, llm: mensagem }));
    } finally {
      setOcupado(null);
    }
  }

  async function executar(chave: string, acao: () => Promise<StatusFonte[]>) {
    setOcupado(chave);
    setErro((atual) => ({ ...atual, [chave]: '' }));
    try {
      aoAtualizarStatus(await acao());
      if (chave === 'github') setToken('');
    } catch (falha) {
      const mensagem =
        falha instanceof Error ? falha.message.replace(/^Error: /, '') : 'Falha inesperada.';
      setErro((atual) => ({ ...atual, [chave]: mensagem }));
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Leva o foco para dentro do diálogo ao abrir e o devolve ao fechar.
   *
   * Sem isto, quem navega por teclado abre as configurações e continua com o
   * foco no botão atrás delas: o conteúdo aparece na tela mas fica fora de
   * alcance, e ao fechar o ponto de partida se perde.
   */
  useEffect(() => {
    focoAnterior.current = document.activeElement as HTMLElement | null;
    dialogo.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();

    return () => focoAnterior.current?.focus();
  }, []);

  /**
   * Mantém a tabulação dentro do diálogo e permite fechá-lo pelo teclado.
   *
   * `aria-modal="true"` declara que o restante da tela está inerte. Sem o
   * confinamento o Tab sai do diálogo para trás dele, e o atributo passa a
   * afirmar às tecnologias assistivas algo que não é verdade.
   */
  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      aoFechar();
      return;
    }

    if (evento.key !== 'Tab') return;

    const focaveis = Array.from(
      dialogo.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []
    );
    if (focaveis.length === 0) return;

    const primeiro = focaveis[0]!;
    const ultimo = focaveis[focaveis.length - 1]!;
    const ativo = document.activeElement;

    // O ciclo é fechado nas duas pontas: Tab no último volta ao primeiro, e
    // Shift+Tab no primeiro vai para o último.
    if (!evento.shiftKey && ativo === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    } else if (evento.shiftKey && ativo === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    }
  }

  return (
    <div
      className="modal-fundo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-config"
      ref={dialogo}
      onKeyDown={aoTeclar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="modal">
        <h2 id="titulo-config">Configurações</h2>
        <p className="modal__descricao">
          As credenciais são protegidas pelo chaveiro do sistema operacional e nunca
          ficam visíveis na interface depois de salvas.
        </p>

        <section className="campo">
          <div className="campo__rotulo">
            <span>GitHub</span>
            <span>{DESCRICAO_ESTADO[github?.estado ?? 'nao-configurada']}</span>
          </div>
          <p className="campo__ajuda">
            {github?.estado === 'conectada'
              ? `Conectado como ${github.conta}. Informe um novo token para substituir.`
              : 'Informe um Personal Access Token com permissão de leitura nos repositórios.'}
          </p>
          <label>
            <span className="apenas-leitor">Token do GitHub</span>
            <input
              type="password"
              value={token}
              placeholder="ghp_…"
              autoComplete="off"
              onChange={(evento) => setToken(evento.target.value)}
            />
          </label>
          {erro['github'] && (
            <p className="erro-campo" role="alert">
              {erro['github']}
            </p>
          )}
          <div className="campo__acoes">
            <button
              type="button"
              className="botao botao--primario"
              disabled={!token.trim() || ocupado === 'github'}
              onClick={() =>
                void executar('github', () =>
                  window.ancorai.definirCredencial('github', token.trim())
                )
              }
            >
              {ocupado === 'github' ? 'Verificando…' : 'Salvar token'}
            </button>
            {github?.estado === 'conectada' && (
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() =>
                  void executar('github', () => window.ancorai.removerCredencial('github'))
                }
              >
                Remover
              </button>
            )}
          </div>
        </section>

        <section className="campo">
          <div className="campo__rotulo">
            <span>Resumos por IA</span>
            <span>{DESCRICAO_ESTADO[statusLLM?.estado ?? 'nao-configurada']}</span>
          </div>
          {/*
            O aviso fica na tela, e não só no primeiro uso: quem configura hoje
            pode não ser quem confirmou o envio, e a informação precisa
            continuar alcançável depois da confirmação.
          */}
          <p className="campo__ajuda">
            Os resumos são gerados pelo Google Gemini. Para isso, o{' '}
            <strong>texto dos documentos é enviado a esse serviço externo</strong>. Na
            chave gratuita, o conteúdo enviado pode ser usado pelo Google para melhorar
            seus produtos e passar por revisão humana.
          </p>
          <p className="campo__ajuda">
            A busca funciona normalmente sem esta chave; apenas o painel de resumo fica
            indisponível.
          </p>
          {/*
            O modelo é descoberto na API, não fixado no código. Mostrá-lo é o
            que separa diagnosticar um resumo ruim de adivinhar qual modelo o
            produziu.
          */}
          {statusLLM?.modelo && (
            <p className="campo__ajuda">
              Modelo em uso: <strong>{statusLLM.modelo}</strong>
            </p>
          )}
          <label>
            <span className="apenas-leitor">Chave da API do Gemini</span>
            <input
              type="password"
              value={chaveLLM}
              /*
                Sem prefixo de exemplo: o Google emite chaves em mais de um
                formato — `AIza…` nas antigas e `AQ.Ab8R…` nas novas do AI
                Studio — e um exemplo desatualizado faz o usuário achar que
                colou a chave errada. A validação é feita contra a API, não
                pelo começo do texto.
              */
              placeholder="Cole a chave do Google AI Studio"
              autoComplete="off"
              onChange={(evento) => setChaveLLM(evento.target.value)}
            />
          </label>
          {erro['llm'] && (
            <p className="erro-campo" role="alert">
              {erro['llm']}
            </p>
          )}
          <div className="campo__acoes">
            <button
              type="button"
              className="botao botao--primario"
              disabled={!chaveLLM.trim() || ocupado === 'llm'}
              onClick={() =>
                void executarLLM(() => window.ancorai.definirChaveLLM(chaveLLM.trim()))
              }
            >
              {ocupado === 'llm' ? 'Verificando…' : 'Salvar chave'}
            </button>
            {statusLLM?.estado === 'conectada' && (
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => void executarLLM(() => window.ancorai.removerChaveLLM())}
              >
                Remover
              </button>
            )}
          </div>
        </section>

        <section className="campo">
          <div className="campo__rotulo">
            <span>Busca por voz</span>
            <span>
              {estadoVoz?.vozAtiva && estadoVoz.modelo === 'pronto'
                ? 'Ativa'
                : estadoVoz?.modelo === 'baixando' || ocupado === 'voz'
                  ? 'Baixando modelo…'
                  : 'Desligada'}
            </span>
          </div>
          <p className="campo__ajuda">
            Dite o termo de busca falando ao microfone. A transcrição é feita por
            um modelo que roda <strong>na sua máquina</strong>; o áudio não é
            enviado a nenhum serviço externo nem gravado.
          </p>
          <p className="campo__ajuda">
            Ativar baixa o modelo uma vez (cerca de 80 MB). A busca funciona
            normalmente sem esta opção.
          </p>
          {ocupado === 'voz' && progressoVoz !== null && (
            <p className="campo__ajuda" role="status">
              Baixando o modelo: {Math.round(progressoVoz * 100)}%
            </p>
          )}
          {erro['voz'] && (
            <p className="erro-campo" role="alert">
              {erro['voz']}
            </p>
          )}
          <div className="campo__acoes">
            <button
              type="button"
              className="botao botao--primario"
              aria-pressed={Boolean(estadoVoz?.vozAtiva)}
              disabled={ocupado === 'voz'}
              onClick={() => void alternarVoz(!estadoVoz?.vozAtiva)}
            >
              {ocupado === 'voz'
                ? 'Aguarde…'
                : estadoVoz?.vozAtiva
                  ? 'Desativar busca por voz'
                  : 'Ativar busca por voz'}
            </button>
          </div>

          {vozPronta && (
            <div className="campo__microfone">
              <p className="campo__ajuda">
                Escolha qual microfone o ditado vai usar. "Padrão do sistema"
                acompanha o que estiver definido no seu sistema operacional.
              </p>
              {rotulosDisponiveis ? (
                <label>
                  <span>Microfone</span>
                  <select
                    value={estadoVoz?.microfoneId ?? ''}
                    onChange={(evento) => void escolherMicrofone(evento.target.value)}
                  >
                    <option value="">Padrão do sistema</option>
                    {microfones
                      .filter((m) => m.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.rotulo || 'Microfone sem nome'}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <button
                  type="button"
                  className="botao botao--secundario"
                  disabled={listandoMic}
                  onClick={() => void permitirEListarMicrofones()}
                >
                  {listandoMic
                    ? 'Aguarde…'
                    : 'Permitir o microfone para escolher o dispositivo'}
                </button>
              )}
            </div>
          )}
        </section>

        <div className="campo__acoes">
          <button type="button" className="botao botao--secundario" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
