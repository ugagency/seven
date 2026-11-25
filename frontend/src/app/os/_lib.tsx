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

export async function enviarArquivo<T = any>(caminho: string, arquivo: File, campo = "arquivo"): Promise<T> {
  const fd = new FormData();
  fd.append(campo, arquivo);
  let r: Response;
  try {
    r = await fetch(url(caminho), { method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: fd });
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
  return r.json();
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

// Ultima resposta de cada consulta, em memoria enquanto a aba estiver aberta. Ao voltar para uma tela,
// os dados aparecem na hora e sao atualizados em seguida (sem tela vazia de "Carregando").
const MEMORIA = new Map<string, unknown>();

export function useApi<T = any>(caminho: string | null, params?: J) {
  const chave = caminho ? caminho + JSON.stringify(params || {}) : null;
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>(() => {
    const m = chave ? (MEMORIA.get(chave) as T | undefined) : undefined;
    return { dados: m ?? null, erro: null, carregando: !!caminho && m === undefined };
  });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    if (!caminho || !chave) return;
    let vivo = true;
    const m = MEMORIA.get(chave) as T | undefined;
    setEstado((e) => (m !== undefined ? { dados: m, erro: null, carregando: false } : { ...e, carregando: true }));
    api<T>(caminho, { params })
      .then((dados) => {
        MEMORIA.set(chave, dados);
        if (vivo) setEstado({ dados, erro: null, carregando: false });
      })
      .catch((e) => vivo && setEstado({ dados: null, erro: e.message, carregando: false }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, volta]);
  const recarregar = useCallback(() => setVolta((v) => v + 1), []);
  return { ...estado, recarregar };
}

export const limparMemoria = () => MEMORIA.clear();

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
export const fmtNum = (v?: number | null, casas = 0) => (v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas === 0 ? 3 : casas }));
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

// ---------- pecas de interface (identidade do prototipo: cantos retos, marinho #0B1A2A, verde-agua #00A99D) ----------
export const COR_ABA: Record<string, { c: string; bg: string; fg: string }> = {
  pronto: { c: "#00A99D", bg: "#DDF3F1", fg: "#00665F" },
  falta_fornecedor: { c: "#E0A33A", bg: "#FBEFD9", fg: "#7A5210" },
  produto_novo: { c: "#3E5F8A", bg: "#E1E8F1", fg: "#2C4566" },
  conferencia: { c: "#7C5CB0", bg: "#ECE6F5", fg: "#4E3878" },
};
const TONS: Record<string, string> = {
  neutro: "bg-[#F2F4F7] text-[#344054]",
  bom: "bg-[#DDF3F1] text-[#00665F]",
  alerta: "bg-[#FBEFD9] text-[#7A5210]",
  ruim: "bg-[#FDECEA] text-[#B42318]",
  info: "bg-[#E1E8F1] text-[#2C4566]",
  roxo: "bg-[#ECE6F5] text-[#4E3878]",
  contorno: "bg-[#F2F4F7] text-[#344054]",
};
export const Etiqueta = ({ tom = "neutro", mono, children }: { tom?: keyof typeof TONS | string; mono?: boolean; children: ReactNode }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 ${mono ? "mono" : ""} ${TONS[tom] || TONS.neutro}`}>{children}</span>
);
export const EtiquetaAba = ({ aba }: { aba: string }) => {
  const c = COR_ABA[aba];
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5" style={c ? { background: c.bg, color: c.fg } : undefined}><span className="h-1.5 w-1.5 rounded-full" style={{ background: c?.c }} aria-hidden />{ABAS[aba] || aba}</span>;
};
export const tomAndamento = (a: string) => ({ ganha: "bom", enviada: "info", em_cotacao: "info", declinada: "neutro", perdida: "ruim" } as J)[a] || "neutro";
export const tomNivel = (n: string) => ({ certeza: "bom", provavel: "alerta", conferir: "roxo", nao_identificavel: "ruim" } as J)[n] || "neutro";

export function Botao({ variante = "secundario", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" | "texto" }) {
  const estilos = {
    primario: "bg-[#0B1A2A] text-white border-[#0B1A2A] hover:bg-[#1E3550]",
    secundario: "bg-white text-[#344054] border-[#D0D5DD] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-[#F8F9FB]",
    perigo: "bg-white text-[#B42318] border-[#FECDCA] hover:bg-[#FEF3F2]",
    texto: "border-transparent px-1.5 text-[#00756D] hover:underline",
  }[variante];
  return <button {...p} className={`inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border px-3.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${estilos} ${className}`} />;
}

export const campoCls = "w-full h-[40px] rounded-lg border border-[#D0D5DD] bg-white px-3 text-[14px] text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.05)] placeholder:text-[#98A2B3] focus:border-[#00A99D] focus:outline-none focus:ring-4 focus:ring-[#00A99D]/10 disabled:bg-[#F2F4F7] [&:is(textarea)]:h-auto [&:is(textarea)]:py-2";
export const Rotulo = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`text-[13px] font-medium text-[#667085] ${className}`}>{children}</span>
);
export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[#344054]">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[12px] text-[#667085]">{dica}</span>}
    </label>
  );
}

