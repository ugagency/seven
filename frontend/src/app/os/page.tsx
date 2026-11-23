"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { ABAS, ANDAMENTOS, Aviso, Botao, COR_ABA, Etiqueta, EtiquetaAba, Estado, Rotulo, Titulo, baixar, campoCls, diasAte, fmtNum, fmtReais, th, theadCls, tomAndamento, useAcao, useApi, useEu, type J } from "./_lib";

const daqui = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
const dataCurta = (v?: string | null) => (v ? new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "sem prazo");
function falta(prazo?: string | null) {
  const d = diasAte(prazo);
  if (d === null) return "";
  if (d < 0) return "encerrado";
  if (d === 0) return "encerra hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

function Kpi({ rotulo, valor, sub, cor, onClick }: { rotulo: string; valor: string; sub?: string; cor?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="border-[#DCE0E5] px-5 py-5 text-left hover:bg-[#F6F8FA] [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-t-0">
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1.5 text-[34px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: cor || "#0B1A2A" }}>{valor}</div>
      {sub && <div className="mt-2 text-[13px] text-[#5A6573]">{sub}</div>}
    </button>
  );
}

function Fila() {
  const eu = useEu();
  const router = useRouter();
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
  const [mais, setMais] = useState(!!(f.conta || f.andamento || f.capturado_de || f.sem_fornecedor || f.situacao !== "abertos"));
  const muda = (m: J) => setF((a) => ({ ...a, pagina: 1, ...m }));
  const { dados, erro, carregando } = useApi<J>("/os/fila", f);
  const cartoes = useApi<J>("/os/fila/cartoes");
  const exp = useAcao();
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / 50)) : 1;
  const comValor = eu.pode("valor_aberto.ver");
  const filtrando = f.busca || f.uf || f.prefixo || f.conta || f.andamento || f.prazo_ate || f.capturado_de || f.sem_fornecedor || f.situacao !== "abertos";
  const c = cartoes.dados;

  return (
    <>
      <Titulo sub="Cotações abertas no Coupa da Vale, capturadas pelo robô. Clique num item para abrir a ficha."
        acoes={eu.pode("exportar") && (
          <Botao disabled={exp.ocupado} onClick={() => exp.rodar(() => baixar("/os/fila/exportar", { params: { ...f, pagina: undefined } }, "fila.xlsx"))}>
            <Download className="h-4 w-4" aria-hidden /> {exp.ocupado ? "Gerando…" : "Exportar esta lista"}
          </Botao>
        )}>
        Fila de cotações
      </Titulo>
      {exp.erro && <div className="mb-3"><Aviso tom="ruim">{exp.erro}</Aviso></div>}

      <div className={`mb-5 grid border border-[#DCE0E5] border-t-2 border-t-[#0B1A2A] bg-white ${comValor ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Kpi rotulo="Em aberto" valor={fmtNum(c?.em_aberto) || "–"} sub="itens a cotar ou em cotação" onClick={() => muda({ situacao: "abertos", prazo_ate: "", andamento: "" })} />
        <Kpi rotulo="Em cotação por você" valor={fmtNum(c?.aguardando_voce) || "–"} cor="#00756D" sub="itens que você assumiu" onClick={() => { setMais(true); muda({ situacao: "abertos", andamento: "em_cotacao" }); }} />
        <Kpi rotulo="Encerra em 48h" valor={fmtNum(c?.encerra_48h) || "–"} cor="#B42318" sub="itens com prazo curto" onClick={() => muda({ situacao: "abertos", prazo_ate: daqui(2), ordem: "prazo" })} />
        {comValor && <Kpi rotulo="Valor estimado" valor={c?.valor_estimado != null ? fmtReais(c.valor_estimado).replace(/,\d\d$/, "") : "sem base"} sub={c ? `pelo último preço de venda · ${fmtNum(c.itens_com_valor)} itens` : ""} onClick={() => muda({ ordem: "valor" })} />}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); muda({ busca }); }} className="mb-2 flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-[2]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6573]" aria-hidden />
          <input aria-label="Buscar" className={`${campoCls} pl-9`} placeholder="Buscar descrição, código Vale, marca, referência ou evento" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <input aria-label="UF" className={campoCls} style={{ width: 110 }} placeholder="UF: todas" maxLength={2} value={f.uf} onChange={(e) => muda({ uf: e.target.value.toUpperCase() })} />
        <select aria-label="Prefixo do código" className={campoCls} style={{ width: 150 }} value={f.prefixo} onChange={(e) => muda({ prefixo: e.target.value })}>
          <option value="">Prefixo: todos</option>{["13", "15", "16", "35"].map((p) => <option key={p} value={p}>Prefixo {p}…</option>)}
        </select>
        <select aria-label="Prazo" className={campoCls} style={{ width: 160 }} value={f.prazo_ate} onChange={(e) => muda({ prazo_ate: e.target.value })}>
          <option value="">Prazo: qualquer</option><option value={daqui(0)}>Encerra hoje</option><option value={daqui(2)}>Em até 48h</option><option value={daqui(7)}>Em até 7 dias</option>
        </select>
        <select aria-label="Ordenar por" className={campoCls} style={{ width: 180 }} value={f.ordem} onChange={(e) => muda({ ordem: e.target.value })}>
          <option value="prazo">Ordenar: prazo</option><option value="recorrencia">Ordenar: recorrência</option><option value="recentes">Ordenar: capturados por último</option>
          {comValor && <option value="valor">Ordenar: valor estimado</option>}
        </select>
        <Botao type="button" onClick={() => setMais(!mais)} aria-expanded={mais}><SlidersHorizontal className="h-4 w-4" aria-hidden /> Mais filtros</Botao>
        <button type="submit" className="sr-only">Buscar</button>
      </form>
      {mais && (
        <div className="mb-2 flex flex-wrap items-center gap-2 border border-[#DCE0E5] bg-white p-3">
          <select aria-label="Situação" className={campoCls} style={{ width: 150 }} value={f.situacao} onChange={(e) => muda({ situacao: e.target.value })}>
            <option value="abertos">Em aberto</option><option value="expirados">Expirados</option><option value="todos">Todos</option>
          </select>
          <select aria-label="Andamento" className={campoCls} style={{ width: 190 }} value={f.andamento} onChange={(e) => muda({ andamento: e.target.value, situacao: e.target.value && !["a_cotar", "em_cotacao"].includes(e.target.value) ? "todos" : f.situacao })}>
            <option value="">Qualquer andamento</option>{Object.entries(ANDAMENTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="CNPJ" className={campoCls} style={{ width: 170 }} value={f.conta} onChange={(e) => muda({ conta: e.target.value })}>
            <option value="">Todos os CNPJs</option>{eu.contas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[14px]">Capturado desde <input type="date" className={campoCls} style={{ width: 160 }} value={f.capturado_de} onChange={(e) => muda({ capturado_de: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={f.sem_fornecedor} onChange={(e) => muda({ sem_fornecedor: e.target.checked })} /> Só sem fornecedor</label>
        </div>
      )}
      {filtrando && (
        <div className="mb-2 text-[13px]">
          <button className="font-semibold text-[#00756D] hover:underline" onClick={() => { setBusca(""); muda({ busca: "", uf: "", prefixo: "", conta: "", andamento: "", prazo_ate: "", capturado_de: "", sem_fornecedor: false, situacao: "abertos" }); }}>Limpar filtros</button>
        </div>
      )}

      <div className="mt-3 border border-[#DCE0E5] bg-white">
        <div role="tablist" aria-label="Abas da fila" className="flex flex-wrap border-b-2 border-[#0B1A2A] px-2">
          {[["", "Todos"], ...Object.entries(ABAS)].map(([k, rot]) => {
            const n = dados ? (k ? dados.abas[k] : Object.values(dados.abas as J).reduce((a: number, b: any) => a + b, 0)) : null;
            const sel = f.aba === k;
            return (
              <button key={k} role="tab" aria-selected={sel} onClick={() => muda({ aba: k })}
                className={`relative flex items-center gap-2 px-4 py-3.5 text-[14px] ${sel ? "font-bold" : "text-[#334255] hover:text-[#0B1A2A]"}`}>
                <span className="h-[9px] w-[9px]" style={{ background: k ? COR_ABA[k].c : "#0B1A2A" }} aria-hidden />
                {rot} {n !== null && <span className="text-[13px] font-normal tabular-nums text-[#5A6573]">{fmtNum(n as number)}</span>}
                {sel && <span className="absolute inset-x-0 -bottom-[2px] h-[3px] bg-[#0B1A2A]" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length && "Nenhum item com esses filtros."}>
            <table className="w-full min-w-[920px] border-collapse">
              <thead className={theadCls}>
                <tr><th className={th}>Item</th><th className={th}>O que já sabemos</th><th className={th}>Encerra</th><th className={th}>Estado</th>{comValor && <th className={`${th} text-right`}>Valor est.</th>}</tr>
              </thead>
              <tbody className={carregando ? "opacity-60" : ""}>
                {dados?.itens.map((i: J) => {
                  const d = diasAte(i.prazo);
                  const urgente = d !== null && d <= 2 && !i.expirado;
                  const p = i.produto;
                  const sub = [[p.fabricante, p.referencia].filter(Boolean).join(" / "), p.codigos[0] && `${p.codigos[0]}${p.codigos.length > 1 ? ` +${p.codigos.length - 1} códigos` : ""}`, i.uf, `${fmtNum(i.quantidade)} ${(i.unidade || "").split("-")[0].toLowerCase()}`].filter(Boolean).join(" · ");
                  return (
                    <tr key={i.id} onClick={() => router.push(`/os/item/${i.id}`)} className="cursor-pointer border-b border-[#E6E9ED] last:border-0 hover:bg-[#F6F8FA]">
                      <td className="relative py-4 pl-5 pr-4 align-top">
                        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: COR_ABA[i.aba]?.c }} aria-hidden />
                        <Link prefetch={false} href={`/os/item/${i.id}`} onClick={(e) => e.stopPropagation()} className="text-[15px] font-semibold text-[#0B1A2A] hover:underline">{p.nome}</Link>
                        <div className="mono mt-1 text-[12.5px] text-[#5A6573]">{sub}</div>
                        <div className="mt-1 text-[12px] text-[#8A94A0]">Evento {i.numero_evento} · {i.contas.map((x: number) => eu.nomeConta(x)).join(" e ")}{i.linhas > 1 && ` · ${i.linhas} linhas no evento`}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-[14px]">
                        {i.fornecedores ? <div className="font-semibold">{i.fornecedores} fornecedor{i.fornecedores > 1 ? "es" : ""} vinculado{i.fornecedores > 1 ? "s" : ""}</div>
                          : p.nivel === "conferir" ? <div className="font-semibold text-[#4E3878]">conferir identificação</div>
                          : <div className="text-[#334255]">buscando</div>}
                        <div className="mt-0.5 text-[13px] text-[#5A6573]">
                          {i.ocorrencias > 1 ? `${i.ocorrencias} aparições` : "sem histórico"}{!i.fornecedores && i.ocorrencias > 1 && " · sem fornecedor vinculado"}
                        </div>
                        {i.declinios > 0 && <div className="mt-1"><Etiqueta tom="alerta">declinado {i.declinios}x</Etiqueta></div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top">
                        <div className={`text-[14px] font-semibold tabular-nums ${urgente || i.expirado ? "text-[#B42318]" : ""}`}>{dataCurta(i.prazo)}</div>
                        <div className={`text-[13px] ${urgente ? "text-[#B42318]" : "text-[#5A6573]"}`}>{falta(i.prazo)}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          {i.expirado ? <Etiqueta tom="ruim">Expirada</Etiqueta> : i.andamento !== "a_cotar" ? <Etiqueta tom={tomAndamento(i.andamento)}>{ANDAMENTOS[i.andamento]}</Etiqueta> : <EtiquetaAba aba={i.aba} />}
                          {i.responsavel && i.andamento === "em_cotacao" && <span className="text-[12px] text-[#5A6573]">por {i.responsavel}</span>}
                        </div>
                      </td>
                      {comValor && <td className="whitespace-nowrap px-5 py-4 text-right align-top text-[14px] font-semibold tabular-nums">{i.valor_estimado != null ? fmtReais(i.valor_estimado) : <span className="font-normal text-[#8A94A0]">–</span>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Estado>
        </div>
      </div>

      {dados && dados.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-[14px] text-[#5A6573]">
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
