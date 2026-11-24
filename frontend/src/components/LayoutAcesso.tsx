/* eslint-disable @next/next/no-img-element */
// Moldura das telas de acesso do Seven OS (login e definir senha): painel da marca a esquerda, formulario a direita.
import type { ReactNode } from "react";
import "../app/os/os.css";

export default function LayoutAcesso({ children }: { children: ReactNode }) {
  return (
    <main className="os-root grid min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0B1A2A] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-[#00A99D] opacity-20 blur-[120px]" />
        <img src="/os/logo-seven-branco.png" alt="Seven Suprimentos Industriais" className="relative h-10 w-auto self-start" />
        <div className="relative mt-auto max-w-[420px]">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5FD3C9]">Seven OS</p>
          <p className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em]">Cotações da Vale, fornecedores e preços num lugar só.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">O robô traz os eventos do Coupa. A equipe identifica a peça, cota com o fornecedor e responde no prazo.</p>
        </div>
      </aside>
      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">{children}</section>
    </main>
  );
}
