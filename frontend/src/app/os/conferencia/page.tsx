"use client";
 
import Link from "next/link";
import { useState } from "react";
import { Aviso, Botao, Campo, Cartao, Etiqueta, Estado, Titulo, api, campoCls, fmtData, fmtNum, textoPrazo, useAcao, useApi, useEu, type J } from "../_lib";

function Caso({ p, feito }: { p: J; feito: () => void }) {
  const eu = useEu();
  const acao = useAcao();
  const [modo, setModo] = useState<"" | "associar" | "novo">("");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState({ nome: p.nome, fabricante: p.fabricante || "", referencia: "" });
  const achados = useApi<J[]>(modo === "associar" && busca.trim().length >= 2 ? "/os/produtos" : null, { busca });
  const pode = eu.pode("identificacao.resolver");
  const decidir = (corpo: J) => acao.rodar(async () => { await api(`/os/conferencia/${p.id}`, { metodo: "POST", corpo }); feito(); });

  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[#0B1A2A]">{p.nome}</div>
          <p className="mt-1 text-[14px] leading-relaxed text-[#334255]">{p.descricao || "Sem descrição na captura."}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(p.codigos || []).map((c: string) => <Etiqueta key={c}>cód. {c}</Etiqueta>)}
            <Etiqueta tom="alerta">{fmtNum(p.abertos)} item(ns) aberto(s)</Etiqueta>
            <Etiqueta>{p.ocorrencias} aparição(ões)</Etiqueta>
            {p.proximo_prazo && <Etiqueta>{fmtData(p.proximo_prazo)} · {textoPrazo(p.proximo_prazo)}</Etiqueta>}
          </div>
        </div>
        <Link href={`/os/item/${p.item_id}`} className="text-[14px] font-medium text-[#00756D] hover:underline">Abrir ficha</Link>
      </div>
      {acao.erro && <div className="mt-2"><Aviso tom="ruim">{acao.erro}</Aviso></div>}
      {pode ? (
        <div className="mt-3 border-t border-[#E6E9ED] pt-3">
          <div className="flex flex-wrap gap-2">
            <Botao variante={modo === "associar" ? "primario" : "secundario"} onClick={() => setModo(modo === "associar" ? "" : "associar")}>É um produto que já existe</Botao>
            <Botao variante={modo === "novo" ? "primario" : "secundario"} onClick={() => setModo(modo === "novo" ? "" : "novo")}>É um produto novo</Botao>
            <Botao variante="texto" disabled={acao.ocupado} onClick={() => decidir({ acao: "nao_identificavel" })}>Não dá para identificar</Botao>
          </div>
          {modo === "associar" && (
            <div className="mt-3">
              <Campo rotulo="Buscar o produto certo (nome, referência ou código)"><input autoFocus className={campoCls} value={busca} onChange={(e) => setBusca(e.target.value)} /></Campo>
              <ul className="mt-1 max-h-56 divide-y divide-[#E6E9ED] overflow-auto border border-[#DCE0E5] empty:hidden">
                {(achados.dados || []).filter((a) => a.id !== p.id).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[14px]">
                    <span>{a.nome} <span className="text-[12px] text-[#5A6573]">{[a.fabricante, a.referencia].filter(Boolean).join(" · ")} · cód. {(a.codigos || []).join(", ") || "sem código"} · {a.ocorrencias} aparições</span></span>
                    <Botao disabled={acao.ocupado} onClick={() => decidir({ acao: "associar", destino_id: a.id })}>Juntar a este</Botao>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {modo === "novo" && (
            <form onSubmit={(e) => { e.preventDefault(); decidir({ acao: "novo_produto", ...novo }); }} className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="md:col-span-2"><Campo rotulo="Nome do produto"><input required className={campoCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo></div>
              <Campo rotulo="Fabricante"><input className={campoCls} value={novo.fabricante} onChange={(e) => setNovo({ ...novo, fabricante: e.target.value })} /></Campo>
              <Campo rotulo="Referência"><input className={campoCls} value={novo.referencia} onChange={(e) => setNovo({ ...novo, referencia: e.target.value })} /></Campo>
              <div><Botao type="submit" variante="primario" disabled={acao.ocupado}>Confirmar produto</Botao></div>
            </form>
          )}
        </div>
      ) : <p className="mt-3 text-[12px] text-[#5A6573]">Seu perfil não resolve conferências.</p>}
    </Cartao>
  );
}

export default function Conferencia() {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const { dados, erro, carregando, recarregar } = useApi<J>("/os/conferencia", { pagina, busca: filtro });
  return (
    <>
      <Titulo sub="Produtos com item em aberto cuja descrição não basta para identificar a peça. O sistema não força identificação; a decisão vale para as próximas vezes.">Conferência manual</Titulo>
      <form onSubmit={(e) => { e.preventDefault(); setPagina(1); setFiltro(busca); }} className="mb-3 flex max-w-xl gap-2">
        <input aria-label="Buscar" className={campoCls} placeholder="Filtrar pela descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Botao type="submit">Filtrar</Botao>
      </form>
      <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.produtos.length && "Nada para conferir agora."}>
        <p className="mb-2 text-[14px] text-[#5A6573]">{fmtNum(dados?.total)} produto(s) aguardando decisão.</p>
        <div className="space-y-3">{dados?.produtos.map((p: J) => <Caso key={p.id} p={p} feito={recarregar} />)}</div>
        {dados && dados.total > 30 && (
          <div className="mt-3 flex justify-end gap-2">
            <Botao disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Botao>
            <Botao disabled={pagina * 30 >= dados.total} onClick={() => setPagina(pagina + 1)}>Próxima</Botao>
          </div>
        )}
      </Estado>
    </>
  );
}
