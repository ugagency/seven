"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

// Gerenciador de credenciais do Coupa. A senha so ENTRA: o backend nunca devolve a senha
// (nem cifrada). Ele exige o login do painel e e-mail na lista de administradores.

interface CredencialConta {
  id: string;
  nome: string;
  usuario: string | null;
  tem_senha: boolean;
  fonte_usuario: "banco" | "env" | null;
  fonte_senha: "banco" | "env" | null;
  pronta: boolean;
  erro: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
}

interface Props {
  backendUrl: string;
  obterToken: () => Promise<string | null>;
  onFechar: () => void;
  onSalvo: () => void;
}

const descreverSenha = (c: CredencialConta) => {
  if (c.erro) return c.erro;
  if (c.fonte_senha === "banco") return "Senha salva no banco (cifrada).";
  if (c.fonte_senha === "env") return "Senha vinda do arquivo do servidor (provisório). Salve aqui para passar a usar o banco.";
  return "Sem senha: esta filial não roda até você salvar uma.";
};

export default function GerenciadorCredenciais({ backendUrl, obterToken, onFechar, onSalvo }: Props) {
  const [contas, setContas] = useState<CredencialConta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState("");
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const [senhas, setSenhas] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Record<string, { ok: boolean; texto: string }>>({});

  const chamar = useCallback(
    async (caminho: string, init?: RequestInit) => {
      const token = await obterToken();
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const res = await fetch(`${backendUrl}${caminho}`, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.detail || `Erro ${res.status}`);
      return corpo;
    },
    [backendUrl, obterToken]
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const dados = await chamar("/credenciais");
      const lista: CredencialConta[] = dados.contas ?? [];
      setContas(lista);
      setUsuarios(Object.fromEntries(lista.map((c) => [c.id, c.usuario ?? ""])));
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Não foi possível carregar as credenciais.");
    } finally {
      setCarregando(false);
    }
  }, [chamar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async (c: CredencialConta) => {
    const usuario = (usuarios[c.id] ?? "").trim();
    const senha = senhas[c.id] ?? "";
    const mudouUsuario = usuario !== "" && usuario !== (c.usuario ?? "");
    if (!mudouUsuario && !senha) {
      setAviso((a) => ({ ...a, [c.id]: { ok: false, texto: "Nada para salvar: altere o usuário ou digite a nova senha." } }));
      return;
    }
    setSalvando(c.id);
    setAviso((a) => ({ ...a, [c.id]: { ok: true, texto: "" } }));
    try {
      await chamar(`/credenciais/${encodeURIComponent(c.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: mudouUsuario ? usuario : null, senha: senha || null }),
      });
      setSenhas((s) => ({ ...s, [c.id]: "" }));
      setAviso((a) => ({ ...a, [c.id]: { ok: true, texto: "Salvo. Vale a partir da próxima extração." } }));
      await carregar();
      onSalvo();
    } catch (e) {
      setAviso((a) => ({ ...a, [c.id]: { ok: false, texto: e instanceof Error ? e.message : "Erro ao salvar." } }));
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-6 sm:p-8 my-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-credenciais"
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 id="titulo-credenciais" className="text-xl font-bold text-gray-800">Credenciais do Coupa</h2>
          <button onClick={onFechar} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
            Fechar
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Use quando a senha de uma filial mudar no Coupa. A senha fica cifrada no banco e não é exibida de volta.
        </p>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : erroGeral ? (
          <div className="p-4 rounded-2xl border bg-red-50 border-red-200 text-red-600 text-sm">{erroGeral}</div>
        ) : (
          <div className="space-y-5">
            {contas.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-800">{c.nome}</p>
                  <span
                    className={`text-xs font-semibold rounded-md px-2 py-0.5 border ${
                      c.pronta ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {c.pronta ? "Pronta para rodar" : "Incompleta"}
                  </span>
                </div>

                <div className="space-y-1">
                  <label htmlFor={`usuario-${c.id}`} className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Usuário (e-mail do Coupa)
                  </label>
                  <input
                    id={`usuario-${c.id}`}
                    type="email"
                    autoComplete="off"
                    value={usuarios[c.id] ?? ""}
                    onChange={(e) => setUsuarios((u) => ({ ...u, [c.id]: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor={`senha-${c.id}`} className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Nova senha
                  </label>
                  <input
                    id={`senha-${c.id}`}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Deixe em branco para não alterar"
                    value={senhas[c.id] ?? ""}
                    onChange={(e) => setSenhas((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <p className={`text-xs ${c.erro ? "text-red-600" : "text-gray-500"}`}>{descreverSenha(c)}</p>
                {c.atualizado_em && (
                  <p className="text-xs text-gray-400">
                    Alterado em {new Date(c.atualizado_em).toLocaleString("pt-BR")}
                    {c.atualizado_por ? ` por ${c.atualizado_por}` : ""}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => salvar(c)}
                    disabled={salvando !== null}
                    className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl px-4 py-2 transition-colors disabled:opacity-60"
                  >
                    {salvando === c.id ? "Salvando..." : "Salvar"}
                  </button>
                  {aviso[c.id]?.texto && (
                    <span className={`text-xs ${aviso[c.id].ok ? "text-emerald-700" : "text-red-600"}`}>{aviso[c.id].texto}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
