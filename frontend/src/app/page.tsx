"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Download, AlertCircle, CheckCircle2, LogOut, FileSpreadsheet, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import GerenciadorCredenciais from "./GerenciadorCredenciais";

interface ContaCoupa {
  id: string;
  nome: string;
}

interface EstadoRobo {
  executando: boolean;
  conta: string | null;
  data: string | null;
  inicio: string | null;
  ultima_execucao: { data: string; fim: string; resultados: Record<string, string> } | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface HistoryFile {
  name: string;
  url: string;
  created_at: string | null;
}

export default function Home() {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoRobo | null>(null);
  const [statusSupported, setStatusSupported] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryFile[]>([]);

  // Contas Coupa (uma por CNPJ/filial), configuradas no servidor
  const [contas, setContas] = useState<ContaCoupa[]>([]);
  const [conta, setConta] = useState("");
  const [contaPadrao, setContaPadrao] = useState<string | null>(null);

  // Desligado (padrão): eventos que já vieram em capturas anteriores são pulados.
  // Ligado: o robô traz tudo de novo para a data, inclusive o que já foi capturado.
  const [incluirJaCapturados, setIncluirJaCapturados] = useState(false);

  // Gerenciador de credenciais: só aparece para administradores (decidido pelo backend em /eu)
  const [podeGerenciarCredenciais, setPodeGerenciarCredenciais] = useState(false);
  const [credenciaisAbertas, setCredenciaisAbertas] = useState(false);

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const obterToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .storage
        .from('planilhas')
        .list('', {
          limit: 12,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      if (data) {
        const filesWithUrl = data.map(file => ({
          name: file.name,
          url: supabase.storage.from('planilhas').getPublicUrl(file.name).data.publicUrl,
          created_at: file.created_at
        }));
        setHistory(filesWithUrl);
      }
    } catch (e) {
      console.error("Erro ao carregar histórico", e);
    }
  }, [supabase]);

