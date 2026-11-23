"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Send } from "lucide-react";
import { Aviso, Botao, Rotulo, Titulo, api, campoCls, fmtDataHora, fmtNum, fmtReais, useAcao, useApi, type J } from "../_lib";

const EXEMPLOS = ["Já cotamos o 13540916 e por quanto?", "O que encerra até sexta sem fornecedor?", "Quem fornece rolamento SKF?", "Quais marcas estão sem fornecedor?", "Como estão os indicadores?"];
const ehValor = (col: string) => /Compra|Venda|Frete/.test(col);
const hora = (v?: string) => (v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "");

function Assistente() {
  const sp = useSearchParams();
  const [conversa, setConversa] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<J[]>([]);
  const [texto, setTexto] = useState("");
  const acao = useAcao();
  const lista = useApi<J[]>("/os/assistente/conversas");
  const fim = useRef<HTMLDivElement>(null);
  const inicial = useRef(false);

  const perguntar = (p: string) => {
    if (!p.trim() || acao.ocupado) return;
    setMsgs((m) => [...m, { papel: "usuario", texto: p, em: new Date().toISOString() }]);
    setTexto("");
    acao.rodar(async () => {
      const r = await api("/os/assistente", { metodo: "POST", corpo: { pergunta: p, conversa_id: conversa } });
      setConversa(r.conversa_id);
      setMsgs((m) => [...m, { papel: "assistente", em: new Date().toISOString(), ...r }]);
      lista.recarregar();
      setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    });
  };

  useEffect(() => {
    const p = sp.get("pergunta");
    if (p && !inicial.current) { inicial.current = true; perguntar(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const abrir = (id: number) =>
    acao.rodar(async () => {
      const ms = await api<J[]>(`/os/assistente/conversas/${id}`);
      setConversa(id);
      setMsgs(ms.map((m) => ({ papel: m.papel, texto: m.texto, em: m.criada_em, antiga: true })));
    });
  const titulo = lista.dados?.find((c) => c.id === conversa)?.titulo || (msgs[0]?.texto ?? "Nova conversa");

  return (
    <>
      <Titulo sub="Consulte produtos, fornecedores, prazos e cotações registradas. Somente leitura."
        acoes={<Botao onClick={() => { setMsgs([]); setConversa(null); }}><Plus className="h-4 w-4" aria-hidden /> Nova conversa</Botao>}>
        Assistente
      </Titulo>
      <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-[#EAECF0] lg:border-b-0 lg:border-r">
          <div className="px-4 pb-2 pt-4"><Rotulo>Conversas</Rotulo></div>
          <ul className="max-h-[560px] space-y-0.5 overflow-y-auto px-2">
            {(lista.dados || []).map((c) => (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className={`w-full rounded-lg px-3 py-2.5 text-left hover:bg-[#F8F9FB] ${c.id === conversa ? "bg-[#ECFDF9]" : ""}`}>
                                    <div className="truncate text-[14px] font-semibold">{c.titulo}</div>
                  <div className="text-[12px] text-[#667085]">{fmtDataHora(c.criada_em)}</div>
                </button>
              </li>
            ))}
            {lista.dados && !lista.dados.length && <li className="px-4 py-3 text-[13px] text-[#667085]">Nenhuma conversa ainda.</li>}
          </ul>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="border-b border-[#F0F2F5] px-5 py-4">
            <div className="truncate text-[16px] font-bold">{titulo}</div>
            <div className="text-[12px] text-[#667085]">Respostas montadas pelo sistema com os dados registrados</div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">{EXEMPLOS.map((e) => <button key={e} onClick={() => perguntar(e)} className="rounded-full border border-[#D0D5DD] bg-white px-3.5 py-1.5 text-[13px] text-[#344054] hover:border-[#98A2B3] hover:bg-[#F8F9FB]">{e}</button>)}</div>
            )}
            {msgs.map((m, i) => m.papel === "usuario" ? (
              <div key={i} className="flex flex-col items-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0B1A2A] px-4 py-2.5 text-[14px] text-white">{m.texto}</div>
                <span className="mt-1 text-[11px] text-[#98A2B3]">{hora(m.em)}</span>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDF3F1] text-[11px] font-bold text-[#00665F]" aria-hidden>S7</span>
                <div className="min-w-0 max-w-[92%]">
                  <div className="rounded-2xl rounded-tl-md bg-[#F2F4F7] px-4 py-2.5 text-[14px]">{m.texto}</div>
                  {m.tabela && (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-[#EAECF0]">
                      <table className="w-full border-collapse">
                        <thead className="border-b border-[#EAECF0] bg-[#F8F9FB]"><tr>{m.tabela.colunas.map((c: string) => <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{c}</th>)}</tr></thead>
                        <tbody>{m.tabela.linhas.map((l: any[], j: number) => <tr key={j} className="border-b border-[#F0F2F5] last:border-0">{l.map((v, k) => <td key={k} className={`px-3 py-2 text-[13px] ${typeof v === "number" ? "tabular-nums" : ""}`}>{typeof v === "number" ? (ehValor(m.tabela.colunas[k]) ? fmtReais(v) : fmtNum(v, 0)) : v ?? ""}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  {m.tabela && <p className="mt-1.5 text-[12px] text-[#667085]">Valores vindos direto do sistema, conforme o seu perfil.</p>}
                  {m.link && <Link href={m.link} className="mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#00756D] hover:underline"><ExternalLink className="h-4 w-4" aria-hidden /> Abrir a origem</Link>}
                  {m.antiga && <p className="mt-1 text-[12px] text-[#98A2B3]">Tabelas não ficam guardadas; pergunte de novo para ver os dados atuais.</p>}
                  <div className="mt-1 text-[11px] text-[#98A2B3]">{hora(m.em)}</div>
                </div>
              </div>
            ))}
            {acao.ocupado && <p className="text-[14px] text-[#667085]">Consultando…</p>}
            {acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}
            <div ref={fim} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); perguntar(texto); }} className="border-t border-[#F0F2F5] px-5 py-4">
            <div className="flex gap-2">
              <input aria-label="Pergunta" className={`${campoCls} h-[44px]`} maxLength={500} placeholder="Pergunte sobre produto, fornecedor, preço ou prazo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button type="submit" disabled={acao.ocupado || !texto.trim()} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg bg-[#0B1A2A] text-white disabled:opacity-40" aria-label="Enviar"><Send className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-[12px] text-[#667085]">O assistente só responde com dados registrados no sistema. Quando não tem o dado, diz que não tem. Nesta versão ele entende uma lista fechada de perguntas, sem modelo de IA.</p>
          </form>
        </div>
      </div>
    </>
  );
}

export default function Pagina() {
  return <Suspense fallback={null}><Assistente /></Suspense>;
}
