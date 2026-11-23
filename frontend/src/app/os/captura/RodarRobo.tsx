"use client";
// Dispara o robô de captura pelo Seven OS, com as mesmas escolhas da tela atual da Karen:
// filial (conta Coupa ou todas), data do evento e incluir ou não os eventos já capturados.
// Usa as mesmas rotas do robô (/contas, /status, /run-robot); nada muda no robô.
// O robô só roda uma captura por vez (trava no servidor); se a Karen estiver rodando, aparece aqui.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Aviso, Botao, api, campoCls, fmtNum } from "../_lib";

const ROBO = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
// Em teste local, NEXT_PUBLIC_ROBO_SIMULAR=1 faz o robô coletar sem gravar no banco.
const SIMULAR = process.env.NEXT_PUBLIC_ROBO_SIMULAR === "1";

type Conta = { id: string; nome: string };
type EstadoRobo = {
  executando: boolean;
  conta: string | null;
  data: string | null;
  inicio: string | null;
  ultima_execucao: { data: string; fim: string; resultados: Record<string, string> } | null;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const paraDDMMAA = (v: string) => (v ? `${v.slice(8, 10)}${v.slice(5, 7)}${v.slice(2, 4)}` : "");
const deDDMMAA = (v?: string | null) => (v && v.length >= 6 ? `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4, 6)}` : "");
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

export default function RodarRobo({ aoTerminar }: { aoTerminar: () => void }) {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [conta, setConta] = useState("");
  const [data, setData] = useState(() => iso(new Date()));
  const [incluir, setIncluir] = useState(false);
  const [estado, setEstado] = useState<EstadoRobo | null>(null);
  const [fora, setFora] = useState(false);
  const [msg, setMsg] = useState<{ tom: "bom" | "ruim" | "info"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [acompanhando, setAcompanhando] = useState(false);

  const nome = useCallback((id: string | null) => (id === "todas" ? "Todas as filiais" : contas?.find((c) => c.id === id)?.nome ?? id ?? ""), [contas]);

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([fetch(`${ROBO}/contas`).then((r) => r.json()), fetch(`${ROBO}/status`).then((r) => r.json())]);
        const lista: Conta[] = c?.contas || [];
        setContas(lista);
        setConta(c?.padrao || lista[0]?.id || "");
        setEstado(s);
        if (s?.executando) setAcompanhando(true);
      } catch {
        setFora(true);
      }
    })();
  }, []);

  // Acompanha a captura em andamento (iniciada aqui ou na tela atual) e, ao fim, traz o resultado para o OS.
  useEffect(() => {
    if (!acompanhando) return;
    let vivo = true;
    const tick = async () => {
      try {
        const s: EstadoRobo = await fetch(`${ROBO}/status`).then((r) => r.json());
        if (!vivo) return;
        setEstado(s);
        if (s.executando) return;
        setAcompanhando(false);
        const res = Object.entries(s.ultima_execucao?.resultados ?? {});
        const falhas = res.filter(([, r]) => r !== "ok");
        if (falhas.length) {
          setMsg({ tom: "ruim", texto: falhas.map(([id, r]) => `${nome(id)}: ${r.replace(/^erro:\s*/, "")}`).join(" · ") });
          return;
        }
        // Robô terminou bem: atualiza a fila do OS com o que ele gravou.
        try {
          const r = await api<{ linhas_novas?: number; ocupado?: boolean }>("/os/captura/sincronizar", { metodo: "POST" });
          setMsg({ tom: "bom", texto: `Captura concluída (${res.map(([id]) => nome(id)).join(", ")}). ${r.linhas_novas ? `${fmtNum(r.linhas_novas)} linha(s) nova(s) na fila.` : "Nenhum evento novo para a fila."}` });
        } catch {
          setMsg({ tom: "bom", texto: "Captura concluída. Use Trazer capturas novas para atualizar a fila." });
        }
        aoTerminar();
      } catch {
        /* falha de rede momentânea: tenta no próximo ciclo */
      }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { vivo = false; clearInterval(t); };
  }, [acompanhando, nome, aoTerminar]);

  const iniciar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!data) return setMsg({ tom: "ruim", texto: "Escolha a data do evento." });
    const p = new URLSearchParams({ data: paraDDMMAA(data) });
    if (conta) p.set("conta", conta);
    if (incluir) p.set("pular_verificacao_duplicados", "true");
    if (SIMULAR) p.set("simular", "true");
    setEnviando(true);
    try {
      const r = await fetch(`${ROBO}/run-robot?${p}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ tom: "ruim", texto: d.detail || "O robô não aceitou o pedido." });
      setEstado((s) => ({ ...(s as EstadoRobo), executando: true, conta: conta || null, data: paraDDMMAA(data) }));
      setAcompanhando(true);
    } catch {
      setMsg({ tom: "ruim", texto: `O servidor do robô (${ROBO}) não respondeu.` });
    } finally {
      setEnviando(false);
    }
  };

  const rodando = !!estado?.executando;
  const bloqueado = rodando || enviando || fora || !contas?.length;
  const chip = (rot: string, v: string) => (
    <button type="button" key={rot} disabled={bloqueado} onClick={() => setData(v)}
      className={`h-[30px] rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-50 ${data === v ? "border-[#00A99D] bg-[#ECFDF9] text-[#00665F]" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F8F9FB]"}`}>{rot}</button>
  );

  return (
    <section className="mb-6 rounded-xl border border-[#EAECF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Rodar o robô</h2>
        <span className="text-[13px] text-[#667085]">Entra no Coupa, captura os eventos da data e grava para a fila.{SIMULAR && " Modo de teste: não grava no banco."}</span>
      </div>

      {fora ? (
        <Aviso tom="alerta">O servidor do robô ({ROBO}) não respondeu. Confira se ele está ligado.</Aviso>
      ) : (
        <form onSubmit={iniciar} className="flex flex-wrap items-end gap-x-6 gap-y-5">
          <label className="block w-full sm:w-[260px]">
            <span className="mb-1.5 block text-[13px] font-medium text-[#667085]">Filial (conta Coupa)</span>
            <select className={campoCls} value={conta} disabled={bloqueado} onChange={(e) => setConta(e.target.value)}>
              {!contas && <option>Carregando…</option>}
              {contas?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              {contas && contas.length > 1 && <option value="todas">Todas as filiais (planilha única)</option>}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[#667085]">Data do evento</span>
            <div className="flex items-center gap-2">
              <input type="date" className={`${campoCls} w-[160px]`} value={data} disabled={bloqueado} onChange={(e) => setData(e.target.value)} />
              {chip("Hoje", diasAtras(0))}
              {chip("Ontem", diasAtras(1))}
            </div>
          </div>

          <div className="flex h-[40px] min-w-[240px] flex-1 items-center gap-3">
            <button type="button" role="switch" aria-checked={incluir} disabled={bloqueado} onClick={() => setIncluir((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${incluir ? "bg-[#00A99D]" : "bg-[#D0D5DD]"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${incluir ? "translate-x-5" : ""}`} />
              <span className="sr-only">Incluir eventos já capturados</span>
            </button>
            <span className="leading-tight">
              <span className="block text-[14px] font-medium">Incluir eventos já capturados</span>
              <span className="block text-[12px] text-[#667085]">{incluir ? "Traz tudo da data de novo." : "Pula os que já vieram antes."}</span>
            </span>
          </div>

          <Botao type="submit" variante="primario" disabled={bloqueado} className="h-[40px] px-5">
            {rodando || enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {rodando ? "Capturando…" : "Iniciar captura"}
          </Botao>
        </form>
      )}

      {rodando && (
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-[#F8F9FB] px-4 py-3 text-[14px]" role="status">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00A99D] opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00A99D]" /></span>
          <span>Robô capturando <strong className="font-medium">{nome(estado?.conta ?? null)}</strong>{estado?.data && <>, eventos de {deDDMMAA(estado.data)}</>}. A captura continua mesmo se você sair desta tela; com ela aberta, a fila é atualizada sozinha no fim.</span>
        </div>
      )}
      {msg && <div className="mt-5"><Aviso tom={msg.tom}>{msg.texto}</Aviso></div>}
    </section>
  );
}
