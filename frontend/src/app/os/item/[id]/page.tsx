"use client";
 
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Mail, Search } from "lucide-react";
import { ANDAMENTOS, Aviso, Botao, Campo, Cartao, Etiqueta, EtiquetaAba, Estado, NIVEIS, Rotulo, api, campoCls, diasAte, fmtData, fmtDataHora, fmtNum, fmtReais, td, textoPrazo, th, theadCls, tomAndamento, tomNivel, useAcao, useApi, useEu, type J } from "../../_lib";

const ALERTAS: Record<string, string> = {
  parece_total: "Parece valor total, não unitário",
  divergente: "Preço divergente do último registrado",
  sem_preco: "Sem preço de compra",
};
const ORIGENS: Record<string, string> = { historia: "já cotou este produto", marca: "atende a marca", busca: "busca", equipe: "indicado pela equipe" };
const numero = (t: string) => (t.trim() === "" ? null : Number(t.replace(/\./g, "").replace(",", ".")));

const STATUS_BASE: Record<string, string> = { ganha: "Ganha", cotada: "Cotada", declinada: "Declinada", sem_preco: "Sem preço" };

function Valores({ v }: { v: J }) {
  const partes = [
    "preco_compra" in v && ["Compra", fmtReais(v.preco_compra)],
    "ipi" in v && v.ipi != null && ["IPI", `${fmtNum(v.ipi, 2)}%`],
    "frete" in v && v.frete != null && ["Frete", fmtReais(v.frete)],
    "preco_venda" in v && ["Venda", fmtReais(v.preco_venda)],
    "margem_pct" in v && v.margem_pct != null && ["Margem", `${fmtNum(v.margem_pct, 1)}%`],
    "margem_final" in v && v.margem_final != null && ["Margem final", `${fmtNum(v.margem_final, 2)}%`],
  ].filter(Boolean) as string[][];
  if (!partes.length) return <span className="text-[#98A2B3]">valores não visíveis para o seu perfil</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-0.5 tabular-nums">
      {partes.map(([k, val]) => <span key={k}><span className="text-[12px] text-[#667085]">{k}</span> {val || "–"}</span>)}
    </span>
  );
}

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const eu = useEu();
  const ficha = useApi<J>(`/os/itens/${id}`);
  const d = ficha.dados;
  const pid = d?.produto.id;
  const forn = useApi<J>(pid ? `/os/produtos/${pid}/fornecedores` : null);
  const cot = useApi<J>(d ? `/os/itens/${id}/cotacoes` : null);
  const sol = useApi<J[]>(d ? `/os/itens/${id}/solicitacoes` : null);
  const acao = useAcao();
  const tudo = () => { ficha.recarregar(); forn.recarregar(); cot.recarregar(); sol.recarregar(); };

  const [motivo, setMotivo] = useState("");
  const [declinando, setDeclinando] = useState(false);
  const [buscaF, setBuscaF] = useState("");
  const achados = useApi<J>(buscaF.trim().length >= 2 ? "/os/fornecedores" : null, { busca: buscaF });
  const [email, setEmail] = useState<J | null>(null);
  const [nova, setNova] = useState<J>({ fornecedor_id: "", conta_id: "", preco_compra: "", ipi: "", frete: "", preco_venda: "" });
  const [just, setJust] = useState<Record<number, string>>({});
  const [res, setRes] = useState({ resultado: "ganha", pedido_venda: "" });

  if (!d) return <Estado erro={ficha.erro} carregando={ficha.carregando} />;
  const { item, produto } = d;
  const podeCotar = eu.pode("cotacao.lancar");
  const podeVincular = eu.pode("fornecedor.vincular");
  const podeResolver = eu.pode("identificacao.resolver");
  const cotacoes: J[] = cot.dados?.cotacoes || [];
  const atual = cotacoes.find((c) => c.situacao !== "substituida");
  const aceitaCotacao = ["a_cotar", "em_cotacao", "enviada"].includes(item.andamento);

  const andamento = (para: string, mot?: string) =>
    acao.rodar(async () => { await api(`/os/itens/${id}/andamento`, { metodo: "PATCH", corpo: { para, motivo: mot } }); setDeclinando(false); setMotivo(""); tudo(); });

  const lancar = () =>
    acao.rodar(async () => {
      await api(`/os/itens/${id}/cotacoes`, { metodo: "POST", corpo: {
        fornecedor_id: nova.fornecedor_id ? Number(nova.fornecedor_id) : null, conta_id: nova.conta_id ? Number(nova.conta_id) : null,
        preco_compra: numero(nova.preco_compra), ipi: numero(nova.ipi), frete: numero(nova.frete), preco_venda: numero(nova.preco_venda) } });
      setNova({ ...nova, preco_compra: "", ipi: "", frete: "", preco_venda: "" });
      tudo();
    });

  const abrirEmail = (f: J) => acao.rodar(async () => setEmail({ ...(await api("/os/solicitacoes", { metodo: "POST", corpo: { item_id: Number(id), fornecedor_id: f.id } })), fornecedor: f }));
  const registrarEmail = () =>
    acao.rodar(async () => {
      const r = await api("/os/solicitacoes", { metodo: "POST", corpo: { item_id: Number(id), fornecedor_id: email!.fornecedor.id, assunto: email!.assunto, texto: email!.texto, registrar: true } });
      window.location.href = `mailto:${encodeURIComponent(r.para || "")}?subject=${encodeURIComponent(r.assunto)}&body=${encodeURIComponent(r.texto)}`;
      setEmail(null); sol.recarregar();
    });

  const unidade = (item.unidade || "").split("-")[0].toLowerCase();
  const dPrazo = diasAte(item.prazo);
  const urgente = !item.expirado && dPrazo !== null && dPrazo <= 2;
  const margemPrevia = (() => {
    const c = numero(nova.preco_compra), v = numero(nova.preco_venda);
    if (!eu.pode("margem.ver") || c == null || v == null || !v) return null;
    const custo = c * (1 + (numero(nova.ipi) || 0) / 100) + (numero(nova.frete) || 0);
    return ((v - custo) / v) * 100;
  })();

  return (
    <div>
      <Link href="/os" className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#00756D] hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> Fila de cotações</Link>

      <div className="mt-4 border-b border-[#EAECF0] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              {produto.nome}{" "}
              {(produto.fabricante || produto.referencia) && <span className="mono align-middle text-[16px] font-normal text-[#344054]">{[produto.fabricante, produto.referencia].filter(Boolean).join(" / ")}</span>}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
              <Etiqueta tom={tomNivel(produto.nivel)}>Identidade: {NIVEIS[produto.nivel].toLowerCase()}</Etiqueta>
              {d.codigos.slice(0, 3).map((c: J) => <Etiqueta key={c.codigo} tom="contorno" mono>{c.codigo}</Etiqueta>)}
              {d.codigos.length > 3 && <Etiqueta tom="contorno">+{d.codigos.length - 3} códigos</Etiqueta>}
              <Etiqueta>{d.ocorrencias} ocorrência{d.ocorrencias > 1 ? "s" : ""}</Etiqueta>
              {item.expirado ? <Etiqueta tom="ruim">Expirada</Etiqueta> : item.andamento !== "a_cotar" ? <Etiqueta tom={tomAndamento(item.andamento)}>{ANDAMENTOS[item.andamento]}</Etiqueta> : <EtiquetaAba aba={item.aba} />}
              <span className="text-[#344054]">
                {item.uf || "UF não informada"} · {fmtNum(item.quantidade)} {unidade} · encerra <span className={`font-semibold ${urgente || item.expirado ? "text-[#B42318]" : ""}`}>{fmtData(item.prazo)}</span> ({textoPrazo(item.prazo)})
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[#667085]">Evento {item.numero_evento} · {d.contas.map((c: J) => c.nome).join(" e ")}{item.linhas > 1 && ` · ${item.linhas} linhas deste produto no evento (quantidade somada)`}{item.responsavel && ` · em cotação por ${item.responsavel}`}</p>
          </div>
          {podeCotar && (
            <div className="flex flex-wrap gap-2">
              {item.andamento === "a_cotar" && <Botao variante="primario" disabled={acao.ocupado} onClick={() => andamento("em_cotacao")}>Assumir cotação</Botao>}
              {item.andamento === "em_cotacao" && <Botao disabled={acao.ocupado} onClick={() => andamento("a_cotar")}>Devolver para a fila</Botao>}
              {d.transicoes.includes("declinada") && <Botao variante="perigo" onClick={() => setDeclinando(!declinando)}>Declinar</Botao>}
              {item.andamento === "declinada" && <Botao disabled={acao.ocupado} onClick={() => andamento("a_cotar")}>Reabrir</Botao>}
            </div>
          )}
        </div>
        {declinando && (
          <form onSubmit={(e) => { e.preventDefault(); andamento("declinada", motivo); }} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)] p-4">
            <div className="min-w-64 flex-1"><Campo rotulo="Motivo do declínio (fica guardado para análise)"><input autoFocus required className={campoCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem fornecedor, prazo curto, fora do portfólio" /></Campo></div>
            <Botao type="submit" variante="perigo" disabled={acao.ocupado}>Confirmar declínio</Botao>
          </form>
        )}
        {produto.descricao && <p className="mono mt-4 text-[12.5px] leading-relaxed text-[#344054]">{produto.descricao}</p>}
        {d.linhas[0]?.link_evento && <a href={d.linhas[0].link_evento} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#00756D] hover:underline"><ExternalLink className="h-4 w-4" aria-hidden /> Abrir o evento no Coupa</a>}
      </div>
      {acao.erro && <div className="mt-4"><Aviso tom="ruim">{acao.erro}</Aviso></div>}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-5">
          <Cartao titulo="Fornecedores deste produto" sub={`${forn.dados?.vinculados.length ?? 0} vinculado${(forn.dados?.vinculados.length ?? 0) === 1 ? "" : "s"}`}>
            <Estado erro={forn.erro} carregando={forn.carregando && !forn.dados}>
              {forn.dados?.vinculados.length ? (
                <div className="space-y-4">
                  {forn.dados.vinculados.map((f: J) => (
                    <div key={f.id} className="rounded-lg border border-[#EAECF0] p-4">
                      <div className="text-[16px] font-bold">{f.nome}</div>
                      <div className="text-[13px] text-[#667085]">{[[f.cidade, f.uf].filter(Boolean).join(" · "), f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "sem contato cadastrado"}</div>
                      <div className="mt-3 grid grid-cols-2 gap-4 border-y border-[#F0F2F5] py-3">
                        <div>
                          <Rotulo>Último preço</Rotulo>
                          {"ultimo_preco" in f ? (f.ultimo_preco != null
                            ? <><div className="mt-1 text-[17px] font-bold tabular-nums">{fmtReais(f.ultimo_preco)}</div><div className="text-[12px] text-[#667085]">{fmtData(f.ultimo_preco_em)}</div></>
                            : <div className="mt-1 text-[14px] text-[#667085]">sem preço registrado</div>)
                            : <div className="mt-1 text-[14px] text-[#98A2B3]">não visível no seu perfil</div>}
                        </div>
                        <div>
                          <Rotulo>Cotações ganhas</Rotulo>
                          <div className="mt-1 text-[17px] font-bold tabular-nums">{f.ganhas}</div>
                          <div className="text-[12px] text-[#667085]">origem: {ORIGENS[f.origem] || f.origem}</div>
                        </div>
                      </div>
                      {podeVincular && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Botao disabled={acao.ocupado} onClick={() => abrirEmail(f)}><Mail className="h-4 w-4" aria-hidden /> Pedir cotação por e-mail</Botao>
                          <Botao variante="texto" disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/fornecedores/${f.id}`, { metodo: "DELETE" }); tudo(); })}>Desvincular</Botao>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-[14px] text-[#667085]">Nenhum fornecedor vinculado a este produto ainda.</p>}

              {(forn.dados?.sugestoes.length ?? 0) > 0 && (
                <div className="mt-4 rounded-lg bg-[#FFFAEB] p-4">
                  <Rotulo className="text-[#7A5210]">Sugestões · confirme antes de usar</Rotulo>
                  <ul className="mt-2 space-y-2">
                    {forn.dados!.sugestoes.map((s: J) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                        <span><span className="font-semibold">{s.nome}</span> <span className="text-[13px] text-[#7A5210]">Fonte: {s.fonte}</span></span>
                        {podeVincular && (
                          <span className="flex gap-1">
                            <Botao disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/fornecedores`, { metodo: "POST", corpo: { fornecedor_id: s.id, origem: "marca" } }); tudo(); })}>Confirmar</Botao>
                            <Botao variante="texto" disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/sugestoes/${s.id}/descartar`, { metodo: "POST" }); forn.recarregar(); })}>Descartar</Botao>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {podeVincular && (
                <div className="mt-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden />
                    <input aria-label="Buscar fornecedor para vincular" className={`${campoCls} pl-9`} placeholder="Buscar outros fornecedores para vincular" value={buscaF} onChange={(e) => setBuscaF(e.target.value)} />
                  </div>
                  {buscaF.trim().length >= 2 && (
                    <ul className="max-h-44 overflow-auto border border-t-0 border-[#C9D0D8]">
                      {(achados.dados?.fornecedores || []).filter((f: J) => !forn.dados?.vinculados.some((v: J) => v.id === f.id)).map((f: J) => (
                        <li key={f.id}><button className="w-full px-3 py-2 text-left text-[14px] hover:bg-[#F8F9FB]" onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/fornecedores`, { metodo: "POST", corpo: { fornecedor_id: f.id, origem: "equipe" } }); setBuscaF(""); tudo(); })}>{f.nome} <span className="text-[12px] text-[#667085]">{[f.cidade, f.uf].filter(Boolean).join(" · ")}</span></button></li>
                      ))}
                      {achados.dados && !achados.dados.fornecedores.length && <li className="px-3 py-2 text-[14px] text-[#667085]">Nenhum cadastro com esse nome. <Link href="/os/fornecedores" className="font-semibold text-[#00756D] hover:underline">Cadastrar fornecedor</Link></li>}
                    </ul>
                  )}
                </div>
              )}

              {email && (
                <div className="rounded-lg mt-4 border border-[#EAECF0] p-4">
                  <div className="mb-3 text-[15px] font-bold">Pedido de cotação para {email.fornecedor.nome}</div>
                  <div className="space-y-3">
                    <Campo rotulo="Assunto"><input className={campoCls} value={email.assunto} onChange={(e) => setEmail({ ...email, assunto: e.target.value })} /></Campo>
                    <Campo rotulo="Mensagem" dica="O envio é bloqueado se o texto tiver qualquer valor em reais ou preço de compra registrado."><textarea rows={10} className={`${campoCls} mono text-[13px]`} value={email.texto} onChange={(e) => setEmail({ ...email, texto: e.target.value })} /></Campo>
                    {!email.para && <Aviso tom="alerta">Este fornecedor não tem e-mail cadastrado. O programa de e-mail vai abrir sem destinatário.</Aviso>}
                    <div className="flex gap-2">
                      <Botao variante="primario" disabled={acao.ocupado} onClick={registrarEmail}>Registrar e abrir no meu e-mail</Botao>
                      <Botao onClick={() => setEmail(null)}>Cancelar</Botao>
                    </div>
                  </div>
                </div>
              )}
              {sol.dados && sol.dados.length > 0 && (
                <p className="mt-3 text-[12px] text-[#667085]">Pedidos registrados: {sol.dados.map((s) => `${s.fornecedor} em ${fmtDataHora(s.enviada_em)} por ${s.por || "?"}`).join("; ")}.</p>
              )}
            </Estado>
          </Cartao>

          <Cartao titulo="Cotações anteriores" sub={`${d.anteriores.length + d.historico_importado.length} registro${d.anteriores.length + d.historico_importado.length === 1 ? "" : "s"}`} semPadding>
            {d.anteriores.length || d.historico_importado.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead className={theadCls}><tr><th className={th}>Data</th><th className={th}>Evento</th><th className={th}>Fornecedor</th><th className={th}>Valores</th><th className={th}>Resultado</th></tr></thead>
                  <tbody>
                    {d.anteriores.map((a: J) => (
                      <tr key={a.id} className="border-b border-[#F0F2F5] last:border-0">
                        <td className={`${td} tabular-nums`}>{fmtData(a.capturado_em)}</td>
                        <td className={td}><Link href={`/os/item/${a.id}`} className="mono text-[13px] font-medium text-[#00756D] hover:underline">{a.numero_evento}</Link><div className="text-[12px] text-[#667085]">{fmtNum(a.quantidade_total)} {unidade}</div></td>
                        <td className={td}>{a.fornecedor || <span className="text-[#98A2B3]">–</span>}</td>
                        <td className={td}>{a.cotacao_id ? <Valores v={a.valores} /> : <span className="text-[#98A2B3]">sem cotação registrada</span>}</td>
                        <td className={td}><Etiqueta tom={tomAndamento(a.resultado || a.andamento)}>{ANDAMENTOS[a.resultado || a.andamento]}</Etiqueta></td>
                      </tr>
                    ))}
                    {d.historico_importado.map((h: J, i: number) => (
                      <tr key={`h${i}`} className="border-b border-[#F0F2F5] last:border-0">
                        <td className={`${td} tabular-nums`}>{fmtData(h.data_ref)}</td>
                        <td className={td}>
                          {h.evento ? <span className="mono text-[13px] font-medium">{h.evento}</span> : null} <Etiqueta>base da Seven</Etiqueta>
                          {h.quantidade != null && <div className="text-[12px] text-[#667085]">{fmtNum(h.quantidade)} {unidade}</div>}
                        </td>
                        <td className={td}>{h.fornecedor_texto || "–"}</td>
                        <td className={td}><Valores v={h.valores} /></td>
                        <td className={td}>
                          <Etiqueta tom={h.status === "ganha" ? "bom" : h.status === "declinada" ? "ruim" : undefined}>{STATUS_BASE[h.status] || h.status || "–"}</Etiqueta>
                          {h.pedido_venda && <div className="mt-1 text-[12px] text-[#667085]">PV {h.pedido_venda}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-5 text-[14px] text-[#667085]">Primeira aparição deste produto: sem cotação anterior.</p>}
          </Cartao>

          <Cartao titulo="Mesma peça, códigos diferentes">
            {["conferir", "nao_identificavel"].includes(produto.nivel) && <div className="mb-3"><Aviso tom="alerta">A descrição não basta para identificar a peça. <Link href="/os/conferencia" className="font-semibold underline">Resolver na conferência manual</Link>.</Aviso></div>}
            <div className="flex flex-wrap gap-1.5">
              {d.codigos.length ? d.codigos.map((c: J) => <Etiqueta key={c.codigo} tom="contorno" mono>{c.codigo}{c.motivo?.startsWith("juncao") && " · juntado"}</Etiqueta>) : <span className="text-[14px] text-[#667085]">Linha capturada sem código Vale.</span>}
            </div>
            {d.mesma_referencia.length > 0 && (
              <div className="mt-4">
                <Rotulo>Mesma referência em outro código</Rotulo>
                <p className="mt-1 text-[13px] text-[#667085]">O sistema não junta sozinho. Confirme só se for a mesma peça física; dá para desfazer.</p>
                <ul className="mt-2 divide-y divide-[#F0F2F5]">
                  {d.mesma_referencia.map((p: J) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                      <span>{p.nome} <span className="mono text-[12px] text-[#667085]">{[p.fabricante, p.referencia].filter(Boolean).join(" / ")} · {(p.codigos || []).join(", ") || "sem código"}</span></span>
                      {podeResolver && <Botao disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/juntar`, { metodo: "POST", corpo: { origem_id: p.id } }); tudo(); })}>É a mesma peça</Botao>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.juncoes.length > 0 && (
              <div className="mt-4">
                <Rotulo>Junções feitas</Rotulo>
                <ul className="mt-2 divide-y divide-[#F0F2F5]">
                  {d.juncoes.map((j: J) => (
                    <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                      <span>{j.origem_nome} <span className="mono text-[12px] text-[#667085]">{(j.codigos || []).join(", ") || "sem código"} · {fmtData(j.em)}</span></span>
                      {podeResolver && <Botao variante="texto" disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/juncoes/${j.id}/desfazer`, { metodo: "POST" }); tudo(); })}>Desfazer</Botao>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Cartao>

          <div className="grid gap-5 md:grid-cols-2">
            <Cartao titulo="Declínios deste produto" sub={String(d.declinios.length)}>
              {d.declinios.length ? (
                <ul className="divide-y divide-[#F0F2F5] text-[14px]">
                  {d.declinios.map((x: J, i: number) => <li key={i} className="py-2"><div className="font-semibold">{x.motivo}</div><div className="text-[12px] text-[#667085]">evento {x.numero_evento} · {fmtDataHora(x.em)} · {x.por || "?"}</div></li>)}
                </ul>
              ) : <p className="text-[14px] text-[#667085]">Nunca declinado.</p>}
            </Cartao>
            <Cartao titulo="Andamento do item">
              {d.andamentos.length ? (
                <ul className="divide-y divide-[#F0F2F5] text-[14px]">
                  {d.andamentos.map((x: J, i: number) => <li key={i} className="py-2">{ANDAMENTOS[x.de] || "–"} → <span className="font-semibold">{ANDAMENTOS[x.para]}</span>{x.motivo && `: ${x.motivo}`}<div className="text-[12px] text-[#667085]">{fmtDataHora(x.em)} · {x.por || "?"}</div></li>)}
                </ul>
              ) : <p className="text-[14px] text-[#667085]">Sem movimentação. Capturado em {fmtDataHora(item.capturado_em)}.</p>}
            </Cartao>
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-20">
          {cot.dados?.resultado && <Aviso tom={cot.dados.resultado.resultado === "ganha" ? "bom" : "alerta"}>Resultado: {ANDAMENTOS[cot.dados.resultado.resultado]}{cot.dados.resultado.pedido_venda && ` · pedido ${cot.dados.resultado.pedido_venda}`}</Aviso>}

          {podeCotar && aceitaCotacao && (
            <section className="rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)]">
              <header className="border-b border-[#F0F2F5] px-5 py-4">
                <h2 className="text-[17px] font-bold">{cotacoes.length ? "Nova versão da cotação" : "Nova cotação"}</h2>
                <p className="text-[13px] text-[#667085]">Valores unitários · {fmtNum(item.quantidade)} {unidade}</p>
              </header>
              <form onSubmit={(e) => { e.preventDefault(); lancar(); }}>
                <div className="space-y-4 px-5 py-5">
                  <Campo rotulo="Fornecedor">
                    <select className={campoCls} value={nova.fornecedor_id} onChange={(e) => setNova({ ...nova, fornecedor_id: e.target.value })}>
                      <option value="">Sem fornecedor</option>
                      {(forn.dados?.vinculados || []).map((f: J) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </Campo>
                  {d.contas.length > 1 && (
                    <Campo rotulo="CNPJ que vai responder">
                      <select required className={campoCls} value={nova.conta_id} onChange={(e) => setNova({ ...nova, conta_id: e.target.value })}>
                        <option value="">Escolha</option>
                        {d.contas.filter((c: J) => eu.contas.some((x) => x.id === c.id)).map((c: J) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Campo>
                  )}
                  <Campo rotulo="Preço de compra (R$)"><input inputMode="decimal" className={`${campoCls} h-[42px] text-[16px]`} value={nova.preco_compra} onChange={(e) => setNova({ ...nova, preco_compra: e.target.value })} placeholder="0,00" /></Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo rotulo="IPI (%)"><input inputMode="decimal" className={campoCls} value={nova.ipi} onChange={(e) => setNova({ ...nova, ipi: e.target.value })} placeholder="0" /></Campo>
                    <Campo rotulo="Frete unit. (R$)"><input inputMode="decimal" className={campoCls} value={nova.frete} onChange={(e) => setNova({ ...nova, frete: e.target.value })} placeholder="0,00" /></Campo>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo rotulo="Preço de venda unit. (R$)"><input inputMode="decimal" className={campoCls} value={nova.preco_venda} onChange={(e) => setNova({ ...nova, preco_venda: e.target.value })} placeholder="0,00" /></Campo>
                    {eu.pode("margem.ver") && (
                      <div>
                        <span className="mb-1.5 block text-[13px] font-semibold">Margem resultante</span>
                        <div className="flex h-[40px] items-center rounded-lg bg-[#F2F4F7] px-3 text-[14px] font-semibold tabular-nums">{margemPrevia == null ? "—" : `${fmtNum(margemPrevia, 1)}%`}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[#F0F2F5] px-5 py-4">
                  <button type="submit" disabled={acao.ocupado} className="h-[44px] flex-1 rounded-lg bg-[#0B1A2A] px-4 text-left text-[15px] font-semibold text-white hover:bg-[#1E3550] disabled:opacity-50">{cotacoes.length ? "Registrar nova versão" : "Registrar cotação"}</button>
                  {item.andamento === "em_cotacao" && atual && (
                    <Botao type="button" className="h-[44px]" disabled={acao.ocupado || atual.situacao !== "pronta"} title={atual.situacao !== "pronta" ? "Resolva os alertas antes" : ""} onClick={() => acao.rodar(async () => { await api(`/os/itens/${id}/enviar`, { metodo: "POST" }); tudo(); })}>Marcar enviada no Coupa</Botao>
                  )}
                </div>
              </form>
            </section>
          )}

          {podeCotar && ["enviada", "ganha", "perdida"].includes(item.andamento) && (
            <Cartao titulo="Resultado no Coupa" destaque>
              <form onSubmit={(e) => { e.preventDefault(); acao.rodar(async () => { await api(`/os/itens/${id}/resultado`, { metodo: "POST", corpo: res }); tudo(); }); }} className="grid grid-cols-2 gap-3">
                <Campo rotulo="Resultado"><select className={campoCls} value={res.resultado} onChange={(e) => setRes({ ...res, resultado: e.target.value })}><option value="ganha">Ganha</option><option value="perdida">Perdida</option></select></Campo>
                <Campo rotulo="Nº do pedido de venda"><input className={`${campoCls} mono`} placeholder="Preencher quando ganhar" value={res.pedido_venda} onChange={(e) => setRes({ ...res, pedido_venda: e.target.value })} /></Campo>
                <div className="col-span-2"><Botao type="submit" variante="primario" disabled={acao.ocupado}>Registrar resultado</Botao></div>
              </form>
            </Cartao>
          )}

          <Cartao titulo="Versões desta cotação" sub={String(cotacoes.length)}>
            <Estado erro={cot.erro} carregando={cot.carregando && !cot.dados}>
              {cotacoes.length === 0 && <p className="text-[14px] text-[#667085]">Nenhuma cotação lançada para este item.</p>}
              <ul className="space-y-3">
                {cotacoes.map((c) => (
                  <li key={c.id} className={`rounded-lg border p-3 text-[14px] ${c.situacao === "substituida" ? "border-[#F0F2F5] bg-[#F8F9FB] text-[#667085]" : "border-[#C9D0D8]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">v{c.versao} · {c.fornecedor || "sem fornecedor"}{c.conta && ` · ${c.conta}`}</span>
                      <Etiqueta tom={({ pronta: "bom", enviada: "info", rascunho: "alerta" } as J)[c.situacao] || "neutro"}>{({ pronta: "Pronta para enviar", enviada: "Enviada", rascunho: "Alerta aberto", substituida: "Substituída" } as J)[c.situacao]}</Etiqueta>
                    </div>
                    <div className="mt-1.5"><Valores v={c.valores} /></div>
                    <div className="mt-1 text-[12px] text-[#667085]">por {c.por || "?"} em {fmtDataHora(c.criada_em)}</div>
                    {c.alertas.map((a: J) => (
                      <div key={a.id} className={`mt-2 rounded-md p-2.5 ${a.situacao === "aberto" ? "bg-[#FDF4E3]" : "bg-[#F8F9FB]"}`}>
                        <div className="font-semibold text-[#7A5210]">{ALERTAS[a.tipo]}{a.valor_referencia != null && ` (último unitário: ${fmtReais(a.valor_referencia)})`}</div>
                        {a.situacao === "justificado" ? <div className="text-[12px] text-[#344054]">Mantido com justificativa: {a.justificativa}</div>
                          : a.tipo === "sem_preco" ? <div className="text-[12px] text-[#7A5210]">Lance uma nova versão com o preço de compra.</div>
                          : podeCotar && c.situacao !== "substituida" && (
                            <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); acao.rodar(async () => { await api(`/os/alertas/${a.id}/justificar`, { metodo: "POST", corpo: { justificativa: just[a.id] || "" } }); cot.recarregar(); }); }}>
                              <input required minLength={5} aria-label="Justificativa" className={`${campoCls} min-w-48 flex-1`} placeholder="Corrija com nova versão ou justifique" value={just[a.id] || ""} onChange={(e) => setJust({ ...just, [a.id]: e.target.value })} />
                              <Botao type="submit" disabled={acao.ocupado}>Manter</Botao>
                            </form>
                          )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </Estado>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
