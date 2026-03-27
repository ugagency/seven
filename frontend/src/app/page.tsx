"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Download, AlertCircle, CheckCircle2, LogOut, Settings, X, Lock, Mail, FileSpreadsheet, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface HistoryFile {
  name: string;
  url: string;
  created_at: string | null;
}

export default function Home() {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0); // Para a barra evolutiva
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [valeEmail, setValeEmail] = useState("");
  const [valePassword, setValePassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryFile[]>([]);

  const router = useRouter();
  const supabase = createClient();

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .storage
        .from('planilhas')
        .list('', {
          limit: 5,
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

  const fetchSettings = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('user_settings')
      .select('vale_email, vale_password')
      .eq('user_id', uid)
      .single();

    if (data) {
      setValeEmail(data.vale_email || "");
      setValePassword(data.vale_password || "");
    }
    setSettingsLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUserEmail(session.user.email ?? "Usuário");
        setUserId(session.user.id);
        fetchSettings(session.user.id);
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
        async (payload) => {
          console.log('Novo arquivo detectado no Storage:', payload.new.name);

          // Pequeno delay para garantir que o Supabase processou o objeto
          setTimeout(loadHistory, 1000);

          // Opcional: Notificar o usuário se ele estiver com o status "loading"
          setStatus(currentStatus => {
            if (currentStatus === "loading") {
              setMessage(`Robô finalizou! Arquivo "${payload.new.name}" pronto.`);
              setProgress(100);
              return "success";
            }
            return currentStatus;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // --- REALTIME SUBSCRIPTION END ---
  }, [router, supabase, fetchSettings, loadHistory]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, vale_email: valeEmail, vale_password: valePassword });

    setIsSaving(false);
    if (!error) {
      setShowSettings(false);
    } else {
      alert("Erro ao salvar no banco. Verifique se a tabela foi criada no Supabase.");
    }
  };

  const startExtraction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!valeEmail || !valePassword) {
      setShowSettings(true);
      return;
    }

    if (date.length !== 6) {
      setStatus("error");
      setMessage("Por favor, digite a data no formato DDMMAA (ex: 190825)");
      return;
    }

    setStatus("loading");
    setProgress(10);
    setMessage("Acionando o robô de automação...");
    setFileUrl(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/run-robot?data=${date}`, {
        method: "POST"
      });

      const data = await res.json();

      if (res.ok) {
        setProgress(100);
        setStatus("success");
        setMessage(data.message || "Robô iniciado com sucesso! O arquivo aparecerá no histórico em alguns instantes.");

        // Atualiza o histórico após um tempo para detectar o novo arquivo no Supabase
        setTimeout(loadHistory, 10000);
        setTimeout(loadHistory, 60000); // 1 minuto depois por garantia
      } else {
        setStatus("error");
        setMessage(data.detail || "Erro ao iniciar o robô. Verifique se o backend está rodando.");
      }
    } catch (err) {
      console.error("Erro ao disparar robô", err);
      setStatus("error");
      setMessage("Erro de conexão. O servidor de automação local (localhost:8000) está ativo?");
    }
  };

  if (!userEmail || !settingsLoaded) {
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
          <span className="text-sm font-semibold text-gray-600">{userEmail}</span>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition-all active:scale-95" title="Configurar Credenciais Vale">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="p-2 border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl transition-all active:scale-95" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl relative"
            >
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                disabled={isSaving}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Cofre de Credenciais</h2>
                <p className="text-sm text-gray-500 mt-1">Armazenadas no Supabase de forma segura.</p>
              </div>

              <form onSubmit={saveSettings} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">E-mail (Vale)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="email@sevensuprimentos..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-gray-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all text-sm"
                      value={valeEmail}
                      disabled={isSaving}
                      onChange={(e) => setValeEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Senha (Vale)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-gray-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all text-sm"
                      value={valePassword}
                      disabled={isSaving}
                      onChange={(e) => setValePassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full mt-2 bg-emerald-600 text-white rounded-2xl py-3 flex items-center justify-center space-x-2 font-semibold hover:bg-emerald-700 transition-colors shadow-lg active:scale-95 disabled:opacity-70"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    "Guardar no Cofre"
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                        <div
                          className="h-full bg-blue-500 transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-start space-x-3 mb-1">
                      {status === "error" && <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                      {status === "success" && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                      {status === "loading" && <Loader2 className="w-5 h-5 shrink-0 animate-spin mt-0.5" />}

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold leading-relaxed break-words">{message}</p>

                        {/* Status de Loading em Porcentagem Textual */}
                        {status === "loading" && (
                          <p className="text-xs text-blue-500/80 font-bold mt-1 tracking-wider uppercase">
                            {progress}% Concluído
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
                      <p className="text-sm font-bold text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {file.created_at ? new Date(file.created_at).toLocaleString("pt-BR") : "Sem data"}
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
    </div>
  );
}
