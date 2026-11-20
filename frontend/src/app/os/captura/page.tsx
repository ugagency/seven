"use client";
 
import Link from "next/link";
import { useState } from "react";
import { Aviso, Botao, Cartao, Etiqueta, Estado, Titulo, api, baixar, fmtData, fmtDataHora, fmtNum, td, th, useAcao, useApi, useEu, type J } from "../_lib";

export default function Captura() {
  const eu = useEu();
  const dias = useApi<J>("/os/captura/dias");
  const exec = useApi<J[]>("/os/captura/execucoes");
  const acao = useAcao();
  const [msg, setMsg] = useState<string | null>(null);
  const porDia: Record<string, J[]> = {};
  (dias.dados?.dias || []).forEach((d: J) => (porDia[d.dia] ||= []).push(d));

  const sincronizar = () =>
    acao.rodar(async () => {
      const r = await api("/os/captura/sincronizar", { metodo: "POST" });
      setMsg(r.ocupado ? "Já há uma atualização em andamento." : r.linhas_novas ? `${fmtNum(r.linhas_novas)} linha(s) nova(s) trazida(s), ${fmtNum(r.produtos_novos)} produto(s) novo(s).` : "Nada novo desde a última atualização.");
      dias.recarregar(); exec.recarregar();
    });
  const planilha = (data: string, conta?: number) => acao.rodar(() => baixar("/os/captura/planilha", { params: { data, conta } }, `eventos_${data}.xlsx`));

  return (
    <>
      <Titulo sub={dias.dados?.ultima_captura ? `Última captura no OS: ${fmtDataHora(dias.dados.ultima_captura)}` : "Capturas do robô, por dia e por CNPJ."}
        acoes={eu.pode("captura.rodar") && <Botao variante="primario" disabled={acao.ocupado} onClick={sincronizar}>{acao.ocupado ? "Atualizando…" : "Trazer capturas novas"}</Botao>}>
        Captura
      </Titulo>
      <div className="mb-4 space-y-2">
        <Aviso>Nesta fase o robô continua sendo rodado pela <Link href="/" className="font-medium underline">tela atual de captura</Link>. O OS lê o que o robô gravou; o botão Trazer capturas novas atualiza a fila.</Aviso>
        {msg && <Aviso tom="bom">{msg}</Aviso>}
        {acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Planilha por data (últimos 60 dias)" className="xl:col-span-2">
          <Estado erro={dias.erro} carregando={dias.carregando && !dias.dados} vazio={dias.dados && !dias.dados.dias.length && "Sem captura registrada no OS."}>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white"><tr><th className={th}>Data</th><th className={th}>Por CNPJ</th><th className={th}></th></tr></thead>
                <tbody>
                  {Object.entries(porDia).map(([dia, linhas]) => (
                    <tr key={dia} className="border-t border-slate-100">
                      <td className={`${td} whitespace-nowrap font-medium`}>{fmtData(dia)}</td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-2">
                          {linhas.map((l) => (
                            <button key={l.conta_id} disabled={!eu.pode("captura.baixar")} onClick={() => planilha(dia, l.conta_id)} className="rounded-lg border border-slate-200 px-2 py-1 text-left text-xs hover:border-slate-400 disabled:opacity-60">
                              <span className="font-medium text-slate-900">{l.conta}</span> <span className="tabular-nums text-slate-500">{fmtNum(l.linhas)} linhas · {fmtNum(l.eventos)} eventos</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className={`${td} text-right`}>{eu.pode("captura.baixar") && linhas.length > 1 && <Botao variante="texto" onClick={() => planilha(dia)}>Unificada</Botao>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Estado>
        </Cartao>
        <Cartao titulo="Atualizações recentes">
          <Estado erro={exec.erro} carregando={exec.carregando && !exec.dados} vazio={exec.dados && !exec.dados.length && "Nenhuma ainda."}>
            <ul className="divide-y divide-slate-100 text-sm">
              {(exec.dados || []).map((e) => (
                <li key={e.id} className="py-2">
                  <div className="flex items-center justify-between gap-2"><span>{fmtDataHora(e.iniciada_em)}</span><Etiqueta tom={e.situacao === "sucesso" ? "bom" : e.situacao === "falha" ? "ruim" : "info"}>{e.situacao}</Etiqueta></div>
                  <div className="text-xs text-slate-500">{fmtNum(e.linhas_novas)} linha(s) nova(s) · {e.por || "sistema"}{e.erro && ` · ${e.erro}`}</div>
                </li>
              ))}
            </ul>
          </Estado>
        </Cartao>
      </div>
    </>
  );
}
