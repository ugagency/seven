"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Base do Seven OS no front: cliente do os_api, contexto do usuario e pecas de interface.
// O front so esconde o que o perfil nao pode; quem decide e o os_api.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

export const OS_API = (process.env.NEXT_PUBLIC_OS_API_URL || "http://localhost:8100").replace(/\/$/, "");
export type J = Record<string, any>;

let _supabase: ReturnType<typeof createClient> | null = null;
export function supabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

export class ErroApi extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function token() {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token || "";
}

function url(caminho: string, params?: J) {
  const u = new URL(OS_API + caminho);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) u.searchParams.set(k, String(v));
  });
  return u.toString();
}

async function chamar(caminho: string, opcoes: { metodo?: string; corpo?: unknown; params?: J } = {}) {
  let r: Response;
  try {
    r = await fetch(url(caminho, opcoes.params), {
      method: opcoes.metodo || "GET",
      headers: { Authorization: `Bearer ${await token()}`, ...(opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, "Não foi possível falar com o servidor do Seven OS.");
  }
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try {
      const d = await r.json();
      if (typeof d.detail === "string") msg = d.detail;
    } catch {}
    throw new ErroApi(r.status, msg);
  }
  return r;
}

export async function api<T = any>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; params?: J } = {}): Promise<T> {
  return (await chamar(caminho, opcoes)).json();
}

export async function baixar(caminho: string, opcoes: { metodo?: string; params?: J } = {}, nomePadrao = "arquivo") {
  const r = await chamar(caminho, opcoes);
  const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || nomePadrao;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function useApi<T = any>(caminho: string | null, params?: J) {
  const chave = caminho ? caminho + JSON.stringify(params || {}) : null;
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>({ dados: null, erro: null, carregando: !!caminho });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true }));
    api<T>(caminho, { params })
      .then((dados) => vivo && setEstado({ dados, erro: null, carregando: false }))
      .catch((e) => vivo && setEstado({ dados: null, erro: e.message, carregando: false }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, volta]);
  const recarregar = useCallback(() => setVolta((v) => v + 1), []);
  return { ...estado, recarregar };
}

// ---------- usuario ----------
export type Eu = { id: string; email: string; nome: string; perfil: string; permissoes: string[]; contas: { id: number; nome: string; cnpj?: string; filial?: string }[] };
const Ctx = createContext<Eu | null>(null);
export const EuProvider = ({ eu, children }: { eu: Eu; children: ReactNode }) => <Ctx.Provider value={eu}>{children}</Ctx.Provider>;
export function useEu() {
  const eu = useContext(Ctx);
  if (!eu) throw new Error("fora do Seven OS");
  return { ...eu, pode: (p: string) => eu.permissoes.includes(p), nomeConta: (id: number) => eu.contas.find((c) => c.id === id)?.nome || `conta ${id}` };
}
export const PERFIS: Record<string, string> = { administrador: "Administrador", supervisor: "Supervisor", cotacao: "Cotação", suporte: "Suporte SSYS" };

// ---------- formatos ----------
export const fmtData = (v?: string | null) => (v ? new Date(v.length <= 10 ? v + "T12:00:00" : v).toLocaleDateString("pt-BR") : "");
export const fmtDataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
export const fmtNum = (v?: number | null, casas = 0) => (v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 3) }));
export const fmtReais = (v?: number | null) => (v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export function diasAte(prazo?: string | null) {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((new Date(prazo + "T12:00:00").getTime() - hoje.getTime()) / 86400000);
}
export function textoPrazo(prazo?: string | null) {
  const d = diasAte(prazo);
  if (d === null) return "sem prazo";
  if (d < 0) return `encerrou em ${fmtData(prazo)}`;
  if (d === 0) return "encerra hoje";
  if (d === 1) return "encerra amanhã";
  return `encerra em ${d} dias`;
}

export const ABAS: Record<string, string> = { pronto: "Pronto", falta_fornecedor: "Falta fornecedor", produto_novo: "Produto novo", conferencia: "Conferência manual" };
export const ANDAMENTOS: Record<string, string> = { a_cotar: "A cotar", em_cotacao: "Em cotação", enviada: "Enviada no Coupa", declinada: "Declinada", ganha: "Ganha", perdida: "Perdida" };
export const NIVEIS: Record<string, string> = { certeza: "Certeza", provavel: "Provável", conferir: "A conferir", nao_identificavel: "Não identificável" };

// ---------- pecas de interface ----------
const TONS: Record<string, string> = {
  neutro: "bg-slate-100 text-slate-700",
  bom: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  alerta: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  ruim: "bg-red-50 text-red-800 ring-1 ring-red-200",
  info: "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200",
};
export const Etiqueta = ({ tom = "neutro", children }: { tom?: keyof typeof TONS | string; children: ReactNode }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${TONS[tom] || TONS.neutro}`}>{children}</span>
);
export const tomAndamento = (a: string) => ({ ganha: "bom", enviada: "info", em_cotacao: "info", declinada: "neutro", perdida: "ruim" } as J)[a] || "neutro";
export const tomNivel = (n: string) => ({ certeza: "bom", provavel: "alerta", conferir: "alerta", nao_identificavel: "ruim" } as J)[n] || "neutro";

export function Botao({ variante = "secundario", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" | "texto" }) {
  const estilos = {
    primario: "bg-slate-900 text-white hover:bg-slate-700 border-slate-900",
    secundario: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
    perigo: "bg-white text-red-700 hover:bg-red-50 border-red-200",
    texto: "border-transparent text-indigo-700 hover:bg-indigo-50",
  }[variante];
  return <button {...p} className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${estilos} ${className}`} />;
}

export const campoCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50";
export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export const Cartao = ({ titulo, acoes, children, className = "" }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
    {(titulo || acoes) && (
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        <div className="flex flex-wrap items-center gap-2">{acoes}</div>
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

export const Aviso = ({ tom = "info", children }: { tom?: "info" | "alerta" | "ruim" | "bom"; children: ReactNode }) => (
  <div role={tom === "ruim" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${TONS[tom]}`}>{children}</div>
);

export function Estado({ carregando, erro, vazio, children }: { carregando?: boolean; erro?: string | null; vazio?: string | false | null; children?: ReactNode }) {
  if (erro) return <Aviso tom="ruim">{erro}</Aviso>;
  if (carregando) return <p className="py-6 text-center text-sm text-slate-500">Carregando…</p>;
  if (vazio) return <p className="py-6 text-center text-sm text-slate-500">{vazio}</p>;
  return <>{children}</>;
}

export const Titulo = ({ children, sub, acoes }: { children: ReactNode; sub?: ReactNode; acoes?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{children}</h1>
      {sub && <p className="mt-0.5 text-sm text-slate-600">{sub}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{acoes}</div>
  </div>
);

export const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500";
export const td = "px-3 py-2 align-top text-sm text-slate-800";

/** Executa uma acao que grava, guardando o erro para mostrar na tela. */
export function useAcao() {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rodar = useCallback(async (f: () => Promise<unknown>) => {
    setErro(null);
    setOcupado(true);
    try {
      await f();
      return true;
    } catch (e: any) {
      setErro(e.message || "Não deu certo.");
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);
  return { erro, ocupado, rodar, limpar: () => setErro(null) };
}
