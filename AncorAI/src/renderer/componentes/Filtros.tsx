import { useEffect, useRef, useState } from 'react';
import { EXTENSOES_ACEITAS, type Filtros } from '../../compartilhado/tipos';

interface Props {
  filtros: Filtros;
  aoAlterar: (filtros: Filtros) => void;
  erroPeriodo: string | null;
}

/*
  O seletor de fonte saiu junto com o Drive (ADR-0004): com uma fonte só, ele
  seria um menu de opção única. `filtros.fontes` continua existindo e vazio
  significa todas as fontes, então o controle volta quando houver o que escolher.
*/

export function Filtros({ filtros, aoAlterar, erroPeriodo }: Props) {
  const tipoAtivo = filtros.extensoes.length > 0;
  const periodoAtivo = Boolean(filtros.dataInicial || filtros.dataFinal);

  const [periodoAberto, setPeriodoAberto] = useState(false);
  const areaPeriodo = useRef<HTMLDivElement>(null);
  const botaoPeriodo = useRef<HTMLButtonElement>(null);

  /*
    O período ficava como dois campos de data soltos na barra de filtros. Cada
    campo carrega o próprio ícone de calendário, que o navegador ancora à
    direita do campo — e com os dois lado a lado o ícone acabava distante do
    rótulo a que pertence. Recolhê-los num painel resolve isso e alinha ao
    protótipo: a barra fica com um botão, e as datas ganham rótulos visíveis.
  */

  // Fecha ao clicar fora, comportamento esperado de um painel suspenso.
  useEffect(() => {
    if (!periodoAberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!areaPeriodo.current?.contains(evento.target as Node)) setPeriodoAberto(false);
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [periodoAberto]);

  function fecharPeriodo() {
    setPeriodoAberto(false);
    botaoPeriodo.current?.focus();
  }

  return (
    <>
      <div className="filtros">
        {/*
          O protótipo separa "Extensão" de "Tipo": o primeiro é a extensão do
          arquivo, este filtro; o segundo é a classificação por IA, que chega na
          mudança seguinte. Rotular este como "Tipo" colidiria com aquele.
        */}
        <span className="filtros__rotulo">FILTROS</span>

        {/*
          Amplia onde o termo é procurado: além de nome e autor, o texto já
          armazenado do documento. Desligado por padrão — a busca no conteúdo
          alcança qualquer documento que mencione o termo no corpo.
        */}
        <label
          className={`filtro filtro--check ${filtros.buscarConteudo ? 'filtro--ativo' : ''}`}
        >
          <input
            type="checkbox"
            checked={Boolean(filtros.buscarConteudo)}
            onChange={(evento) =>
              aoAlterar({ ...filtros, buscarConteudo: evento.target.checked })
            }
          />
          <span>Buscar no conteúdo</span>
        </label>

        <label className={`filtro ${tipoAtivo ? 'filtro--ativo' : ''}`}>
          <span>Extensão:</span>
          <select
            value={filtros.extensoes[0] ?? ''}
            onChange={(evento) =>
              aoAlterar({
                ...filtros,
                extensoes: evento.target.value ? [evento.target.value] : []
              })
            }
          >
            <option value="">todos</option>
            {EXTENSOES_ACEITAS.map((extensao) => (
              <option key={extensao} value={extensao}>
                .{extensao}
              </option>
            ))}
          </select>
        </label>

        <div
          className="periodo"
          ref={areaPeriodo}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape' && periodoAberto) {
              evento.stopPropagation();
              fecharPeriodo();
            }
          }}
        >
          <button
            type="button"
            ref={botaoPeriodo}
            className={`filtro filtro--botao ${periodoAtivo ? 'filtro--ativo' : ''}`}
            aria-expanded={periodoAberto}
            onClick={() => setPeriodoAberto((aberto) => !aberto)}
          >
            <span aria-hidden="true">⇅</span>
            Período
          </button>

          {periodoAberto && (
            <div className="periodo__painel" role="group" aria-label="Filtro de período">
              <p className="periodo__titulo">Período (modificação)</p>

              <div className="periodo__campos">
                <label className="periodo__campo">
                  <span>De</span>
                  <input
                    type="date"
                    value={filtros.dataInicial ?? ''}
                    onChange={(evento) =>
                      aoAlterar({ ...filtros, dataInicial: evento.target.value || undefined })
                    }
                  />
                </label>
                <label className="periodo__campo">
                  <span>Até</span>
                  <input
                    type="date"
                    value={filtros.dataFinal ?? ''}
                    onChange={(evento) =>
                      aoAlterar({ ...filtros, dataFinal: evento.target.value || undefined })
                    }
                  />
                </label>
              </div>

              {erroPeriodo && (
                <p className="erro-campo" role="alert">
                  {erroPeriodo}
                </p>
              )}

              <button
                type="button"
                className="periodo__limpar"
                disabled={!periodoAtivo}
                onClick={() =>
                  aoAlterar({ ...filtros, dataInicial: undefined, dataFinal: undefined })
                }
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/*
        O erro também aparece fora do painel: fechá-lo não pode esconder do
        usuário o motivo de a busca não estar respondendo.
      */}
      {erroPeriodo && !periodoAberto && (
        <p className="erro-campo erro-periodo" role="alert">
          {erroPeriodo}
        </p>
      )}
    </>
  );
}
