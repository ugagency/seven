"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ErroApi, EuProvider, PERFIS, supabase, type Eu } from "./_lib";

const MENU: { href: string; rotulo: string; permissao?: string; perfis?: string[] }[] = [
  { href: "/os", rotulo: "Fila" },
  { href: "/os/conferencia", rotulo: "Conferência" },
  { href: "/os/fornecedores", rotulo: "Fornecedores" },
  { href: "/os/captura", rotulo: "Captura" },
  { href: "/os/painel", rotulo: "Painel" },
  { href: "/os/assistente", rotulo: "Assistente" },
  { href: "/os/auditoria", rotulo: "Auditoria", permissao: "auditoria.ver" },
  { href: "/os/admin", rotulo: "Administração", permissao: "admin.usuarios" },
];

export default function OsLayout({ children }: { children: ReactNode }) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [erro, setErro] = useState<{ status: number; msg: string } | null>(null);
  const caminho = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      try {
        setEu(await api<Eu>("/os/eu"));
      } catch (e) {
        const x = e as ErroApi;
        if (x.status === 401) router.replace("/login");
        else setErro({ status: x.status, msg: x.message });
      }
    })();
  }, [router]);

  const sair = async () => {
    await supabase().auth.signOut();
    router.replace("/login");
  };

  if (erro)
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{erro.status === 403 ? "Você ainda não tem acesso ao Seven OS" : "Seven OS indisponível"}</h1>
        <p className="mt-2 text-sm text-slate-600">{erro.msg}</p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/" className="font-medium text-indigo-700 hover:underline">Ir para a captura atual</Link>
          <button onClick={sair} className="font-medium text-slate-600 hover:underline">Sair</button>
        </div>
      </main>
    );
  if (!eu) return <p className="py-24 text-center text-sm text-slate-500">Carregando…</p>;

  const itens = MENU.filter((m) => !m.permissao || eu.permissoes.includes(m.permissao));
  const ativo = (href: string) => (href === "/os" ? caminho === "/os" || caminho.startsWith("/os/item") : caminho.startsWith(href));

  return (
    <EuProvider eu={eu}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <Link href="/os" className="text-base font-semibold tracking-tight text-slate-900">Seven OS</Link>
            <nav aria-label="Seções" className="flex flex-1 flex-wrap gap-1">
              {itens.map((m) => (
                <Link key={m.href} href={m.href} aria-current={ativo(m.href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ativo(m.href) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                  {m.rotulo}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{eu.nome || eu.email} · {PERFIS[eu.perfil] || eu.perfil}</span>
              <button onClick={sair} className="font-medium text-slate-600 hover:text-slate-900 hover:underline">Sair</button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
      </div>
    </EuProvider>
  );
}
