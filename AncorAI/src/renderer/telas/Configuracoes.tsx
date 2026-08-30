import { useEffect, useRef, useState } from 'react';
import type { StatusFonte, StatusLLM } from '../../compartilhado/tipos';

interface Props {
  status: StatusFonte[];
  aoFechar: () => void;
  aoAtualizarStatus: (status: StatusFonte[]) => void;
  statusLLM: StatusLLM | null;
  aoAtualizarStatusLLM: (status: StatusLLM) => void;
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
  aoAtualizarStatusLLM
}: Props) {
  const dialogo = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const [token, setToken] = useState('');
  const [chaveLLM, setChaveLLM] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});

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

        <div className="campo__acoes">
          <button type="button" className="botao botao--secundario" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
