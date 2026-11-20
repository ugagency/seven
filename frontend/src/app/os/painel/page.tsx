"use client";
 
import Link from "next/link";
import { useState } from "react";
import { ABAS, Cartao, Etiqueta, Estado, Titulo, campoCls, fmtData, fmtDataHora, fmtNum, fmtReais, useApi, useEu, type J } from "../_lib";

function Valor({ i }: { i: J }) {
  if (!i.disponivel) return <div className="text-sm text-slate-500">Indisponível. {i.motivo}</div>;
  const v = i.unidade === "R$" ? fmtReais(i.valor) : `${fmtNum(i.valor, i.unidade?.includes("%") ? 1 : 0)}${i.unidade?.startsWith("%") ? "%" : ""}`;
  return <div className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{v}{i.unidade && i.unidade !== "R$" && i.unidade !== "%" && <span className="ml-2 text-sm font-normal text-slate-500">{i.unidade.replace(/^% /, "")}</span>}</div>;
}

function Serie({ serie }: { serie: J[] }) {
  if (!serie.length) return null;
  const max = Math.max(...serie.map((s) => s.linhas));
  return (
    <div className="mt-3">
      <div className="flex h-24 items-end gap-px" role="img" aria-label={`Linhas capturadas por dia, de ${fmtData(serie[0].dia)} a ${fmtData(serie[serie.length - 1].dia)}; maior dia com ${fmtNum(max)} linhas`}>
        {serie.map((s) => <div key={s.dia} title={`${fmtData(s.dia)}: ${fmtNum(s.linhas)} linhas`} className="min-w-[3px] flex-1 rounded-t bg-slate-700 hover:bg-indigo-600" style={{ height: `${Math.max(3, (100 * s.linhas) / max)}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{fmtData(serie[0].dia)}</span><span>pico {fmtNum(max)}</span><span>{fmtData(serie[serie.length - 1].dia)}</span></div>
    </div>
  );
}

export default function Painel() {
  const eu = useEu();
  const [dias, setDias] = useState(30);
  const [conta, setConta] = useState("");
  const { dados, erro, carregando } = useApi<J>("/os/painel", { dias, conta });
  return (
    <>
      <Titulo sub="Cada número leva à lista de itens por trás dele."
        acoes={<>
          <select aria-label="Período" className={campoCls} value={dias} onChange={(e) => setDias(Number(e.target.value))}>{[7, 30, 90, 180].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}</select>
          <select aria-label="CNPJ" className={campoCls} value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todos os CNPJs</option>{eu.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </>}>
        Painel
      </Titulo>
      <Estado erro={erro} carregando={carregando && !dados}>
        <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${carregando ? "opacity-60" : ""}`}>
          {(dados?.indicadores || []).map((i: J) => (
            <Cartao key={i.chave} titulo={<span className="flex items-center gap-2">{i.titulo}{i.restrito && <Etiqueta>restrito</Etiqueta>}</span>} acoes={i.link && <Link href={i.link} className="text-sm font-medium text-indigo-700 hover:underline">Ver itens</Link>} className={i.chave === "capturados" ? "md:col-span-2 xl:col-span-1" : ""}>
              <Valor i={i} />
              {i.detalhe && i.disponivel && <p className="mt-1 text-xs text-slate-500">{i.detalhe}</p>}
              {i.chave === "capturados" && (
                <>
                  <Serie serie={i.serie} />
                  <p className="mt-2 text-xs text-slate-500">Última captura: {i.ultima_captura ? fmtDataHora(i.ultima_captura) : "nenhuma"}{i.falhas > 0 && <span className="font-medium text-red-700"> · {i.falhas} falha(s) no período</span>}</p>
                </>
              )}
              {i.abas && <ul className="mt-2 space-y-1 text-sm">{Object.entries(ABAS).map(([k, r]) => <li key={k} className="flex justify-between"><Link href={`/os?aba=${k}`} className="text-slate-700 hover:underline">{r}</Link><span className="tabular-nums font-medium">{fmtNum(i.abas[k] || 0)}</span></li>)}</ul>}
              {i.chave === "identificacao" && i.tabela && <ul className="mt-2 space-y-1 text-sm">{i.tabela.map((t: J) => <li key={t.prefixo} className="flex justify-between"><span className="text-slate-700">Prefixo {t.prefixo} <span className="text-xs text-slate-500">{fmtNum(t.linhas)} linhas</span></span><span className="tabular-nums font-medium">{fmtNum(t.pct_certeza, 1)}%</span></li>)}</ul>}
              {i.chave === "marcas_sem_fornecedor" && <ul className="mt-2 space-y-1 text-sm">{i.tabela.slice(0, 8).map((t: J) => <li key={t.marca} className="flex justify-between"><Link href={`/os?busca=${encodeURIComponent(t.marca)}&sem_fornecedor=1`} className="text-slate-700 hover:underline">{t.marca}</Link><span className="tabular-nums font-medium">{t.itens}</span></li>)}</ul>}
              {i.chave === "divergencias" && i.tabela.length > 0 && <ul className="mt-2 space-y-1 text-sm">{i.tabela.map((t: J) => <li key={t.tipo} className="flex justify-between"><span className="text-slate-700">{({ parece_total: "Parece total", divergente: "Preço divergente", sem_preco: "Sem preço" } as J)[t.tipo]}</span><span className="tabular-nums font-medium">{t.n}</span></li>)}</ul>}
            </Cartao>
          ))}
        </div>
      </Estado>
    </>
  );
}