export const Cartao = ({ titulo, sub, acoes, children, className = "", destaque, semPadding }: { titulo?: ReactNode; sub?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; destaque?: boolean; semPadding?: boolean }) => (
  <section className={`rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)] ${destaque ? "border-t-2 border-t-[#0B1A2A]" : ""} ${className}`}>
    {(titulo || acoes) && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F2F5] px-6 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-[16px] font-semibold text-[#101828]">{titulo}</h2>
          {sub && <span className="text-[13px] text-[#667085]">{sub}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{acoes}</div>
      </header>
    )}
    <div className={semPadding ? "" : "p-6"}>{children}</div>
  </section>
);

export const Secao = ({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-4 mt-10 flex items-baseline gap-3 first:mt-0">
    <h2 className="text-[18px] font-semibold text-[#101828]">{titulo}</h2>
    {sub && <span className="text-[14px] text-[#667085]">{sub}</span>}
    {children}
  </div>
);

const AVISO: Record<string, string> = { info: "bg-[#F2F4F7] text-[#344054]", alerta: "bg-[#FFFAEB] text-[#93370D]", ruim: "bg-[#FEF3F2] text-[#B42318]", bom: "bg-[#ECFDF9] text-[#00665F]" };
export const Aviso = ({ tom = "info", children }: { tom?: "info" | "alerta" | "ruim" | "bom"; children: ReactNode }) => (
  <div role={tom === "ruim" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-[14px] ${AVISO[tom]}`}>{children}</div>
);

export function Estado({ carregando, erro, vazio, children }: { carregando?: boolean; erro?: string | null; vazio?: string | false | null; children?: ReactNode }) {
  if (erro) return <Aviso tom="ruim">{erro}</Aviso>;
  if (carregando) return <p className="py-8 text-center text-[14px] text-[#667085]">Carregando…</p>;
  if (vazio) return <p className="py-8 text-center text-[14px] text-[#667085]">{vazio}</p>;
  return <>{children}</>;
}

export const Titulo = ({ children, sub, acoes }: { children: ReactNode; sub?: ReactNode; acoes?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#101828]">{children}</h1>
      {sub && <p className="mt-1 text-[15px] text-[#667085]">{sub}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{acoes}</div>
  </div>
);

export const tabelaCls = "w-full border-collapse";
export const theadCls = "border-b border-[#EAECF0] bg-[#F8F9FB]";
export const th = "px-6 py-3 text-left text-[12px] font-medium text-[#667085]";
export const td = "px-6 py-4 align-top text-[14px] text-[#101828]";
export const trCls = "border-b border-[#F0F2F5] last:border-0";

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
