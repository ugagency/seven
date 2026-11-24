"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ClipboardCheck, Download, List, LogOut, MessageSquare, RefreshCw, Settings, ShieldCheck, Users } from "lucide-react";
import "./os.css";
import { api, ErroApi, EuProvider, fmtDataHora, fmtNum, limparMemoria, PERFIS, Rotulo, supabase, useApi, type Eu, type J } from "./_lib";

const MENU: { href: string; rotulo: string; icone: typeof List; permissao?: string }[] = [
  { href: "/os", rotulo: "Fila de cotações", icone: List },
  { href: "/os/painel", rotulo: "Painel", icone: BarChart3 },
  { href: "/os/fornecedores", rotulo: "Fornecedores", icone: Users },
  { href: "/os/assistente", rotulo: "Assistente", icone: MessageSquare },
  { href: "/os/conferencia", rotulo: "Conferência", icone: ClipboardCheck },
  { href: "/os/captura", rotulo: "Capturas", icone: Download },
  { href: "/os/auditoria", rotulo: "Auditoria", icone: ShieldCheck, permissao: "auditoria.ver" },
  { href: "/os/admin", rotulo: "Administração", icone: Settings, permissao: "admin.usuarios" },
];

function secaoAtual(caminho: string) {
  if (caminho.startsWith("/os/item")) return "Fila de cotações / Ficha do produto";
  const m = [...MENU].reverse().find((x) => (x.href === "/os" ? caminho === "/os" : caminho.startsWith(x.href)));
  return m?.rotulo || "Seven OS";
}

function Robo({ eu }: { eu: Eu }) {
  const dias = useApi<J>("/os/captura/dias");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ultimoDia = dias.dados?.dias?.[0];
  const itensDia = (dias.dados?.dias || []).filter((d: J) => d.dia === ultimoDia?.dia).reduce((a: number, d: J) => a + d.linhas, 0);
  const pode = eu.permissoes.includes("captura.rodar");
  const trazer = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await api("/os/captura/sincronizar", { metodo: "POST" });
      setMsg(r.ocupado ? "Já há uma atualização em andamento." : r.linhas_novas ? `${fmtNum(r.linhas_novas)} linha(s) nova(s).` : "Nada novo desde a última vez.");
      dias.recarregar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="m-3 rounded-xl border border-[#EAECF0] bg-[#F8F9FB] p-4">
      <Rotulo>Robô de captura · Coupa</Rotulo>
      <p className="mt-2.5 flex gap-2 text-[13px] leading-snug text-[#344054]">
        <span className="relative mt-[5px] flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00A99D] opacity-40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#00A99D]" /></span>
        {dias.dados?.ultima_captura ? <span>Última captura {fmtDataHora(dias.dados.ultima_captura)} · {fmtNum(itensDia)} itens</span> : <span>Sem captura no OS ainda</span>}
      </p>
      {pode && (
        <button onClick={trazer} disabled={ocupado} className="mt-3 flex h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] font-medium text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-[#F2F4F7] disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${ocupado ? "animate-spin" : ""}`} aria-hidden /> {ocupado ? "Atualizando…" : "Trazer capturas novas"}
        </button>
      )}
      {msg && <p className="mt-2 text-[12px] text-[#667085]">{msg}</p>}
    </div>
  );
}

