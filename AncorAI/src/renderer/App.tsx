import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILTROS_PADRAO,
  POR_PAGINA,
  type Documento,
  type Filtros as TipoFiltros,
  type ResultadoBusca,
  type StatusFonte
} from '../compartilhado/tipos';
import { ordenar } from '../compartilhado/ordenacao';
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

  /**
   * Busca autoria e data real dos documentos já apresentados.
   *
   * Roda depois de a lista aparecer, nunca antes: cada documento custa uma
   * requisição ao GitHub, e segurar a tela por até dez delas trocaria um
   * incômodo pequeno — a linha de autoria preencher com atraso — por uma
   * espera que o usuário sentiria em toda navegação.
   *
   * A resposta é descartada se outra consulta chegou no meio tempo, para não
   * sobrescrever a lista nova com o detalhe da antiga.
   */
  const detalharPagina = useCallback(async (base: ResultadoBusca) => {
    if (base.documentos.length === 0) return;

    try {
      const detalhados = await window.ancorai.detalharDocumentos(base.documentos);
      setResultado((atual) => {
        if (!atual || atual.documentos.length !== detalhados.length) return atual;
        const mesmoConjunto = atual.documentos.every((d, i) => d.id === detalhados[i]?.id);
        return mesmoConjunto ? { ...atual, documentos: detalhados } : atual;
      });
    } catch {
      // Falhar aqui não muda nada para o usuário: a lista continua na tela sem
      // os campos de autoria, que são complemento e não requisito.
    }
  }, []);

  const carregarRecentes = useCallback(
    async (filtrosAtuais: TipoFiltros, emSegundoPlano = false) => {
      if (!emSegundoPlano) setCarregando(true);
      try {
        const novo = await window.ancorai.recentes(filtrosAtuais);
        // Uma atualização que falhou em todas as fontes não deve apagar a lista
        // que o usuário já estava vendo; apenas o aviso é apresentado.
        if (novo.documentos.length > 0 || !emSegundoPlano) setResultado(novo);
        else setResultado((atual) => (atual ? { ...atual, falhas: novo.falhas } : novo));
        void detalharPagina(novo);
      } finally {
        setCarregando(false);
      }
    },
    [detalharPagina]
  );

  const executarBusca = useCallback(async (filtrosAtuais: TipoFiltros) => {
    setCarregando(true);
    try {
      const novo = await window.ancorai.buscar(filtrosAtuais);
      setResultado(novo);
      void detalharPagina(novo);
    } finally {
      setCarregando(false);
    }
  }, [detalharPagina]);

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
    const novos = { ...filtros, termo, pagina: 1 };
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
  /**
   * Verdadeiro quando a ordenação foi a única coisa alterada.
   *
   * A especificação exige que trocar o critério de ordenação reorganize os
   * resultados já obtidos, sem nova consulta às fontes: reconsultar gastaria
   * cota da API e faria o usuário esperar por uma reordenação que é local.
   */
  function apenasOrdenacaoMudou(novos: TipoFiltros): boolean {
    const { ordenacao: _a, ...restoNovo } = novos;
    const { ordenacao: _b, ...restoAtual } = filtros;
    return (
      novos.ordenacao !== filtros.ordenacao &&
      JSON.stringify(restoNovo) === JSON.stringify(restoAtual)
    );
  }

  function aoAlterarFiltros(novos: TipoFiltros) {
    setFiltros(novos);

    if (apenasOrdenacaoMudou(novos)) {
      setResultado((atual) =>
        atual ? { ...atual, documentos: ordenar(atual.documentos, novos.ordenacao) } : atual
      );
      return;
    }

    // Alterar um filtro de consulta muda o conjunto: permanecer na página 4 de
    // um resultado que já não existe deixaria a tela vazia sem explicação.
    novos = { ...novos, pagina: 1 };
    setFiltros(novos);

    const invalido =
      Boolean(novos.dataInicial && novos.dataFinal) && novos.dataInicial! > novos.dataFinal!;
    if (invalido || !temCredencial) return;

    if (mostrandoRecentes) void carregarRecentes(novos);
    else void executarBusca(novos);
  }

  function irParaPagina(pagina: number) {
    const novos = { ...filtros, pagina };
    setFiltros(novos);
    if (mostrandoRecentes) void carregarRecentes(novos);
    else void executarBusca(novos);
  }

  async function abrir(documento: Documento) {
    await window.ancorai.abrirDocumento(documento);
  }

  const documentos = resultado?.documentos ?? [];
  const total = resultado?.total ?? 0;
  const pagina = resultado?.pagina ?? 1;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /** Há consulta ativa quando o usuário digitou um termo ou aplicou um filtro. */
  const consultaAtiva =
    filtros.termo.trim().length > 0 ||
    filtros.extensoes.length > 0 ||
    Boolean(filtros.dataInicial) ||
    Boolean(filtros.dataFinal);
  const falhas = resultado?.falhas ?? [];
  const avisos = resultado?.avisos ?? [];

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

        {/*
          Avisos são distintos de falhas: houve resultado, mas ele pode estar
          incompleto ou impreciso. Ficam depois das falhas por serem menos
          urgentes, e usam ícone e rótulo próprios para não serem lidos como
          erro.
        */}
        {avisos.map((aviso, indice) => (
          <div key={`${aviso.fonte}-${indice}`} className="aviso aviso--info" role="status">
            <span aria-hidden="true">ⓘ</span>
            <span>
              <strong>Resultado parcial:</strong> {aviso.mensagem}
            </span>
          </div>
        ))}

        {/*
          O contador informa o TOTAL encontrado, não o tamanho da página: dizer
          "10 resultados" a partir da décima primeira correspondência esconderia
          justamente a informação que o número existe para dar.

          Ele some quando não há consulta ativa — campo de busca vazio e nenhum
          filtro aplicado —, que é a tela inicial de documentos recentes.
        */}
        <div className="linha-lista" aria-live="polite" aria-atomic="true">
          {!carregando && temCredencial && consultaAtiva && (
            <p className="resumo-lista">{total} resultado(s)</p>
          )}
          {!carregando && temCredencial && documentos.length > 0 && (
            <label className="ordenacao">
              <span className="apenas-leitor">Ordenação</span>
              <select
                value={filtros.ordenacao}
                onChange={(evento) =>
                  aoAlterarFiltros({
                    ...filtros,
                    ordenacao: evento.target.value as TipoFiltros['ordenacao']
                  })
                }
              >
                <option value="data-desc">Data decrescente</option>
                <option value="data-asc">Data crescente</option>
                <option value="a-z">Nome (A–Z)</option>
                <option value="z-a">Nome (Z–A)</option>
              </select>
            </label>
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

        {/* A navegação só aparece quando há mais de uma página. */}
        {!carregando && totalPaginas > 1 && (
          <nav className="paginacao" aria-label="Navegação entre páginas">
            <button
              type="button"
              className="botao botao--secundario"
              disabled={pagina <= 1}
              onClick={() => irParaPagina(pagina - 1)}
            >
              Anterior
            </button>
            <span className="paginacao__posicao">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              className="botao botao--secundario"
              disabled={pagina >= totalPaginas}
              onClick={() => irParaPagina(pagina + 1)}
            >
              Próxima
            </button>
          </nav>
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
