import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILTROS_PADRAO,
  type Documento,
  type Filtros as TipoFiltros,
  type ResultadoBusca,
  type StatusFonte
} from '../compartilhado/tipos';
import { Cartao } from './componentes/Cartao';
import { Filtros } from './componentes/Filtros';
import { Configuracoes } from './telas/Configuracoes';

const NOME_FONTE = { github: 'GitHub' } as const;

const ROTULO_ESTADO: Record<string, string> = {
  conectada: 'conectada',
  invalida: 'credencial inválida',
  'nao-configurada': 'não configurada',
  'sem-conexao': 'sem conexão',
  verificando: 'verificando'
};

export function App() {
  const [status, setStatus] = useState<StatusFonte[]>([]);
  const [filtros, setFiltros] = useState<TipoFiltros>(FILTROS_PADRAO);
  const [termoCampo, setTermoCampo] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrandoRecentes, setMostrandoRecentes] = useState(true);
  const [configAberta, setConfigAberta] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);

  const temCredencial = status.some((item) => item.estado === 'conectada');

  const periodoInvalido =
    Boolean(filtros.dataInicial && filtros.dataFinal) &&
    filtros.dataInicial! > filtros.dataFinal!;
  const erroPeriodo = periodoInvalido
    ? 'A data final não pode ser anterior à data inicial.'
    : null;

  const carregarRecentes = useCallback(
    async (filtrosAtuais: TipoFiltros, emSegundoPlano = false) => {
      if (!emSegundoPlano) setCarregando(true);
      try {
        const novo = await window.ancorai.recentes(filtrosAtuais);
        // Uma atualização que falhou em todas as fontes não deve apagar a lista
        // que o usuário já estava vendo; apenas o aviso é apresentado.
        if (novo.documentos.length > 0 || !emSegundoPlano) setResultado(novo);
        else setResultado((atual) => (atual ? { ...atual, falhas: novo.falhas } : novo));
      } finally {
        setCarregando(false);
      }
    },
    []
  );

  const executarBusca = useCallback(async (filtrosAtuais: TipoFiltros) => {
    setCarregando(true);
    try {
      setResultado(await window.ancorai.buscar(filtrosAtuais));
    } finally {
      setCarregando(false);
    }
  }, []);

  // Rotina de inicialização: verifica as credenciais e, havendo alguma válida,
  // já apresenta os documentos recentes.
  useEffect(() => {
    void (async () => {
      // A lista guardada aparece antes de qualquer requisição: abrir a
      // aplicação não deve significar esperar por duas APIs.
      const guardado = await window.ancorai.recentesDoCache(FILTROS_PADRAO);
      if (guardado && guardado.documentos.length > 0) {
        setResultado(guardado);
        setCarregando(false);
      }

      const atual = await window.ancorai.status();
      setStatus(atual);
      campoBusca.current?.focus();

      if (atual.some((item) => item.estado === 'conectada')) {
        // Atualiza em segundo plano, sem descartar o que já está visível.
        await carregarRecentes(FILTROS_PADRAO, Boolean(guardado));
      } else {
        setCarregando(false);
      }
    })();
  }, [carregarRecentes]);

  function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    if (periodoInvalido) return;

    const termo = termoCampo.trim();
    const novos = { ...filtros, termo };
    setFiltros(novos);

    if (!termo) {
      // Campo vazio não dispara consulta de busca: volta aos recentes.
      setMostrandoRecentes(true);
      void carregarRecentes(novos);
      return;
    }
    setMostrandoRecentes(false);
    void executarBusca(novos);
  }

  // Qualquer alteração de filtro dispara nova consulta às fontes (RN06).
  function aoAlterarFiltros(novos: TipoFiltros) {
    setFiltros(novos);
    const invalido =
      Boolean(novos.dataInicial && novos.dataFinal) && novos.dataInicial! > novos.dataFinal!;
    if (invalido || !temCredencial) return;

    if (mostrandoRecentes) void carregarRecentes(novos);
    else void executarBusca(novos);
  }

  async function abrir(documento: Documento) {
    await window.ancorai.abrirDocumento(documento);
  }

  const documentos = resultado?.documentos ?? [];
  const falhas = resultado?.falhas ?? [];

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <div className="marca__simbolo" aria-hidden="true">
            ⚓
          </div>
          <div>
            <div className="marca__nome">
              Ancor<span>AI</span>
            </div>
            <div className="marca__legenda">Workspace interno</div>
          </div>
        </div>

        <div className="conexoes">
          {(['github'] as const).map((fonte) => {
            const item = status.find((atual) => atual.fonte === fonte);
            const estado = item?.estado ?? 'nao-configurada';
            return (
              <button
                key={fonte}
                type="button"
                className="conexao"
                onClick={() => setConfigAberta(true)}
              >
                <span
                  className={`conexao__ponto conexao__ponto--${estado}`}
                  aria-hidden="true"
                />
                {/* O estado vai também em texto, não apenas na cor do ponto. */}
                {NOME_FONTE[fonte]} {ROTULO_ESTADO[estado]}
              </button>
            );
          })}
        </div>
      </header>

      <main className="conteudo">
        <h1 className="titulo">Busque em todo o seu workspace</h1>
        <p className="subtitulo">Todos os documentos do seu GitHub em um só lugar.</p>

        <form className="busca" onSubmit={aoSubmeter} role="search">
          <span aria-hidden="true">🔍</span>
          <input
            ref={campoBusca}
            className="busca__campo"
            type="search"
            value={termoCampo}
            placeholder="Buscar pelo nome do documento (ex.: roadmap, requisitos, ata)"
            aria-label="Buscar pelo nome do documento"
            onChange={(evento) => setTermoCampo(evento.target.value)}
          />
          <button type="submit" className="busca__acao" disabled={periodoInvalido}>
            Buscar
          </button>
        </form>

        <Filtros filtros={filtros} aoAlterar={aoAlterarFiltros} erroPeriodo={erroPeriodo} />

        {falhas.map((falha) => (
          <div key={falha.fonte} className="aviso" role="status">
            <span aria-hidden="true">⚠</span>
            <span>
              <strong>{NOME_FONTE[falha.fonte]}:</strong> {falha.mensagem}
            </span>
          </div>
        ))}

        {/* Alterações da lista são anunciadas por leitores de tela. */}
        <div aria-live="polite" aria-atomic="true">
          {!carregando && temCredencial && (
            <p className="resumo-lista">
              {mostrandoRecentes
                ? `${documentos.length} documento(s) modificado(s) recentemente`
                : `${documentos.length} resultado(s)`}
            </p>
          )}
        </div>

        {carregando && (
          <ul className="lista" aria-hidden="true">
            {[0, 1, 2, 3].map((indice) => (
              <li key={indice} className="esqueleto" />
            ))}
          </ul>
        )}

        {!carregando && !temCredencial && (
          <div className="vazio">
            <h2>Configure o acesso ao GitHub</h2>
            <p>
              O AncorAI precisa de um token do GitHub para localizar documentos.
            </p>
            <button
              type="button"
              className="botao botao--primario"
              onClick={() => setConfigAberta(true)}
            >
              Abrir configurações
            </button>
          </div>
        )}

        {!carregando && temCredencial && documentos.length === 0 && (
          <div className="vazio">
            <h2>Nenhum documento encontrado</h2>
            <p>
              {falhas.length === status.filter((item) => item.estado === 'conectada').length &&
              falhas.length > 0
                ? 'Não foi possível realizar a busca nas fontes configuradas.'
                : 'Revise o termo informado ou ajuste os filtros aplicados.'}
            </p>
          </div>
        )}

        {!carregando && documentos.length > 0 && (
          <ul className="lista">
            {documentos.map((documento) => (
              <Cartao key={documento.id} documento={documento} aoAbrir={abrir} />
            ))}
          </ul>
        )}
      </main>

      {configAberta && (
        <Configuracoes
          status={status}
          aoFechar={() => setConfigAberta(false)}
          aoAtualizarStatus={(novo) => {
            setStatus(novo);
            if (novo.some((item) => item.estado === 'conectada')) {
              void carregarRecentes(filtros);
            }
          }}
        />
      )}
    </div>
  );
}
