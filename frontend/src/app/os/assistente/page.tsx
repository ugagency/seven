"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRef, useState } from "react";
import { Aviso, Botao, Titulo, api, campoCls, fmtNum, fmtReais, td, th, useAcao, type J } from "../_lib";

const EXEMPLOS = ["Já cotamos o 13540916 e por quanto?", "O que encerra até sexta sem fornecedor?", "Quem fornece rolamento SKF?", "Quais marcas estão sem fornecedor?", "Como estão os indicadores?"];
const ehValor = (col: string) => /Compra|Venda|Frete/.test(col);

export default function Assistente() {
  const [conversa, setConversa] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<J[]>([]);
  const [texto, setTexto] = useState("");
  const acao = useAcao();
  const fim = useRef<HTMLDivElement>(null);

  const perguntar = (p: string) => {
    if (!p.trim() || acao.ocupado) return;
    setMsgs((m) => [...m, { papel: "usuario", texto: p }]);
    setTexto("");
    acao.rodar(async () => {
      const r = await api("/os/assistente", { metodo: "POST", corpo: { pergunta: p, conversa_id: conversa } });
      setConversa(r.conversa_id);
      setMsgs((m) => [...m, { papel: "assistente", ...r }]);
      setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Titulo sub="Responde só com o que está registrado e conforme o seu perfil. Somente leitura." acoes={msgs.length > 0 && <Botao onClick={() => { setMsgs([]); setConversa(null); }}>Nova conversa</Botao>}>Assistente</Titulo>
      <Aviso>Nesta versão a pergunta é interpretada por regras, dentro do servidor, sem modelo de IA. Ele entende uma lista fechada de consultas; os valores vêm direto do sistema.</Aviso>
      <div className="mt-4 space-y-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">{EXEMPLOS.map((e) => <button key={e} onClick={() => perguntar(e)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500">{e}</button>)}</div>
        )}
        {msgs.map((m, i) => m.papel === "usuario" ? (
          <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2 text-sm text-white">{m.texto}</div>
        ) : (
          <div key={i} className="max-w-full rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-4 text-sm">
            <p className="text-slate-900">{m.texto}</p>
            {m.tabela && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead><tr>{m.tabela.colunas.map((c: string) => <th key={c} className={th}>{c}</th>)}</tr></thead>
                  <tbody>{m.tabela.linhas.map((l: any[], j: number) => <tr key={j} className="border-t border-slate-100">{l.map((v, k) => <td key={k} className={`${td} ${typeof v === "number" ? "tabular-nums" : ""}`}>{typeof v === "number" ? (ehValor(m.tabela.colunas[k]) ? fmtReais(v) : fmtNum(v, 0)) : v ?? ""}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {m.link && <Link href={m.link} className="mt-2 inline-block font-medium text-indigo-700 hover:underline">Abrir a origem</Link>}
          </div>
        ))}
        {acao.ocupado && <p className="text-sm text-slate-500">Consultando…</p>}
        {acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}
        <div ref={fim} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); perguntar(texto); }} className="sticky bottom-0 mt-4 flex gap-2 bg-slate-50 py-3">
        <input aria-label="Pergunta" className={campoCls} maxLength={500} placeholder="Pergunte sobre um produto, prazo, fornecedor ou indicador" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Botao type="submit" variante="primario" disabled={acao.ocupado || !texto.trim()}>Perguntar</Botao>
      </form>
    </div>
  );
}
