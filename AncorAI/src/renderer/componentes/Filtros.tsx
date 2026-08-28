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

  return (
    <>
      <div className="filtros">
        {/*
          O protótipo separa "Extensão" de "Tipo": o primeiro é a extensão do
          arquivo, este filtro; o segundo é a classificação por IA, que chega na
          mudança seguinte. Rotular este como "Tipo" colidiria com aquele.
        */}
        <span className="filtros__rotulo">FILTROS</span>
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

        <div className={`filtro ${periodoAtivo ? 'filtro--ativo' : ''}`}>
          <label>
            <span className="apenas-leitor">Data inicial</span>
            <input
              type="date"
              value={filtros.dataInicial ?? ''}
              onChange={(evento) =>
                aoAlterar({ ...filtros, dataInicial: evento.target.value || undefined })
              }
            />
          </label>
          <span aria-hidden="true">–</span>
          <label>
            <span className="apenas-leitor">Data final</span>
            <input
              type="date"
              value={filtros.dataFinal ?? ''}
              onChange={(evento) =>
                aoAlterar({ ...filtros, dataFinal: evento.target.value || undefined })
              }
            />
          </label>
          {periodoAtivo && (
            <button
              type="button"
              className="filtro__limpar"
              onClick={() =>
                aoAlterar({ ...filtros, dataInicial: undefined, dataFinal: undefined })
              }
            >
              limpar
            </button>
          )}
        </div>

      </div>

      {erroPeriodo && (
        <p className="erro-campo" role="alert" style={{ textAlign: 'center' }}>
          {erroPeriodo}
        </p>
      )}
    </>
  );
}
