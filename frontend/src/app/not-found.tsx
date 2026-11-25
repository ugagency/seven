/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-[#0B1A2A]">
      <img src="/os/logo-seven.png" alt="Seven Suprimentos Industriais" className="mb-10 h-9" />
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#00897F]">Página não encontrada</p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Este endereço não existe</h1>
      <p className="mt-2 max-w-[420px] text-[15px] text-[#5B6675]">Confira o endereço ou volte para o início.</p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-md bg-[#0B1A2A] px-5 text-[15px] font-medium text-white hover:bg-[#16293F]">Voltar ao início</Link>
    </main>
  );
}
