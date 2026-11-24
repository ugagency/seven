"use client";
/* eslint-disable @next/next/no-img-element */
// Login do Seven OS (e da tela atual do robo). Sem cadastro aberto: contas sao criadas por convite no Admin.
// Depois de entrar, volta para a pagina que pediu o login (?next=/os...) ou, sem isso, para a tela inicial.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import LayoutAcesso from "@/components/LayoutAcesso";

type Modo = "entrar" | "esqueci" | "enviado";

function destinoSeguro(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

function traduzir(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Acesso ainda não ativado. Use o link do convite que você recebeu por e-mail.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (/fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return msg;
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !senha) return setErro("Informe e-mail e senha.");
    setCarregando(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setErro(traduzir(error.message));
      setCarregando(false);
      return;
    }
    router.replace(destinoSeguro(new URLSearchParams(window.location.search).get("next")));
  };

  const pedirLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe o e-mail do seu acesso.");
    setCarregando(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/definir-senha` });
    setCarregando(false);
    // Mesmo retorno para e-mail cadastrado ou nao, para nao revelar quem tem acesso.
    if (error && /rate limit|too many/i.test(error.message)) return setErro(traduzir(error.message));
    setModo("enviado");
  };

  const campo = "h-11 w-full rounded-md border border-[#CDD3DB] bg-white px-3 text-[15px] text-[#0B1A2A] outline-none transition-colors focus:border-[#0B1A2A] disabled:bg-[#F6F8FA]";
  const botao = "mt-8 h-11 w-full rounded-md bg-[#0B1A2A] text-[15px] font-medium text-white transition-colors hover:bg-[#16293F] disabled:opacity-60";
  const link = "text-[14px] font-medium text-[#00897F] hover:text-[#0B1A2A]";

  return (
    <LayoutAcesso>
      <div className="w-full max-w-[380px]">
        <img src="/os/logo-seven.png" alt="Seven Suprimentos Industriais" className="mb-12 h-9 lg:hidden" />

        {modo === "entrar" && (
          <form onSubmit={entrar} noValidate>
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#00897F]">Seven OS</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Entrar</h1>
            <p className="mt-2 text-[15px] text-[#5B6675]">Use o e-mail e a senha do seu acesso.</p>

            <label className="mt-8 block">
              <span className="mb-1.5 block text-[13px] font-medium">E-mail</span>
              <input type="email" autoComplete="username" autoFocus className={campo} value={email} disabled={carregando} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-medium">Senha</span>
                <button type="button" onClick={() => { setModo("esqueci"); setErro(null); }} className="text-[13px] text-[#5B6675] hover:text-[#0B1A2A]">Esqueci minha senha</button>
              </span>
              <span className="relative block">
                <input type={ver ? "text" : "password"} autoComplete="current-password" className={`${campo} pr-11`} value={senha} disabled={carregando} onChange={(e) => setSenha(e.target.value)} />
                <button type="button" onClick={() => setVer((v) => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#5B6675] hover:text-[#0B1A2A]" aria-label={ver ? "Esconder senha" : "Mostrar senha"}>
                  {ver ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </span>
            </label>

            {erro && <p role="alert" className="mt-5 border-l-2 border-[#D92D20] pl-3 text-[14px] text-[#B42318]">{erro}</p>}

            <button type="submit" disabled={carregando} className={botao}>{carregando ? "Entrando…" : "Entrar"}</button>
            <p className="mt-6 text-[13px] leading-relaxed text-[#8A94A3]">Não tem acesso? Peça a quem administra o Seven OS na Seven. O acesso é criado por convite.</p>
          </form>
        )}

        {modo === "esqueci" && (
          <form onSubmit={pedirLink} noValidate>
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#00897F]">Nova senha</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Esqueceu a senha?</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5B6675]">Informe o e-mail do seu acesso. Enviamos um link para você criar uma senha nova.</p>
            <label className="mt-8 block">
              <span className="mb-1.5 block text-[13px] font-medium">E-mail</span>
              <input type="email" autoComplete="username" autoFocus className={campo} value={email} disabled={carregando} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erro && <p role="alert" className="mt-5 border-l-2 border-[#D92D20] pl-3 text-[14px] text-[#B42318]">{erro}</p>}
            <button type="submit" disabled={carregando} className={botao}>{carregando ? "Enviando…" : "Enviar link"}</button>
            <button type="button" onClick={() => { setModo("entrar"); setErro(null); }} className={`mt-6 ${link}`}>Voltar para o login</button>
          </form>
        )}

        {modo === "enviado" && (
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#00897F]">Nova senha</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Confira seu e-mail</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5B6675]">
              Se <span className="text-[#0B1A2A]">{email.trim()}</span> tiver acesso ao Seven OS, você vai receber um link para criar uma senha nova. O link vale uma vez e por tempo limitado. Olhe também a caixa de spam.
            </p>
            <button type="button" onClick={() => { setModo("entrar"); setSenha(""); }} className={`mt-8 ${link}`}>Voltar para o login</button>
          </div>
        )}
      </div>
    </LayoutAcesso>
  );
}
