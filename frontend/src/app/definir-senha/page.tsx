"use client";
/* eslint-disable @next/next/no-img-element */
// Pagina de chegada do convite do Seven OS. O link traz um codigo (?convite=...); aqui ele vira login
// (verifyOtp), a pessoa define a propria senha e segue para o Seven OS. Nao mexe na tela atual do robo.
// Tambem aceita o formato antigo do Supabase (#access_token=...), para e-mails enviados pelo proprio Supabase.
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import LayoutAcesso from "@/components/LayoutAcesso";

type Fase = "lendo" | "pronto" | "invalido" | "salvando";

function Formulario() {
  const router = useRouter();
  const iniciou = useRef(false);
  const [fase, setFase] = useState<Fase>("lendo");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [esqueci, setEsqueci] = useState(false);

  useEffect(() => {
    if (iniciou.current) return; // o codigo so pode ser usado uma vez
    iniciou.current = true;
    const q = new URLSearchParams(window.location.search);
    const codigo = q.get("convite");
    const pkce = q.get("code"); // "Esqueci minha senha" pedido no login, com o e-mail padrao do Supabase
    const tipo = q.get("tipo") === "senha" || pkce ? "recovery" : "invite";
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    window.history.replaceState(null, "", window.location.pathname); // tira o codigo da barra de endereco
    const sb = createClient();
    (async () => {
      const falhou = (m: string) => { setErro(m); setFase("invalido"); };
      if (h.get("error")) return falhou(h.get("error_code") === "otp_expired" ? "Este link expirou ou já foi usado." : "Este link não é válido.");
      if (codigo) {
        const { error } = await sb.auth.verifyOtp({ token_hash: codigo, type: tipo });
        if (error) return falhou("Este link expirou ou já foi usado.");
      } else if (pkce) {
        const { error } = await sb.auth.exchangeCodeForSession(pkce);
        if (error) return falhou("Este link expirou ou já foi usado. Abra o link no mesmo navegador em que pediu a senha nova.");
      } else if (h.get("access_token") && h.get("refresh_token")) {
        const { error } = await sb.auth.setSession({ access_token: h.get("access_token")!, refresh_token: h.get("refresh_token")! });
        if (error) return falhou("Este link expirou ou já foi usado.");
      }
      const { data } = await sb.auth.getUser();
      if (!data.user) return falhou("Abra esta página pelo link que você recebeu.");
      setEsqueci(tipo === "recovery");
      setEmail(data.user.email || "");
      setNome(((data.user.user_metadata?.nome as string) || "").split(" ")[0]);
      setFase("pronto");
    })();
  }, []);

  const tamanhoOk = senha.length >= 8;
  const iguais = senha.length > 0 && senha === conf;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!tamanhoOk || !iguais) return setErro(!tamanhoOk ? "Use pelo menos 8 caracteres." : "As duas senhas não são iguais.");
    setFase("salvando");
    const { error } = await createClient().auth.updateUser({ password: senha });
    if (error) {
      setErro(/different from the old/i.test(error.message) ? "Use uma senha diferente da anterior." : /weak|short/i.test(error.message) ? "Senha fraca. Misture letras e números." : error.message);
      setFase("pronto");
      return;
    }
    router.replace("/os");
  };

  const campo = "h-11 w-full rounded-md border border-[#CDD3DB] bg-white px-3 text-[15px] text-[#0B1A2A] outline-none transition-colors focus:border-[#0B1A2A]";

  return (
    <div className="w-full max-w-[380px]">
      <img src="/os/logo-seven.png" alt="Seven Suprimentos Industriais" className="mb-12 h-9 lg:hidden" />
      {fase === "lendo" && <p className="text-[14px] text-[#5B6675]">Conferindo o link…</p>}

      {fase === "invalido" && (
        <>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Link sem validade</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5B6675]">{erro} Cada link funciona uma vez e por tempo limitado. Peça um novo a quem administra o Seven OS na Seven.</p>
          <a href="/login?next=/os" className="mt-8 inline-flex h-11 items-center rounded-md border border-[#CDD3DB] px-4 text-[14px] font-medium hover:border-[#0B1A2A]">Ir para o login</a>
        </>
      )}

      {(fase === "pronto" || fase === "salvando") && (
        <form onSubmit={salvar} noValidate>
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#00897F]">{esqueci ? "Nova senha" : "Primeiro acesso"}</p>
          <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{esqueci ? "Defina uma nova senha" : nome ? `${nome}, defina sua senha` : "Defina sua senha"}</h1>
          <p className="mt-2 text-[15px] text-[#5B6675]">Login: <span className="text-[#0B1A2A]">{email}</span></p>

          <label className="mt-8 block">
            <span className="mb-1.5 block text-[13px] font-medium">Senha</span>
            <span className="relative block">
              <input type={ver ? "text" : "password"} autoComplete="new-password" autoFocus className={`${campo} pr-11`} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <button type="button" onClick={() => setVer((v) => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#5B6675] hover:text-[#0B1A2A]" aria-label={ver ? "Esconder senha" : "Mostrar senha"}>
                {ver ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </span>
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium">Confirme a senha</span>
            <input type={ver ? "text" : "password"} autoComplete="new-password" className={campo} value={conf} onChange={(e) => setConf(e.target.value)} />
          </label>

          <ul className="mt-4 space-y-1.5 text-[13px]">
            {[[tamanhoOk, "Pelo menos 8 caracteres"], [iguais, "As duas senhas iguais"]].map(([ok, t]) => (
              <li key={t as string} className={`flex items-center gap-2 ${ok ? "text-[#00897F]" : "text-[#8A94A3]"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${ok ? "border-[#00A99D] bg-[#00A99D] text-white" : "border-[#CDD3DB]"}`}>{ok && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                {t as string}
              </li>
            ))}
          </ul>

          {erro && <p role="alert" className="mt-5 border-l-2 border-[#D92D20] pl-3 text-[14px] text-[#B42318]">{erro}</p>}

          <button type="submit" disabled={fase === "salvando"} className="mt-8 h-11 w-full rounded-md bg-[#0B1A2A] text-[15px] font-medium text-white transition-colors hover:bg-[#16293F] disabled:opacity-60">
            {fase === "salvando" ? "Salvando…" : "Salvar e entrar"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function DefinirSenha() {
  return (
    <LayoutAcesso>
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </LayoutAcesso>
  );
}
