import type { Documento } from '../../compartilhado/tipos';

const NOME_FONTE = {
  github: 'GitHub'
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

/**
 * Um dado do rodapé do cartão: rótulo e valor.
 *
 * Sem o rótulo, a linha vira uma sequência de textos soltos — um nome, uma
 * data, outra data — sem dizer o que cada um significa. O valor vai destacado
 * para que a leitura ache o dado antes de ler o rótulo.
 */
function Meta({
  icone,
  rotulo,
  valor
}: {
  icone?: string;
  rotulo: string;
  valor: string;
}) {
  return (
    <span className="meta">
      {icone && (
        <span className="meta__icone" aria-hidden="true">
          {icone}
        </span>
      )}
      <span className="meta__rotulo">{rotulo}</span>
      <span className="meta__valor">{valor}</span>
    </span>
  );
}

interface Props {
  documento: Documento;
  aoAbrir: (documento: Documento) => void;
  /** Traz este documento para o painel de resumo. */
  aoResumir?: (documento: Documento) => void;
  /** Verdadeiro quando este é o documento apresentado no painel. */
  emFoco?: boolean;
}

export function Cartao({ documento, aoAbrir, aoResumir, emFoco = false }: Props) {
  const modificacao = formatarData(documento.dataModificacao);
  const criacao = formatarData(documento.dataCriacao);
  const fonte = NOME_FONTE[documento.fonte];

  return (
    <li className={`cartao${emFoco ? ' cartao--em-foco' : ''}`}>
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
            <span aria-hidden="true">⌥</span>
            {fonte}
          </span>
          {/*
            O termo casou com o texto do documento, e não com o nome. A marca
            responde "por que este resultado está aqui?" — com ícone e rótulo
            próprios, nunca só por cor. O trecho não é apresentado (ADR-0005).
          */}
          {documento.apenasConteudo && (
            <span
              className="etiqueta etiqueta--conteudo"
              title="O termo buscado aparece no texto deste documento, não no nome"
            >
              <span aria-hidden="true">◆</span>
              Encontrado no conteúdo
            </span>
          )}
        </div>

        <div className="cartao__meta">
          {documento.repositorio && (
            <Meta icone="⌥" rotulo="Repositório:" valor={documento.repositorio} />
          )}
          {/*
            O valor vem de quem assinou o último commit que tocou o arquivo,
            que pode tê-lo apenas movido ou reformatado.
          */}
          {documento.autor && <Meta icone="👤" rotulo="Autor:" valor={documento.autor} />}
          {/* Data de criação só aparece quando a fonte a fornece. */}
          {criacao && <Meta rotulo="Criado em" valor={criacao} />}
          {modificacao && (
            /*
              A data da busca no GitHub vem do repositório, não do arquivo.
              O rótulo muda para não apresentar como exata uma data que não é.
            */
            <Meta
              rotulo={documento.dataAproximada ? 'Repositório atualizado em' : 'Modificado em'}
              valor={modificacao}
            />
          )}
        </div>

        <div className="cartao__acoes">
          {aoResumir && (
            <button
              type="button"
              className="link-fonte link-fonte--resumo"
              onClick={() => aoResumir(documento)}
              /*
                O estado de foco não é comunicado só pela borda colorida do
                cartão: o botão também o declara, para quem não distingue a cor
                e para quem navega por leitor de tela.
              */
              aria-pressed={emFoco}
            >
              <span aria-hidden="true">✦</span>
              {emFoco ? 'No painel' : 'Gerar resumo'}
            </button>
          )}
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
