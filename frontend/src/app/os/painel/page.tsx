"use client";
 
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { ABAS, COR_ABA, Estado, Rotulo, Secao, Titulo, campoCls, fmtData, fmtDataHora, fmtNum, fmtReais, th, theadCls, useApi, useEu, type J } from "../_lib";

const PERGUNTAS = ["O que encerra até sexta sem fornecedor?", "Quais marcas estão sem fornecedor?", "Como estão os indicadores?"];

function Bloco({ titulo, sub, link, restrito, children, className = "" }: { titulo: string; sub?: string; link?: string; restrito?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-[#DCE0E5] bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-[16px] font-bold">{titulo}</h3>
          {sub && <span className="text-[13px] text-[#5A6573]">{sub}</span>}
          {restrito && <span className="bg-[#EEF1F4] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#334255]">restrito</span>}
        </div>
        {link && <Link href={link} className="text-[14px] font-semibold text-[#00756D] hover:underline">Ver itens</Link>}
      </div>
      {children}
    </section>
  );
}

const Grande = ({ v, cor }: { v: string; cor?: string }) => <div className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: cor }}>{v}</div>;
const Indisponivel = ({ i }: { i: J }) => <p className="text-[14px] text-[#5A6573]">Indisponível. {i.motivo}</p>;

function Barra({ rotulo, sub, pct, cor = "#0B1A2A", valor, href }: { rotulo: string; sub?: string; pct: number; cor?: string; valor: string; href?: string }) {
  const nome = href ? <Link href={href} className="font-semibold hover:underline">{rotulo}</Link> : <span className="font-semibold">{rotulo}</span>;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[14px]">
        <span>{nome} {sub && <span className="text-[13px] text-[#5A6573]">{sub}</span>}</span>
        <span className="font-bold tabular-nums">{valor}</span>
      </div>
      <div className="mt-1.5 h-2.5 bg-[#EEF1F4]"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} /></div>
    </div>
  );
}

