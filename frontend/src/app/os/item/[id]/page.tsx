"use client";
 
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ABAS, ANDAMENTOS, Aviso, Botao, Campo, Cartao, Etiqueta, Estado, NIVEIS, api, campoCls, fmtData, fmtDataHora, fmtNum, fmtReais, td, textoPrazo, th, tomAndamento, tomNivel, useAcao, useApi, useEu, type J } from "../../_lib";

const ALERTAS: Record<string, string> = {
  parece_total: "Parece valor total, não unitário",
  divergente: "Preço divergente do último registrado",
  sem_preco: "Sem preço de compra",
};
const ORIGENS: Record<string, string> = { historia: "já cotou este produto", marca: "atende a marca", busca: "busca", equipe: "indicado pela equipe" };
const numero = (t: string) => (t.trim() === "" ? null : Number(t.replace(/\./g, "").replace(",", ".")));

function Valores({ v }: { v: J }) {
  const partes = [
    "preco_compra" in v && ["Compra", fmtReais(v.preco_compra)],
    "ipi" in v && v.ipi != null && ["IPI", `${fmtNum(v.ipi, 2)}%`],
    "frete" in v && v.frete != null && ["Frete", fmtReais(v.frete)],
    "preco_venda" in v && ["Venda", fmtReais(v.preco_venda)],
    "margem_pct" in v && v.margem_pct != null && ["Margem", `${fmtNum(v.margem_pct, 1)}%`],
  ].filter(Boolean) as string[][];
  if (!partes.length) return <span className="text-slate-400">valores não visíveis para o seu perfil</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-0.5 tabular-nums">
      {partes.map(([k, val]) => <span key={k}><span className="text-xs text-slate-500">{k}</span> {val || "–"}</span>)}
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

  return (
    <div className="space-y-4">
      <nav className="text-sm"><Link href="/os" className="text-indigo-700 hover:underline">Fila</Link> <span className="text-slate-400">/</span> <span className="text-slate-600">Evento {item.numero_evento}</span></nav>
      {acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}

      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{produto.nome}</h1>
            <p className="mt-0.5 text-sm text-slate-600">{[produto.fabricante, produto.referencia].filter(Boolean).join(" · ") || "Sem marca ou referência identificada"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Etiqueta tom={item.expirado ? "ruim" : tomAndamento(item.andamento)}>{item.expirado ? "Expirada" : ANDAMENTOS[item.andamento]}</Etiqueta>
              <Etiqueta>{ABAS[item.aba]}</Etiqueta>
              <Etiqueta tom={tomNivel(produto.nivel)}>Identificação: {NIVEIS[produto.nivel]}</Etiqueta>
              {item.responsavel && <Etiqueta tom="info">Em cotação por {item.responsavel}</Etiqueta>}
            </div>
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
          <form onSubmit={(e) => { e.preventDefault(); andamento("declinada", motivo); }} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
            <div className="min-w-64 flex-1"><Campo rotulo="Motivo do declínio (fica guardado para análise)"><input autoFocus required className={campoCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem fornecedor, prazo curto, fora do portfólio" /></Campo></div>
            <Botao type="submit" variante="perigo" disabled={acao.ocupado}>Confirmar declínio</Botao>
          </form>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4 xl:grid-cols-6">
          {[
            ["Evento", item.numero_evento],
            ["Quantidade", `${fmtNum(item.quantidade)} ${(item.unidade || "").split("-")[0]}`],
            ["Encerramento", `${fmtData(item.prazo)} (${textoPrazo(item.prazo)})`],
            ["UF", item.uf || "não informada"],
            ["Aparições do produto", fmtNum(d.ocorrencias)],
            ["CNPJs", d.contas.map((c: J) => c.nome).join(", ")],
          ].map(([k, v]) => (<div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>))}
        </dl>
        {produto.descricao && <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">{produto.descricao}</p>}
        {item.linhas > 1 && <p className="mt-2 text-xs text-slate-500">{item.linhas} linhas deste produto no mesmo evento; a quantidade acima é a soma.</p>}
        {d.linhas[0]?.link_evento && <a href={d.linhas[0].link_evento} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:underline">Abrir o evento no Coupa</a>}
      </Cartao>

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Fornecedores do produto">
          <Estado erro={forn.erro} carregando={forn.carregando && !forn.dados}>
            {forn.dados?.vinculados.length ? (
              <ul className="divide-y divide-slate-100">
                {forn.dados.vinculados.map((f: J) => (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">{f.nome} <span className="font-normal text-slate-500">{[f.cidade, f.uf].filter(Boolean).join("/")}</span></div>
                      <div className="text-xs text-slate-500">{[f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "sem contato cadastrado"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Origem: {ORIGENS[f.origem] || f.origem}
                        {"ultimo_preco" in f && (f.ultimo_preco != null ? <> · último preço {fmtReais(f.ultimo_preco)} em {fmtData(f.ultimo_preco_em)}</> : " · sem preço registrado")}
                        {f.ganhas > 0 && ` · ${f.ganhas} cotação(ões) ganha(s)`}
                      </div>
                    </div>
                    {podeVincular && (
                      <div className="flex gap-1">
                        <Botao variante="texto" disabled={acao.ocupado} onClick={() => abrirEmail(f)}>Pedir cotação</Botao>
                        <Botao variante="texto" disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/fornecedores/${f.id}`, { metodo: "DELETE" }); tudo(); })}>Desvincular</Botao>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600">Nenhum fornecedor vinculado a este produto.</p>}

            {(forn.dados?.sugestoes.length ?? 0) > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-900">Sugestões (confirme antes de usar)</div>
                <ul className="mt-1 space-y-1">
                  {forn.dados!.sugestoes.map((s: J) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span><span className="font-medium">{s.nome}</span> <span className="text-xs text-amber-900">Fonte: {s.fonte}</span></span>
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
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Campo rotulo="Vincular fornecedor já cadastrado"><input className={campoCls} placeholder="Digite parte do nome" value={buscaF} onChange={(e) => setBuscaF(e.target.value)} /></Campo>
                {buscaF.trim().length >= 2 && (
                  <ul className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200">
                    {(achados.dados?.fornecedores || []).filter((f: J) => !forn.dados?.vinculados.some((v: J) => v.id === f.id)).map((f: J) => (
                      <li key={f.id}><button className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/fornecedores`, { metodo: "POST", corpo: { fornecedor_id: f.id, origem: "equipe" } }); setBuscaF(""); tudo(); })}>{f.nome} <span className="text-xs text-slate-500">{[f.cidade, f.uf].filter(Boolean).join("/")}</span></button></li>
                    ))}
                    {achados.dados && !achados.dados.fornecedores.length && <li className="px-3 py-2 text-sm text-slate-500">Nenhum cadastro com esse nome. <Link href="/os/fornecedores" className="text-indigo-700 hover:underline">Cadastrar fornecedor</Link></li>}
                  </ul>
                )}
              </div>
            )}

            {email && (
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold">Pedido de cotação para {email.fornecedor.nome}</div>
                <div className="space-y-2">
                  <Campo rotulo="Assunto"><input className={campoCls} value={email.assunto} onChange={(e) => setEmail({ ...email, assunto: e.target.value })} /></Campo>
                  <Campo rotulo="Mensagem" dica="O envio é bloqueado se o texto tiver qualquer valor em reais ou preço de compra registrado."><textarea rows={10} className={campoCls} value={email.texto} onChange={(e) => setEmail({ ...email, texto: e.target.value })} /></Campo>
                  {!email.para && <Aviso tom="alerta">Este fornecedor não tem e-mail cadastrado. O programa de e-mail vai abrir sem destinatário.</Aviso>}
                  <div className="flex gap-2">
                    <Botao variante="primario" disabled={acao.ocupado} onClick={registrarEmail}>Registrar e abrir no meu e-mail</Botao>
                    <Botao onClick={() => setEmail(null)}>Cancelar</Botao>
                  </div>
                </div>
              </div>
            )}
            {sol.dados && sol.dados.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">Pedidos registrados: {sol.dados.map((s) => `${s.fornecedor} em ${fmtDataHora(s.enviada_em)} por ${s.por || "?"}`).join("; ")}.</p>
            )}
          </Estado>
        </Cartao>

        <Cartao titulo="Cotação">
          <Estado erro={cot.erro} carregando={cot.carregando && !cot.dados}>
            {cot.dados?.resultado && <div className="mb-3"><Aviso tom={cot.dados.resultado.resultado === "ganha" ? "bom" : "alerta"}>Resultado: {ANDAMENTOS[cot.dados.resultado.resultado]}{cot.dados.resultado.pedido_venda && ` · pedido ${cot.dados.resultado.pedido_venda}`}</Aviso></div>}
            {cotacoes.length === 0 && <p className="mb-3 text-sm text-slate-600">Nenhuma cotação lançada para este item.</p>}
            <ul className="space-y-2">
              {cotacoes.map((c) => (
                <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.situacao === "substituida" ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Versão {c.versao} · {c.fornecedor || "sem fornecedor"}{c.conta && ` · ${c.conta}`}</span>
                    <Etiqueta tom={({ pronta: "bom", enviada: "info", rascunho: "alerta" } as J)[c.situacao] || "neutro"}>{({ pronta: "Pronta para enviar", enviada: "Enviada", rascunho: "Com alerta aberto", substituida: "Substituída" } as J)[c.situacao]}</Etiqueta>
                  </div>
                  <div className="mt-1"><Valores v={c.valores} /></div>
                  <div className="mt-1 text-xs text-slate-500">por {c.por || "?"} em {fmtDataHora(c.criada_em)}</div>
                  {c.alertas.map((a: J) => (
                    <div key={a.id} className={`mt-2 rounded-lg p-2 ${a.situacao === "aberto" ? "bg-amber-50" : "bg-slate-50"}`}>
                      <div className="font-medium text-amber-900">{ALERTAS[a.tipo]}{a.valor_referencia != null && ` (último preço unitário: ${fmtReais(a.valor_referencia)})`}</div>
                      {a.situacao === "justificado" ? <div className="text-xs text-slate-600">Mantido com justificativa: {a.justificativa}</div>
                        : a.tipo === "sem_preco" ? <div className="text-xs text-amber-900">Lance uma nova versão com o preço de compra.</div>
                        : podeCotar && c.situacao !== "substituida" && (
                          <form className="mt-1 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); acao.rodar(async () => { await api(`/os/alertas/${a.id}/justificar`, { metodo: "POST", corpo: { justificativa: just[a.id] || "" } }); cot.recarregar(); }); }}>
                            <input required minLength={5} aria-label="Justificativa" className={`${campoCls} min-w-56 flex-1`} placeholder="Corrija com nova versão, ou justifique para manter" value={just[a.id] || ""} onChange={(e) => setJust({ ...just, [a.id]: e.target.value })} />
                            <Botao type="submit" disabled={acao.ocupado}>Manter com justificativa</Botao>
                          </form>
                        )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>

            {podeCotar && aceitaCotacao && (
              <form onSubmit={(e) => { e.preventDefault(); lancar(); }} className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-2 text-sm font-semibold">{cotacoes.length ? "Nova versão" : "Lançar cotação"} <span className="font-normal text-slate-500">valores unitários, para {fmtNum(item.quantidade)} {(item.unidade || "").split("-")[0]}</span></div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
                  <Campo rotulo="Preço de compra (un.)"><input inputMode="decimal" className={campoCls} value={nova.preco_compra} onChange={(e) => setNova({ ...nova, preco_compra: e.target.value })} placeholder="0,00" /></Campo>
                  <Campo rotulo="IPI (%)"><input inputMode="decimal" className={campoCls} value={nova.ipi} onChange={(e) => setNova({ ...nova, ipi: e.target.value })} placeholder="0" /></Campo>
                  <Campo rotulo="Frete (un.)"><input inputMode="decimal" className={campoCls} value={nova.frete} onChange={(e) => setNova({ ...nova, frete: e.target.value })} placeholder="0,00" /></Campo>
                  <Campo rotulo="Preço de venda (un.)"><input inputMode="decimal" className={campoCls} value={nova.preco_venda} onChange={(e) => setNova({ ...nova, preco_venda: e.target.value })} placeholder="0,00" /></Campo>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Botao type="submit" variante="primario" disabled={acao.ocupado}>{cotacoes.length ? "Salvar nova versão" : "Salvar cotação"}</Botao>
                  {item.andamento === "em_cotacao" && atual && (
                    <Botao type="button" disabled={acao.ocupado || atual.situacao !== "pronta"} title={atual.situacao !== "pronta" ? "Resolva os alertas antes" : ""} onClick={() => acao.rodar(async () => { await api(`/os/itens/${id}/enviar`, { metodo: "POST" }); tudo(); })}>Marcar como enviada no Coupa</Botao>
                  )}
                </div>
              </form>
            )}
            {podeCotar && ["enviada", "ganha", "perdida"].includes(item.andamento) && (
              <form onSubmit={(e) => { e.preventDefault(); acao.rodar(async () => { await api(`/os/itens/${id}/resultado`, { metodo: "POST", corpo: res }); tudo(); }); }} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <Campo rotulo="Resultado"><select className={campoCls} value={res.resultado} onChange={(e) => setRes({ ...res, resultado: e.target.value })}><option value="ganha">Ganha</option><option value="perdida">Perdida</option></select></Campo>
                <Campo rotulo="Pedido de venda"><input className={campoCls} value={res.pedido_venda} onChange={(e) => setRes({ ...res, pedido_venda: e.target.value })} /></Campo>
                <Botao type="submit" disabled={acao.ocupado}>Registrar resultado</Botao>
              </form>
            )}
          </Estado>
        </Cartao>
      </div>

      <Cartao titulo="Identificação e códigos">
        <div className="flex flex-wrap gap-1">
          {d.codigos.length ? d.codigos.map((c: J) => <Etiqueta key={c.codigo}>{c.codigo}{c.motivo?.startsWith("juncao") && " (juntado)"}</Etiqueta>) : <span className="text-sm text-slate-600">Linha capturada sem código Vale.</span>}
        </div>
        {["conferir", "nao_identificavel"].includes(produto.nivel) && <div className="mt-3"><Aviso tom="alerta">A descrição não basta para identificar a peça. <Link href="/os/conferencia" className="font-medium underline">Resolver na conferência manual</Link>.</Aviso></div>}
        {d.mesma_referencia.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-semibold">Mesma referência em outro código</div>
            <p className="text-xs text-slate-500">O sistema não junta sozinho. Confirme só se for a mesma peça física; dá para desfazer.</p>
            <ul className="mt-1 divide-y divide-slate-100">
              {d.mesma_referencia.map((p: J) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                  <span>{p.nome} <span className="text-xs text-slate-500">{[p.fabricante, p.referencia].filter(Boolean).join(" · ")} · cód. {(p.codigos || []).join(", ") || "sem código"}</span></span>
                  {podeResolver && <Botao disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/produtos/${pid}/juntar`, { metodo: "POST", corpo: { origem_id: p.id } }); tudo(); })}>É a mesma peça</Botao>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.juncoes.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-semibold">Junções feitas</div>
            <ul className="mt-1 divide-y divide-slate-100">
              {d.juncoes.map((j: J) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                  <span>{j.origem_nome} <span className="text-xs text-slate-500">cód. {(j.codigos || []).join(", ") || "sem código"} · {fmtData(j.em)} · {j.motivo}</span></span>
                  {podeResolver && <Botao variante="texto" disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api(`/os/juncoes/${j.id}/desfazer`, { metodo: "POST" }); tudo(); })}>Desfazer</Botao>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Aparições anteriores deste produto">
        {d.anteriores.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className={th}>Capturado</th><th className={th}>Evento</th><th className={th}>Qtd.</th><th className={th}>Andamento</th><th className={th}>Fornecedor</th><th className={th}>Valores</th></tr></thead>
              <tbody>
                {d.anteriores.map((a: J) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className={td}>{fmtData(a.capturado_em)}</td>
                    <td className={td}><Link href={`/os/item/${a.id}`} className="text-indigo-700 hover:underline">{a.numero_evento}</Link></td>
                    <td className={`${td} tabular-nums`}>{fmtNum(a.quantidade_total)}</td>
                    <td className={td}><Etiqueta tom={tomAndamento(a.resultado || a.andamento)}>{ANDAMENTOS[a.resultado || a.andamento]}</Etiqueta></td>
                    <td className={td}>{a.fornecedor || <span className="text-slate-400">–</span>}</td>
                    <td className={td}>{a.cotacao_id ? <Valores v={a.valores} /> : <span className="text-slate-400">sem cotação registrada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-600">Primeira aparição deste produto na captura.</p>}
        {d.historico_importado.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold">Histórico importado da base da Seven</div>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">
              {d.historico_importado.map((h: J, i: number) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 py-1.5"><span>{fmtData(h.data_ref)}</span><span>{h.fornecedor_texto || h.status || "–"}</span><Valores v={h.valores} /><Etiqueta>{h.origem}</Etiqueta></li>
              ))}
            </ul>
          </div>
        )}
      </Cartao>

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo={`Declínios deste produto (${d.declinios.length})`}>
          {d.declinios.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.declinios.map((x: J, i: number) => <li key={i} className="py-1.5"><span className="font-medium">{x.motivo}</span> <span className="text-xs text-slate-500">evento {x.numero_evento} · {fmtDataHora(x.em)} · {x.por || "?"}</span></li>)}
            </ul>
          ) : <p className="text-sm text-slate-600">Nunca declinado.</p>}
        </Cartao>
        <Cartao titulo="Andamento do item">
          {d.andamentos.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.andamentos.map((x: J, i: number) => <li key={i} className="py-1.5">{ANDAMENTOS[x.de] || "–"} para <span className="font-medium">{ANDAMENTOS[x.para]}</span>{x.motivo && `: ${x.motivo}`} <span className="text-xs text-slate-500">{fmtDataHora(x.em)} · {x.por || "?"}</span></li>)}
            </ul>
          ) : <p className="text-sm text-slate-600">Sem movimentação ainda. Capturado em {fmtDataHora(item.capturado_em)}.</p>}
        </Cartao>
      </div>
    </div>
  );
}