  const deleteFile = async (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Deseja realmente excluir a planilha "${name}"?`)) return;

    // Feedback otimista
    setHistory(history.filter(f => f.name !== name));

    try {
      const { error } = await supabase.storage.from('planilhas').remove([name]);
      if (error) throw error;
      loadHistory();
    } catch (err) {
      console.error("Erro ao deletar", err);
      loadHistory();
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUserEmail(session.user.email ?? "Usuário");
        loadHistory();
      }
    };
    checkUser();

    // --- REALTIME SUBSCRIPTION START ---
    // Escuta novos arquivos sendo inseridos no storage do Supabase pelo n8n
    const channel = supabase
      .channel('realtime-storage-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'storage',
          table: 'objects',
          filter: `bucket_id=eq.planilhas`
        },
        async () => {
          // Novo arquivo no Storage: só atualiza o histórico. Quem decide que o robô
          // terminou é /status, porque "todas as filiais" gera mais de um arquivo.
          setTimeout(loadHistory, 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // --- REALTIME SUBSCRIPTION END ---
  }, [router, supabase, loadHistory]);

  // Backend antigo não tem /contas nem /status: nesse caso o seletor não aparece
  // e a tela se comporta como antes. Relido depois de salvar credenciais, porque
  // uma filial sem senha só passa a aparecer quando fica pronta.
  const carregarContas = useCallback(() => {
    fetch(`${BACKEND_URL}/contas`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.contas?.length) {
          const lista: ContaCoupa[] = data.contas;
          setContas(lista);
          setConta((atual) => (atual === "todas" || lista.some((c) => c.id === atual) ? atual : data.padrao || lista[0].id));
          setContaPadrao(data.padrao || lista[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Backend antigo não tem /eu: o botão de credenciais simplesmente não aparece.
    (async () => {
      try {
        const token = await obterToken();
        if (!token) return;
        const res = await fetch(`${BACKEND_URL}/eu`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const eu = await res.json();
        setPodeGerenciarCredenciais(Boolean(eu?.admin));
      } catch {
        // sem acesso ao backend: segue sem o gerenciador
      }
    })();
  }, [obterToken]);

  useEffect(() => {
    carregarContas();

    // Se o robô já estiver rodando (outra pessoa disparou, ou a página foi recarregada), mostra.
    fetch(`${BACKEND_URL}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((s: EstadoRobo | null) => {
        if (!s) return;
        setStatusSupported(true);
        setEstado(s);
        if (s.executando) setStatus("loading");
      })
      .catch(() => {});
  }, [carregarContas]);

  // Acompanha o robô enquanto ele roda e fecha o resultado por conta.
  useEffect(() => {
    if (status !== "loading" || !statusSupported) return;
    let ativo = true;
    const nome = (id: string) =>
      id === "todas" ? "Planilha unificada" : contas.find((c) => c.id === id)?.nome ?? id;

    const tick = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/status`);
        if (!res.ok || !ativo) return;
        const s: EstadoRobo = await res.json();
        if (!ativo) return;
        setEstado(s);
        if (s.executando) return;

        const resultados = Object.entries(s.ultima_execucao?.resultados ?? {});
        const falhas = resultados.filter(([, r]) => r !== "ok");
        if (falhas.length === 0) {
          setStatus("success");
          setMessage(
            resultados.length > 1
              ? `Concluído: ${resultados.map(([id]) => nome(id)).join(" e ")}. A planilha única, sem repetição entre filiais, está no histórico.`
              : `Concluído: ${resultados.map(([id]) => nome(id)).join("")}. A planilha está no histórico.`
          );
        } else {
          setStatus("error");
          setMessage(falhas.map(([id, r]) => `${nome(id)}: ${r.replace(/^erro:\s*/, "")}`).join(" | "));
        }
        loadHistory();
      } catch {
        // falha de rede momentânea: tenta de novo no próximo ciclo
      }
    };

    tick();
    const t = setInterval(tick, 5000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [status, statusSupported, contas, loadHistory]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const formatarDDMMAA = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getFullYear()).slice(-2)}`;

  const nomeConta = (id: string | null) =>
    id === "todas" ? "Todas as filiais" : contas.find((c) => c.id === id)?.nome ?? id ?? "";

  // Nome do arquivo: eventos_[conta_]DDMMAA_timestamp.xlsx (a conta padrão não leva id)
  const descreverArquivo = (name: string) => {
    const m = name.match(/^eventos_(?:([a-z0-9_-]+)_)?(\d{2})(\d{2})(\d{2})_\d+\.xlsx$/);
    if (!m) return { filial: null as string | null, dataEvento: null as string | null };
    return {
      filial: nomeConta(m[1] ?? contaPadrao),
      dataEvento: `${m[2]}/${m[3]}/${m[4]}`,
    };
  };

  const startExtraction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (date.length !== 6) {
      setStatus("error");
      setMessage("Por favor, digite a data no formato DDMMAA (ex: 190825)");
      return;
    }

    setStatus("loading");
    setMessage("Acionando o robô de automação...");
    setFileUrl(null);

    const params = new URLSearchParams({ data: date });
    if (conta) params.set("conta", conta);
    if (incluirJaCapturados) params.set("pular_verificacao_duplicados", "true");

    try {
      const res = await fetch(`${BACKEND_URL}/run-robot?${params.toString()}`, {
        method: "POST"
      });

      const data = await res.json();

      if (res.ok) {
        if (statusSupported) {
          // O andamento e o fim vêm de /status (efeito de acompanhamento acima)
          setEstado({ executando: true, conta: data.contas?.[0] ?? null, data: date, inicio: null, ultima_execucao: null });
        } else {
          setStatus("success");
          setMessage(data.message || "Robô iniciado com sucesso! O arquivo aparecerá no histórico em alguns instantes.");
          setTimeout(loadHistory, 10000);
          setTimeout(loadHistory, 60000); // 1 minuto depois por garantia
        }
      } else {
        setStatus("error");
        setMessage(data.detail || "Erro ao iniciar o robô. Verifique se o backend está rodando.");
      }
    } catch (err) {
      console.error("Erro ao disparar robô", err);
      setStatus("error");
      setMessage(`Erro de conexão. O servidor de automação (${BACKEND_URL}) está ativo?`);
    }
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans overflow-y-auto">

      {/* Top Header */}
      <div className="w-full flex justify-between items-center px-8 py-4 bg-white border-b border-gray-100">
        <div className="flex-1"></div>
        <div className="flex items-center space-x-4">
          {podeGerenciarCredenciais && (
            <button
              onClick={() => setCredenciaisAbertas(true)}
              className="text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-all active:scale-95"
            >
              Credenciais
            </button>
          )}
          <span className="text-sm font-semibold text-gray-600">{userEmail}</span>
          <button onClick={handleLogout} className="p-2 border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl transition-all active:scale-95" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>


      <div className="flex-1 flex flex-col md:flex-row items-start justify-center p-4 sm:p-8 gap-8 max-w-6xl mx-auto w-full">

        {/* Painel Esquerdo: Controle de Extração */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full md:w-1/2 md:sticky top-8"
        >
          <div className="bg-white border border-gray-200 rounded-[2rem] p-8 sm:p-10 shadow-xl shadow-gray-200/50">

            <div className="text-center mb-10">
              <img src="/logo.png" alt="Seven Suprimentos Industriais" className="h-24 mx-auto object-contain mb-4" />
              <p className="text-gray-500 font-medium tracking-wide">Extração Automatizada Vale</p>
            </div>

            <form onSubmit={startExtraction} className="space-y-6">
              {contas.length > 1 && (
                <div className="space-y-2">
                  <label htmlFor="conta" className="text-xs font-bold text-gray-400 ml-1 uppercase tracking-wider">
                    Filial (conta Coupa)
                  </label>
                  <select
                    id="conta"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                    value={conta}
                    onChange={(e) => setConta(e.target.value)}
                    disabled={status === "loading"}
                  >
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                    <option value="todas">Todas as filiais (uma depois da outra)</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="date" className="text-xs font-bold text-gray-400 ml-1 uppercase tracking-wider">
                  Data do Evento
                </label>
                <div className="relative group">
                  <input
                    id="date"
                    type="text"
                    maxLength={6}
                    placeholder="DDMMAA (ex: 190825)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all font-mono tracking-widest text-lg shadow-inner group-hover:bg-gray-100"
                    value={date}
                    onChange={(e) => setDate(e.target.value.replace(/\D/g, ''))}
                    disabled={status === "loading"}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={status === "loading"}
                    onClick={() => setDate(formatarDDMMAA(new Date()))}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    disabled={status === "loading"}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setDate(formatarDDMMAA(d));
                    }}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    Ontem
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
                <div>
                  <p id="rotulo-ja-capturados" className="text-sm font-semibold text-gray-700">Incluir eventos já capturados</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {incluirJaCapturados
                      ? "Ligado: traz todos os eventos da data, inclusive os que já vieram em capturas anteriores."
                      : "Desligado: pula os eventos que já vieram em capturas anteriores."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={incluirJaCapturados}
                  aria-labelledby="rotulo-ja-capturados"
                  disabled={status === "loading"}
                  onClick={() => setIncluirJaCapturados((v) => !v)}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${incluirJaCapturados ? "bg-emerald-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${incluirJaCapturados ? "translate-x-5" : ""}`}
                  />
                  <span className="sr-only">{incluirJaCapturados ? "Ligado" : "Desligado"}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full relative overflow-hidden rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                <div className="absolute inset-0 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                <div className="relative flex items-center justify-center space-x-2 px-6 py-4">
                  {status === "loading" ? (
                    <>
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                      <span className="text-white font-semibold tracking-wide">Processando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 text-white" />
                      <span className="text-white font-semibold tracking-wide">Iniciar Extração</span>
                    </>
                  )}
                </div>
              </button>
            </form>

            <AnimatePresence mode="wait">
              {status !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`p-5 rounded-2xl border ${status === "error" ? "bg-red-50 border-red-200 text-red-600" :
                    status === "success" ? "bg-green-50 border-green-200 text-green-700" :
                      "bg-blue-50 border-blue-200 text-blue-700"
                    } text-sm transition-colors duration-300 shadow-sm relative`}
                  >

                    {/* Barra de Progresso Visível apenas enquanto carrega */}
                    {status === "loading" && (
                      <div className="absolute bottom-0 left-0 h-1 bg-blue-200 w-full rounded-b-2xl overflow-hidden">
                        <div className="h-full w-full bg-blue-500 animate-pulse" />
                      </div>
                    )}

                    <div className="flex items-start space-x-3 mb-1">
                      {status === "error" && <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                      {status === "success" && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                      {status === "loading" && <Loader2 className="w-5 h-5 shrink-0 animate-spin mt-0.5" />}

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold leading-relaxed break-words">
                          {status === "loading" && estado?.executando && estado.conta
                            ? `Robô em execução: ${nomeConta(estado.conta)}`
                            : message}
                        </p>

                        {status === "loading" && (
                          <p className="text-xs text-blue-500/80 mt-1">
                            Pode levar alguns minutos. Você pode sair desta tela, o robô continua rodando.
                          </p>
                        )}

                        {status === "success" && fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex mt-4 bg-white hover:bg-green-100 border border-green-300 text-green-800 px-5 py-2.5 rounded-xl transition-all items-center space-x-2 text-xs font-bold shadow-sm active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                            <span>Baixar {fileUrl.split('/').pop()?.split('?')[0] || "Planilha"}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Painel Direito: Histórico */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full md:w-1/2 flex flex-col space-y-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Histórico
            </h2>
            <button onClick={loadHistory} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Atualizar</button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-[2rem] p-4 flex flex-col max-h-[600px] overflow-y-auto w-full gap-3 shadow-inner">
            {history.length === 0 ? (
              <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                <FileSpreadsheet className="w-12 h-12 mb-3 opacity-20" />
                <p>Nenhuma planilha extraída ainda.</p>
              </div>
            ) : (
              history.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:border-emerald-300 hover:shadow-md transition-all group relative cursor-pointer"
                >
                  <div className="flex items-start gap-3 overflow-hidden">
                    <div className="bg-emerald-50 p-2 rounded-lg shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 pr-16 bg-white z-10 w-full" onClick={(e) => { e.stopPropagation(); window.open(file.url, '_blank'); }}>
                      <p className="text-sm font-bold text-gray-800 truncate" title={file.name}>
                        {descreverArquivo(file.name).dataEvento
                          ? `Eventos de ${descreverArquivo(file.name).dataEvento}`
                          : file.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        {contas.length > 1 && descreverArquivo(file.name).filial && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md px-1.5 py-0.5 font-semibold">
                            {descreverArquivo(file.name).filial}
                          </span>
                        )}
                        <span>{file.created_at ? new Date(file.created_at).toLocaleString("pt-BR") : "Sem data"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2 z-20">
                    <div className="p-2 text-gray-300 group-hover:bg-emerald-50 rounded-lg transition-colors group-hover:text-emerald-500">
                      <Download className="w-5 h-5 pointer-events-none" />
                    </div>
                    <button
                      onClick={(e) => deleteFile(file.name, e)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Apagar Planilha Permanentemente"
                    >
                      <Trash2 className="w-5 h-5 pointer-events-none" />
                    </button>
                  </div>
                </a>
              ))
            )}
          </div>
        </motion.div>

      </div>

      {credenciaisAbertas && (
        <GerenciadorCredenciais
          backendUrl={BACKEND_URL}
          obterToken={obterToken}
          onFechar={() => setCredenciaisAbertas(false)}
          onSalvo={carregarContas}
        />
      )}
    </div>
  );
}