function Serie({ serie }: { serie: J[] }) {
  if (!serie.length) return <p className="text-[14px] text-[#5A6573]">Sem captura no período.</p>;
  const max = Math.max(...serie.map((s) => s.linhas));
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label={`Linhas capturadas por dia, de ${fmtData(serie[0].dia)} a ${fmtData(serie[serie.length - 1].dia)}; maior dia com ${fmtNum(max)} linhas`}>
        {serie.map((s, i) => {
          const ultimo = i === serie.length - 1;
          const baixo = s.linhas < max * 0.2;
          return (
            <div key={s.dia} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${fmtData(s.dia)}: ${fmtNum(s.linhas)} linhas`}>
              {serie.length <= 31 && <span className="mb-1 text-[11px] font-semibold tabular-nums text-[#334255]">{fmtNum(s.linhas)}</span>}
              <div className="w-full" style={{ height: `max(4px, calc(${(100 * s.linhas) / max}% - 16px))`, background: ultimo ? "#00A99D" : baixo ? "#E0A33A" : "#0B1A2A" }} />
            </div>
          );
        })}
      </div>
      <div className="mono mt-2 flex justify-between text-[11px] text-[#5A6573]"><span>{fmtData(serie[0].dia)}</span><span>{fmtData(serie[serie.length - 1].dia)}</span></div>
    </div>
  );
}

export default function Painel() {
  const eu = useEu();
  const router = useRouter();
  const [dias, setDias] = useState(15);
  const [conta, setConta] = useState("");
  const [pergunta, setPergunta] = useState("");
  const { dados, erro, carregando } = useApi<J>("/os/painel", { dias, conta });
  const ind: Record<string, J> = Object.fromEntries((dados?.indicadores || []).map((i: J) => [i.chave, i]));
  const perguntar = (p: string) => p.trim() && router.push(`/os/assistente?pergunta=${encodeURIComponent(p.trim())}`);

  return (
    <>
      <Titulo sub={`Saúde da captura e oportunidades comerciais. Últimos ${dias} dias.`}
        acoes={<>
          <select aria-label="Período" className={campoCls} style={{ width: 170 }} value={dias} onChange={(e) => setDias(Number(e.target.value))}>{[7, 15, 30, 90].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}</select>
          <select aria-label="CNPJ" className={campoCls} style={{ width: 170 }} value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todos os CNPJs</option>{eu.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </>}>
        Painel
      </Titulo>

      <form onSubmit={(e) => { e.preventDefault(); perguntar(pergunta); }} className="mb-8 border-2 border-[#0B1A2A] bg-white p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#00A99D]" aria-hidden />
            <input aria-label="Pergunta ao assistente" className={`${campoCls} h-[44px] pl-10 text-[15px]`} placeholder="Pergunte ao assistente sobre produto, fornecedor, preço ou prazo" value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
          </div>
          <button type="submit" className="flex h-[44px] items-center gap-2 bg-[#0B1A2A] px-5 text-[15px] font-semibold text-white hover:bg-[#1E3550]">Perguntar <Send className="h-4 w-4" aria-hidden /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PERGUNTAS.map((p) => <button key={p} type="button" onClick={() => perguntar(p)} className="border border-[#C9D0D8] px-3 py-1.5 text-[13px] hover:border-[#0B1A2A]">{p}</button>)}
        </div>
      </form>

      <Estado erro={erro} carregando={carregando && !dados}>
        <div className={carregando ? "opacity-60" : ""}>
          <Secao titulo="Operação" sub="o robô e a identificação de produto" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {ind.capturados && (
              <Bloco titulo="Itens capturados por dia" sub={`${fmtNum(ind.capturados.valor)} linhas em ${ind.capturados.serie.length} dias`} link="/os/captura">
                <Serie serie={ind.capturados.serie} />
                <p className="mt-3 text-[13px] text-[#5A6573]">Última captura: {ind.capturados.ultima_captura ? fmtDataHora(ind.capturados.ultima_captura) : "nenhuma"}{ind.capturados.falhas > 0 && <span className="font-semibold text-[#B42318]"> · {ind.capturados.falhas} falha(s) no período</span>}. Barra laranja: dia com captura muito abaixo do normal.</p>
              </Bloco>
            )}
            {ind.identificacao && (
              <Bloco titulo="Identificação por prefixo do código" link="/os/conferencia">
                {ind.identificacao.disponivel ? (
                  <div className="space-y-4">
                    {ind.identificacao.tabela.slice(0, 5).map((t: J) => (
                      <Barra key={t.prefixo} rotulo={t.prefixo === "sem codigo" ? "sem código" : `${t.prefixo}…`} sub={`${fmtNum(t.linhas)} linhas`} pct={t.pct_certeza} cor={t.pct_certeza < 50 ? "#E0A33A" : "#0B1A2A"} valor={`${fmtNum(t.pct_certeza, 0)}%`} />
                    ))}
                    <p className="text-[13px] text-[#5A6573]">Percentual identificado com certeza. O restante vai para a conferência manual.</p>
                  </div>
                ) : <Indisponivel i={ind.identificacao} />}
              </Bloco>
            )}
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {ind.estados && (
              <Bloco titulo="Itens em aberto por estado" link="/os">
                <Grande v={fmtNum(ind.estados.valor)} />
                <div className="mt-4 space-y-3">
                  {Object.entries(ABAS).map(([k, r]) => <Barra key={k} rotulo={r} href={`/os?aba=${k}`} pct={ind.estados.valor ? (100 * (ind.estados.abas[k] || 0)) / ind.estados.valor : 0} cor={COR_ABA[k].c} valor={fmtNum(ind.estados.abas[k] || 0)} />)}
                </div>
              </Bloco>
            )}
            {ind.encerra_48h && (
              <Bloco titulo="Encerra nas próximas 48h" link="/os?prazo=48h">
                <Grande v={fmtNum(ind.encerra_48h.valor)} cor="#B42318" />
                <p className="mt-2 text-[13px] text-[#5A6573]">itens a cotar ou em cotação com prazo curto</p>
              </Bloco>
            )}
          </div>

          <Secao titulo="Comercial" sub="onde está o dinheiro e onde estamos perdendo" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {ind.marcas_sem_fornecedor && (
              <section className="border border-[#DCE0E5] bg-white">
                <div className="px-5 pb-3 pt-5"><h3 className="text-[16px] font-bold">Marcas recorrentes sem fornecedor vinculado</h3><p className="text-[13px] text-[#5A6573]">{ind.marcas_sem_fornecedor.detalhe}</p></div>
                {ind.marcas_sem_fornecedor.tabela.length ? (
                  <table className="w-full border-collapse">
                    <thead className={theadCls}><tr><th className={th}>Marca</th><th className={`${th} text-right`}>Itens abertos</th><th className={th}></th></tr></thead>
                    <tbody>
                      {ind.marcas_sem_fornecedor.tabela.slice(0, 10).map((t: J) => (
                        <tr key={t.marca} className="border-b border-[#E6E9ED] last:border-0">
                          <td className="mono px-5 py-3 text-[13px] font-semibold">{t.marca}</td>
                          <td className="px-5 py-3 text-right text-[14px] font-semibold tabular-nums">{t.itens}</td>
                          <td className="px-5 py-2.5 text-right"><Link href={`/os?busca=${encodeURIComponent(t.marca)}&sem_fornecedor=1`} className="inline-flex h-8 items-center border border-[#0B1A2A] px-3 text-[13px] font-semibold hover:bg-[#F6F8FA]">Ver itens</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="px-5 pb-5 text-[14px] text-[#5A6573]">Nenhuma marca recorrente sem fornecedor.</p>}
              </section>
            )}
            <div className="space-y-5">
              {ind.declinio && (
                <Bloco titulo="Taxa de declínio" sub="itens que a equipe decidiu não cotar" link="/os?situacao=todos&andamento=declinada">
                  {ind.declinio.disponivel ? <><Grande v={`${fmtNum(ind.declinio.valor, 1)}%`} /><p className="mt-2 text-[13px] text-[#5A6573]">{ind.declinio.detalhe}</p></> : <Indisponivel i={ind.declinio} />}
                </Bloco>
              )}
              {ind.valor_aberto && (
                <Bloco titulo="Valor em aberto" restrito link="/os?ordem=valor">
                  {ind.valor_aberto.disponivel ? <><Grande v={fmtReais(ind.valor_aberto.valor)} /><p className="mt-2 text-[13px] text-[#5A6573]">{ind.valor_aberto.detalhe}</p></> : <Indisponivel i={ind.valor_aberto} />}
                </Bloco>
              )}
            </div>
          </div>
          {(ind.margem || ind.divergencias || ind.vitoria) && (
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {ind.margem && <Bloco titulo="Margem praticada" restrito>{ind.margem.disponivel ? <><Grande v={`${fmtNum(ind.margem.valor, 1)}%`} /><p className="mt-2 text-[13px] text-[#5A6573]">{ind.margem.detalhe}</p></> : <Indisponivel i={ind.margem} />}</Bloco>}
              {ind.divergencias && (
                <Bloco titulo="Divergências abertas" restrito link={ind.divergencias.link}>
                  <Grande v={fmtNum(ind.divergencias.valor)} cor={ind.divergencias.valor ? "#7A5210" : undefined} />
                  {ind.divergencias.tabela.map((t: J) => <div key={t.tipo} className="mt-2 flex justify-between text-[14px]"><span>{({ parece_total: "Parece total", divergente: "Preço divergente", sem_preco: "Sem preço" } as J)[t.tipo]}</span><span className="font-semibold">{t.n}</span></div>)}
                </Bloco>
              )}
              {ind.vitoria && <Bloco titulo="Taxa de vitória" restrito>{ind.vitoria.disponivel ? <><Grande v={`${fmtNum(ind.vitoria.valor, 1)}%`} /><p className="mt-2 text-[13px] text-[#5A6573]">{ind.vitoria.detalhe}</p></> : <Indisponivel i={ind.vitoria} />}</Bloco>}
            </div>
          )}
          <p className="mt-6"><Rotulo>Os números vêm só do que está registrado no sistema</Rotulo></p>
        </div>
      </Estado>
    </>
  );
}
