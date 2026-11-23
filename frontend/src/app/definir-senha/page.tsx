"use client";
/* eslint-disable @next/next/no-img-element */
// Pagina de chegada do convite do Seven OS. O link do Supabase traz o login no endereco (#access_token=...);
// aqui a pessoa define a propria senha e segue para o Seven OS. Nao mexe na tela atual do robo.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import "../os/os.css";

type Fase = "lendo" | "pronto" | "invalido" | "salvando";

export default function DefinirSenha() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("lendo");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    window.history.replaceState(null, "", window.location.pathname); // tira o token da barra de endereco
    const sb = createClient();
    (async () => {
      if (h.get("error")) {
        setErro(h.get("error_code") === "otp_expired" ? "Este convite expirou ou já foi usado. Peça um novo ao administrador." : h.get("error_description") || "Convite inválido.");
        setFase("invalido");
        return;
      }
      const at = h.get("access_token"), rt = h.get("refresh_token");
      if (at && rt) {
        const { error } = await sb.auth.setSession({ access_token: at, refresh_token: rt });
        if (error) { setErro("Não foi possível abrir o convite. Peça um novo ao administrador."); setFase("invalido"); return; }
      }
      const { data } = await sb.auth.getUser();
      if (!data.user) { setErro("Abra esta página pelo link do convite que você recebeu."); setFase("invalido"); return; }
      setEmail(data.user.email || "");
      setFase("pronto");
    })();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== conf) return setErro("As duas senhas não são iguais.");
    setFase("salvando");
    const { error } = await createClient().auth.updateUser({ password: senha });
    if (error) { setErro(error.message); setFase("pronto"); return; }
    router.replace("/os");
  };

  const campo = "h-[44px] w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 text-[15px] outline-none focus:border-[#00A99D] focus:ring-4 focus:ring-[#00A99D]/15";
  return (
    <main className="os-root grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#EAECF0] bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_-12px_rgba(16,24,40,0.12)]">
        <img src="/os/logo-seven.png" alt="seven" className="h-10" />
        <h1 className="mt-6 text-[22px] font-semibold">Crie sua senha</h1>
        {fase === "lendo" && <p className="mt-2 text-[14px] text-[#667085]">Abrindo o convite…</p>}
        {fase === "invalido" && (
          <>
            <p role="alert" className="mt-3 rounded-lg bg-[#FEF3F2] px-4 py-3 text-[14px] text-[#B42318]">{erro}</p>
            <a href="/login" className="mt-5 inline-block text-[14px] font-medium text-[#00756D] hover:underline">Ir para o login</a>
          </>
        )}
        {(fase === "pronto" || fase === "salvando") && (
          <form onSubmit={salvar} className="mt-2 space-y-4">
            <p className="text-[14px] text-[#667085]">Acesso ao Seven OS para <span className="font-medium text-[#101828]">{email}</span>. Use esta senha nas próximas vezes que entrar.</p>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-[#344054]">Senha nova</span><input type="password" autoComplete="new-password" autoFocus className={campo} value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-[#344054]">Repita a senha</span><input type="password" autoComplete="new-password" className={campo} value={conf} onChange={(e) => setConf(e.target.value)} /></label>
            {erro && <p role="alert" className="rounded-lg bg-[#FEF3F2] px-4 py-3 text-[14px] text-[#B42318]">{erro}</p>}
            <button type="submit" disabled={fase === "salvando"} className="h-[44px] w-full rounded-lg bg-[#0B1A2A] text-[15px] font-medium text-white hover:bg-[#1E3550] disabled:opacity-50">{fase === "salvando" ? "Salvando…" : "Salvar e entrar no Seven OS"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
