import type { Documento } from '../../compartilhado/tipos';

const NOME_FONTE = {
  github: 'GitHub',
  drive: 'Google Drive'
} as const;

function formatarData(iso?: string): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

interface Props {
  documento: Documento;
  aoAbrir: (documento: Documento) => void;
}

export function Cartao({ documento, aoAbrir }: Props) {
  const modificacao = formatarData(documento.dataModificacao);
  const criacao = formatarData(documento.dataCriacao);
  const fonte = NOME_FONTE[documento.fonte];

  return (
    <li className="cartao">
      <div className="cartao__icone" aria-hidden="true">
        📄
      </div>

      <div className="cartao__corpo">
        <div className="cartao__titulo">
          <span className="cartao__nome">{documento.nome}</span>
          {documento.extensao && (
            <span className="etiqueta">{documento.extensao.toUpperCase()}</span>
          )}
          {/*
            A fonte é identificada por ícone, texto e formato de etiqueta —
            nunca só por cor (ui-spec, acessibilidade).
          */}
          <span className={`etiqueta etiqueta--fonte etiqueta--${documento.fonte}`}>
            <span aria-hidden="true">{documento.fonte === 'github' ? '⌥' : '△'}</span>
            {fonte}
          </span>
        </div>

        <div className="cartao__meta">
          {documento.repositorio && <span>{documento.repositorio}</span>}
          {modificacao && <span>Modificado em {modificacao}</span>}
          {/* Data de criação só aparece quando a fonte a fornece. */}
          {criacao && <span>Criado em {criacao}</span>}
        </div>

        <div className="cartao__acoes">
          <button
            type="button"
            className="link-fonte"
            onClick={() => aoAbrir(documento)}
          >
            <span aria-hidden="true">↗</span>
            Abrir em {fonte}
          </button>
        </div>
      </div>
    </li>
  );
}
