import { EXTENSOES_ACEITAS, type Filtros, type Fonte, type Ordenacao } from '../../compartilhado/tipos';

interface Props {
  filtros: Filtros;
  aoAlterar: (filtros: Filtros) => void;
  erroPeriodo: string | null;
}

const FONTES: Array<{ valor: Fonte; rotulo: string }> = [
  { valor: 'github', rotulo: 'GitHub' },
  { valor: 'drive', rotulo: 'Google Drive' }
];

const ORDENACOES: Array<{ valor: Ordenacao; rotulo: string }> = [
  { valor: 'data-desc', rotulo: 'Data (decrescente)' },
  { valor: 'data-asc', rotulo: 'Data (crescente)' },
  { valor: 'a-z', rotulo: 'Nome (A–Z)' },
  { valor: 'z-a', rotulo: 'Nome (Z–A)' }
];

export function Filtros({ filtros, aoAlterar, erroPeriodo }: Props) {
  const tipoAtivo = filtros.extensoes.length > 0;
  const fonteAtiva = filtros.fontes.length > 0;
  const periodoAtivo = Boolean(filtros.dataInicial || filtros.dataFinal);

  return (
    <>
      <div className="filtros">
        <label className={`filtro ${tipoAtivo ? 'filtro--ativo' : ''}`}>
          <span>Tipo:</span>
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

        <label className={`filtro ${fonteAtiva ? 'filtro--ativo' : ''}`}>
          <span>Fonte:</span>
          <select
            value={filtros.fontes[0] ?? ''}
            onChange={(evento) =>
              aoAlterar({
                ...filtros,
                fontes: evento.target.value ? [evento.target.value as Fonte] : []
              })
            }
          >
            <option value="">todas</option>
            {FONTES.map((fonte) => (
              <option key={fonte.valor} value={fonte.valor}>
                {fonte.rotulo}
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

        <label className="filtro">
          <span className="apenas-leitor">Ordenação</span>
          <select
            value={filtros.ordenacao}
            onChange={(evento) =>
              aoAlterar({ ...filtros, ordenacao: evento.target.value as Ordenacao })
            }
          >
            {ORDENACOES.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erroPeriodo && (
        <p className="erro-campo" role="alert" style={{ textAlign: 'center' }}>
          {erroPeriodo}
        </p>
      )}
    </>
  );
}