export default function OsLayout({ children }: { children: ReactNode }) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [erro, setErro] = useState<{ status: number; msg: string } | null>(null);
  const caminho = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      try {
        setEu(await api<Eu>("/os/eu"));
      } catch (e) {
        const x = e as ErroApi;
        if (x.status === 401) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        else setErro({ status: x.status, msg: x.message });
      }
    })();
  }, [router]);

  const sair = async () => {
    limparMemoria();
    await supabase().auth.signOut();
    router.replace("/login?next=/os");
  };

  if (erro)
    return (
      <main className="os-root grid min-h-screen place-items-center px-6">
        <div className="max-w-md rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)] p-8 text-center">
          <img src="/os/logo-seven.png" alt="seven" className="mx-auto h-10" />
          <h1 className="mt-6 text-[20px] font-semibold">{erro.status === 403 ? "Você ainda não tem acesso ao Seven OS" : "Seven OS indisponível"}</h1>
          <p className="mt-2 text-[14px] text-[#667085]">{erro.msg}</p>
          <div className="mt-6 flex justify-center gap-4 text-[14px] font-semibold">
            <Link href="/" className="text-[#00756D] hover:underline">Ir para a captura atual</Link>
            <button onClick={sair} className="text-[#344054] hover:underline">Sair</button>
          </div>
        </div>
      </main>
    );
  if (!eu) return <p className="os-root grid min-h-screen place-items-center text-[14px] text-[#667085]">Carregando…</p>;

  const itens = MENU.filter((m) => !m.permissao || eu.permissoes.includes(m.permissao));
  const ativo = (href: string) => (href === "/os" ? caminho === "/os" || caminho.startsWith("/os/item") : caminho.startsWith(href));
  const inicial = (eu.nome || eu.email).trim().charAt(0).toUpperCase();

  return (
    <EuProvider eu={eu}>
      <div className="os-root min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-[#EAECF0] bg-white lg:flex">
          <div className="px-5 pb-4 pt-6">
            <Link href="/os" aria-label="Seven OS, início"><img src="/os/logo-seven.png" alt="seven" className="h-10" /></Link>
            <span className="mt-2 block text-[12px] font-medium text-[#667085]">OS de cotações</span>
          </div>
          <nav aria-label="Seções" className="flex-1 overflow-y-auto px-3 py-2">
            {itens.map((m) => {
              const a = ativo(m.href);
              const Icone = m.icone;
              return (
                <Link key={m.href} href={m.href} aria-current={a ? "page" : undefined}
                  className={`mb-0.5 flex h-[40px] items-center gap-3 rounded-lg px-3 text-[14px] font-medium ${a ? "bg-[#ECFDF9] text-[#00665F]" : "text-[#344054] hover:bg-[#F8F9FB]"}`}>
                                    <Icone className={`h-[18px] w-[18px] ${a ? "text-[#00A99D]" : "text-[#667085]"}`} strokeWidth={1.75} aria-hidden />
                  {m.rotulo}
                </Link>
              );
            })}
          </nav>
          <Robo eu={eu} />
        </aside>

        <div className="lg:pl-[244px]">
          <header className="sticky top-0 z-20 border-b border-[#EAECF0] bg-white/80 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-7">
              <p className="min-w-0 truncate text-[14px]">
                <span className="hidden text-[#667085] sm:inline">Seven Suprimentos Industriais <span className="px-2 text-[#B9C1CB]">/</span></span>
                <span className="font-semibold">{secaoAtual(caminho)}</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF9] text-[14px] font-semibold text-[#00665F] ring-1 ring-[#99E2DC]" aria-hidden>{inicial}</div>
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-[14px] font-semibold">{eu.nome || eu.email}</div>
                  <div className="text-[12px] text-[#667085]">{PERFIS[eu.perfil] || eu.perfil}</div>
                </div>
                <button onClick={sair} className="ml-1 p-1.5 text-[#667085] hover:text-[#0B1A2A]" title="Sair" aria-label="Sair"><LogOut className="h-[18px] w-[18px]" /></button>
              </div>
            </div>
            <nav aria-label="Seções" className="flex gap-1 overflow-x-auto border-t border-[#F0F2F5] px-2 py-1.5 lg:hidden">
              {itens.map((m) => (
                <Link key={m.href} href={m.href} aria-current={ativo(m.href) ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[14px] font-medium ${ativo(m.href) ? "bg-[#ECFDF9] text-[#00665F]" : "text-[#344054]"}`}>{m.rotulo}</Link>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-[1280px] px-4 py-7 lg:px-7">{children}</main>
        </div>
      </div>
    </EuProvider>
  );
}
