"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Botao, Etiqueta, Estado, Titulo, campoCls, fmtDataHora, td, th, useApi, type J } from "../_lib";

const ACOES: Record<string, string> = { criar: "criou", alterar: "alterou", excluir: "excluiu", exportar: "exportou", ver_restrito: "viu dado restrito" };
const resumo = (v: any) => (v == null ? "" : Object.entries(v).map(([k, x]) => `${k}: ${typeof x === "object" && x !== null ? JSON.stringify(x) : x}`).join(" · "));

export default function Auditoria() {
  const [f, setF] = useState({ entidade: "", acao: "", autor: "", de: "", ate: "", pagina: 1 });
  const [autor, setAutor] = useState("");
  const { dados, erro, carregando } = useApi<J>("/os/auditoria", f);
  const muda = (m: J) => setF((a) => ({ ...a, pagina: 1, ...m }));
  return (
    <>
      <Titulo sub="Quem lançou ou alterou preço, margem e fornecedor, quem mudou acesso e quem exportou. O registro não pode ser editado nem apagado.">Auditoria</Titulo>
      <form onSubmit={(e) => { e.preventDefault(); muda({ autor }); }} className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <select aria-label="O que" className={campoCls} value={f.entidade} onChange={(e) => muda({ entidade: e.target.value })}><option value="">Tudo</option>{(dados?.entidades || []).map((x: string) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Ação" className={campoCls} value={f.acao} onChange={(e) => muda({ acao: e.target.value })}><option value="">Qualquer ação</option>{Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input aria-label="Autor" className={campoCls} placeholder="Autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
        <input aria-label="De" type="date" className={campoCls} value={f.de} onChange={(e) => muda({ de: e.target.value })} />
        <input aria-label="Até" type="date" className={campoCls} value={f.ate} onChange={(e) => muda({ ate: e.target.value })} />
        <Botao type="submit">Filtrar</Botao>
      </form>
      <div className="overflow-x-auto rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)]">
        <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.registros.length && "Nenhum registro com esses filtros."}>
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-[#EAECF0] bg-[#F8F9FB]"><tr><th className={th}>Quando</th><th className={th}>Quem</th><th className={th}>O que</th><th className={th}>Antes</th><th className={th}>Depois</th></tr></thead>
            <tbody>
              {dados?.registros.map((r: J) => (
                <tr key={r.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{fmtDataHora(r.em)}</td>
                  <td className={td}>{r.autor}{r.origem === "suporte" && <> <Etiqueta tom="info">suporte</Etiqueta></>}</td>
                  <td className={td}>{ACOES[r.acao] || r.acao} <span className="font-medium">{r.entidade}</span> {r.entidade_id && <span className="text-[12px] text-[#667085]">#{r.entidade_id}</span>}{r.justificativa && <div className="text-[12px] text-[#667085]">Justificativa: {r.justificativa}</div>}</td>
                  {r.oculto ? <td colSpan={2} className={`${td} text-[#98A2B3]`}>valores não visíveis para o seu perfil</td> : <><td className={`${td} max-w-xs break-words text-[12px] text-[#667085]`}>{resumo(r.antes)}</td><td className={`${td} max-w-sm break-words text-[12px] text-[#667085]`}>{resumo(r.depois)}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </Estado>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Botao disabled={f.pagina <= 1} onClick={() => setF({ ...f, pagina: f.pagina - 1 })}>Anterior</Botao>
        <Botao disabled={!dados || dados.registros.length < 100} onClick={() => setF({ ...f, pagina: f.pagina + 1 })}>Próxima</Botao>
      </div>
    </>
  );
}
