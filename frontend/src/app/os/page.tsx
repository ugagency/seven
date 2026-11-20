"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ABAS, ANDAMENTOS, Aviso, Botao, Etiqueta, Estado, NIVEIS, Titulo, baixar, campoCls, diasAte, fmtData, fmtNum, fmtReais, td, textoPrazo, th, tomAndamento, tomNivel, useAcao, useApi, useEu, type J } from "./_lib";

const daqui = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

function Fila() {
  const eu = useEu();
  const sp = useSearchParams();
  const [f, setF] = useState<J>({
    aba: sp.get("aba") || "",
    busca: sp.get("busca") || "",
    uf: "",
    prefixo: "",
    conta: "",
    situacao: sp.get("situacao") || "abertos",
    andamento: sp.get("andamento") || "",
    prazo_ate: sp.get("prazo_ate") || (sp.get("prazo") === "48h" ? daqui(2) : ""),
    capturado_de: "",
    sem_fornecedor: sp.get("sem_fornecedor") === "1",
    ordem: sp.get("ordem") === "valor" && eu.pode("valor_aberto.ver") ? "valor" : "prazo",
    pagina: 1,
  });
  const [busca, setBusca] = useState(f.busca);
  const muda = (m: J) => setF((a) => ({ ...a, pagina: 1, ...m }));
  const { dados, erro, carregando } = useApi<J>("/os/fila", f);
  const cartoes = useApi<J>("/os/fila/cartoes");
  const exp = useAcao();
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / 50)) : 1;
  const filtrando = f.busca || f.uf || f.prefixo || f.conta || f.andamento || f.prazo_ate || f.capturado_de || f.sem_fornecedor || f.situacao !== "abertos";

  return (
    <>
      <Titulo sub="Itens em aberto, pelo que precisa de ação primeiro."
        acoes={eu.pode("exportar") && (
          <Botao disabled={exp.ocupado} onClick={() => exp.rodar(() => baixar("/os/fila/exportar", { params: { ...f, pagina: undefined } }, "fila.xlsx"))}>
            {exp.ocupado ? "Gerando…" : "Exportar esta lista"}
          </Botao>
        )}>
        Fila
      </Titulo>
      {exp.erro && <div className="mb-3"><Aviso tom="ruim">{exp.erro}</Aviso></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: "Em aberto", valor: fmtNum(cartoes.dados?.em_aberto), acao: () => muda({ situacao: "abertos", prazo_ate: "", andamento: "" }) },
          { rotulo: "Encerram em 48h", valor: fmtNum(cartoes.dados?.encerra_48h), acao: () => muda({ situacao: "abertos", prazo_ate: daqui(2), ordem: "prazo" }) },
          { rotulo: "Em cotação por você", valor: fmtNum(cartoes.dados?.aguardando_voce), acao: () => muda({ situacao: "abertos", andamento: "em_cotacao" }) },
          ...(eu.pode("valor_aberto.ver")
            ? [{ rotulo: "Valor estimado em aberto", valor: cartoes.dados?.valor_estimado != null ? fmtReais(cartoes.dados.valor_estimado) : "sem base", sub: cartoes.dados ? `${fmtNum(cartoes.dados.itens_com_valor)} itens com preço de venda anterior` : "", acao: () => muda({ ordem: "valor" }) }]
            : []),
        ].map((c: J) => (
          <button key={c.rotulo} onClick={c.acao} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-600">
            <div className="text-xs font-medium text-slate-500">{c.rotulo}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{c.valor || "–"}</div>
            {c.sub && <div className="mt-0.5 text-xs text-slate-500">{c.sub}</div>}
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Abas da fila" className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {[["", "Todos"], ...Object.entries(ABAS)].map(([k, rot]) => {
          const n = dados ? (k ? dados.abas[k] : Object.values(dados.abas as J).reduce((a: number, b: any) => a + b, 0)) : null;
          return (
            <button key={k} role="tab" aria-selected={f.aba === k} onClick={() => muda({ aba: k })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${f.aba === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {rot} {n !== null && <span className="ml-1 tabular-nums text-slate-400">{fmtNum(n as number)}</span>}
            </button>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); muda({ busca }); }} className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <input aria-label="Buscar" className={`${campoCls} col-span-2`} placeholder="Descrição, código, marca ou evento" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Situação" className={campoCls} value={f.situacao} onChange={(e) => muda({ situacao: e.target.value })}>
          <option value="abertos">Em aberto</option>
          <option value="expirados">Expirados</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Andamento" className={campoCls} value={f.andamento} onChange={(e) => muda({ andamento: e.target.value, situacao: e.target.value && !["a_cotar", "em_cotacao"].includes(e.target.value) ? "todos" : f.situacao })}>
          <option value="">Qualquer andamento</option>
          {Object.entries(ANDAMENTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="CNPJ" className={campoCls} value={f.conta} onChange={(e) => muda({ conta: e.target.value })}>
          <option value="">Todos os CNPJs</option>
          {eu.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input aria-label="UF" className={campoCls} placeholder="UF" maxLength={2} value={f.uf} onChange={(e) => muda({ uf: e.target.value.toUpperCase() })} />
        <input aria-label="Prefixo do código" className={campoCls} placeholder="Prefixo (13, 15, 35)" maxLength={2} value={f.prefixo} onChange={(e) => muda({ prefixo: e.target.value })} />
        <select aria-label="Ordenar por" className={campoCls} value={f.ordem} onChange={(e) => muda({ ordem: e.target.value })}>
          <option value="prazo">Ordenar por prazo</option>
          <option value="recorrencia">Ordenar por recorrência</option>
          <option value="recentes">Capturados por último</option>
          {eu.pode("valor_aberto.ver") && <option value="valor">Ordenar por valor estimado</option>}
        </select>
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Encerra até</span>
          <input type="date" className={campoCls} value={f.prazo_ate} onChange={(e) => muda({ prazo_ate: e.target.value })} />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Capturado desde</span>
          <input type="date" className={campoCls} value={f.capturado_de} onChange={(e) => muda({ capturado_de: e.target.value })} />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.sem_fornecedor} onChange={(e) => muda({ sem_fornecedor: e.target.checked })} /> Só sem fornecedor
        </label>
        <div className="col-span-2 flex gap-2">
          <Botao type="submit" variante="primario">Buscar</Botao>
          {filtrando && <Botao type="button" variante="texto" onClick={() => { setBusca(""); muda({ busca: "", uf: "", prefixo: "", conta: "", andamento: "", prazo_ate: "", capturado_de: "", sem_fornecedor: false, situacao: "abertos" }); }}>Limpar filtros</Botao>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length && "Nenhum item com esses filtros."}>
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={th}>Item</th>
                <th className={th}>O que já sabemos</th>
                <th className={th}>Qtd.</th>
                <th className={th}>Encerramento</th>
                <th className={th}>Estado</th>
                {eu.pode("valor_aberto.ver") && <th className={`${th} text-right`}>Valor estimado</th>}
              </tr>
            </thead>
            <tbody className={carregando ? "opacity-60" : ""}>
              {dados?.itens.map((i: J) => {
                const d = diasAte(i.prazo);
                return (
                  <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className={td}>
                      <Link prefetch={false} href={`/os/item/${i.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">{i.produto.nome}</Link>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {[i.produto.fabricante, i.produto.referencia].filter(Boolean).join(" · ") || "sem marca identificada"}
                        {i.produto.codigos.length > 0 && <> · cód. {i.produto.codigos.slice(0, 3).join(", ")}{i.produto.codigos.length > 3 && ` +${i.produto.codigos.length - 3}`}</>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">Evento {i.numero_evento} · {i.uf || "UF não informada"} · {i.contas.map((c: number) => eu.nomeConta(c)).join(" e ")}</div>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        <Etiqueta tom={tomNivel(i.produto.nivel)}>{NIVEIS[i.produto.nivel]}</Etiqueta>
                        <Etiqueta>{i.ocorrencias === 1 ? "1ª aparição" : `${i.ocorrencias} aparições`}</Etiqueta>
                        <Etiqueta tom={i.fornecedores ? "bom" : "neutro"}>{i.fornecedores ? `${i.fornecedores} fornecedor${i.fornecedores > 1 ? "es" : ""}` : "sem fornecedor"}</Etiqueta>
                        {i.declinios > 0 && <Etiqueta tom="alerta">declinado {i.declinios}x</Etiqueta>}
                        {i.linhas > 1 && <Etiqueta>{i.linhas} linhas no evento</Etiqueta>}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{fmtNum(i.quantidade)} <span className="text-xs text-slate-500">{(i.unidade || "").split("-")[0]}</span></td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className={d !== null && d <= 2 && !i.expirado ? "font-medium text-red-700" : ""}>{fmtData(i.prazo)}</div>
                      <div className="text-xs text-slate-500">{textoPrazo(i.prazo)}</div>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        <Etiqueta tom={i.expirado ? "ruim" : tomAndamento(i.andamento)}>{i.expirado ? "Expirada" : ANDAMENTOS[i.andamento]}</Etiqueta>
                        {!f.aba && <Etiqueta>{ABAS[i.aba]}</Etiqueta>}
                      </div>
                      {i.responsavel && i.andamento === "em_cotacao" && <div className="mt-0.5 text-xs text-slate-500">por {i.responsavel}</div>}
                    </td>
                    {eu.pode("valor_aberto.ver") && <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{i.valor_estimado != null ? fmtReais(i.valor_estimado) : <span className="text-slate-400">sem histórico</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Estado>
      </div>

      {dados && dados.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>{fmtNum(dados.total)} itens · página {f.pagina} de {paginas}</span>
          <div className="flex gap-2">
            <Botao disabled={f.pagina <= 1} onClick={() => setF((a) => ({ ...a, pagina: a.pagina - 1 }))}>Anterior</Botao>
            <Botao disabled={f.pagina >= paginas} onClick={() => setF((a) => ({ ...a, pagina: a.pagina + 1 }))}>Próxima</Botao>
          </div>
        </div>
      )}
    </>
  );
}

export default function Pagina() {
  return <Suspense fallback={null}><Fila /></Suspense>;
}
