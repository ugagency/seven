"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import GerenciadorCredenciais from "../../GerenciadorCredenciais";
import { Aviso, Botao, Campo, Cartao, Etiqueta, Estado, PERFIS, Titulo, api, baixar, campoCls, enviarArquivo, supabase, td, th, useAcao, useApi, useEu, type J } from "../_lib";

const ROBO = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function Usuarios() {
  const eu = useEu();
  const us = useApi<J[]>("/os/admin/usuarios");
  const contas = useApi<J[]>("/os/admin/contas");
  const acao = useAcao();
  const vazio = { email: "", nome: "", perfil: "cotacao", contas: [] as number[], ativo: true, convite: "link" };
  const [novo, setNovo] = useState<J>(vazio);
  const [criado, setCriado] = useState<J | null>(null);
  const [copiado, setCopiado] = useState(false);
  const alterar = (uid: string, corpo: J) => acao.rodar(async () => { await api(`/os/admin/usuarios/${uid}`, { metodo: "PATCH", corpo }); us.recarregar(); });
  const troca = (lista: number[], id: number) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const ativas = (contas.dados || []).filter((c) => c.ativa);
  return (
    <div className="space-y-4">
      {acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}
      <Cartao titulo="Usuários do Seven OS">
        <Estado erro={us.erro} carregando={us.carregando && !us.dados}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr><th className={th}>Pessoa</th><th className={th}>Perfil</th><th className={th}>CNPJs liberados</th><th className={th}>Situação</th></tr></thead>
              <tbody>
                {(us.dados || []).map((u) => (
                  <tr key={u.user_id} className="border-t border-[#F0F2F5]">
                    <td className={td}><div className="font-medium">{u.nome || "(sem nome)"}</div><div className="text-[12px] text-[#667085]">{u.email}</div></td>
                    <td className={td}>
                      <select aria-label={`Perfil de ${u.email}`} className={campoCls} disabled={u.user_id === eu.id || acao.ocupado} value={u.perfil} onChange={(e) => alterar(u.user_id, { perfil: e.target.value })}>
                        {Object.entries(PERFIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-3">
                        {ativas.map((c) => (
                          <label key={c.id} className="flex items-center gap-1.5 text-[14px]"><input type="checkbox" disabled={acao.ocupado} checked={u.contas.includes(c.id)} onChange={() => alterar(u.user_id, { contas: troca(u.contas, c.id) })} /> {c.nome}</label>
                        ))}
                      </div>
                    </td>
                    <td className={td}>
                      {u.user_id === eu.id ? <Etiqueta tom="info">você</Etiqueta> : <Botao variante={u.ativo ? "secundario" : "primario"} disabled={acao.ocupado} onClick={() => alterar(u.user_id, { ativo: !u.ativo })}>{u.ativo ? "Desativar" : "Ativar"}</Botao>}
                      {!u.ativo && <> <Etiqueta>inativo</Etiqueta></>}
                      {u.user_id !== eu.id && (["link", "email"] as const).map((modo) => <Botao key={modo} variante="texto" disabled={acao.ocupado} onClick={() => { setCopiado(false); acao.rodar(async () => { const r = await api<J>(`/os/admin/usuarios/${u.user_id}/link-acesso`, { metodo: "POST", corpo: { convite: modo } }); setCriado({ ...r, reenvio: true }); }); }}>{modo === "link" ? "Novo link de acesso" : "Enviar acesso por e-mail"}</Botao>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Estado>
      </Cartao>
      <Cartao titulo="Dar acesso a uma pessoa">
        <p className="mb-4 text-[14px] text-[#667085]">Se a pessoa ainda não tem login, o sistema cria o convite. Ela entra pelo link, define a própria senha e já cai no Seven OS com o perfil escolhido.</p>
        <form onSubmit={(e) => { e.preventDefault(); setCriado(null); setCopiado(false); acao.rodar(async () => { const r = await api<J>("/os/admin/usuarios", { metodo: "POST", corpo: novo }); setCriado(r); setNovo(vazio); us.recarregar(); }); }} className="grid gap-4 md:grid-cols-4">
          <Campo rotulo="E-mail"><input required type="email" className={campoCls} value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><input className={campoCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
          <Campo rotulo="Perfil"><select className={campoCls} value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value })}>{Object.entries(PERFIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <div><span className="mb-1.5 block text-[13px] font-medium text-[#667085]">CNPJs</span><div className="flex flex-wrap gap-3 py-2">{ativas.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-[14px]"><input type="checkbox" checked={novo.contas.includes(c.id)} onChange={() => setNovo({ ...novo, contas: troca(novo.contas, c.id) })} /> {c.nome}</label>)}</div></div>
          <fieldset className="md:col-span-3">
            <legend className="mb-1.5 text-[13px] font-medium text-[#667085]">Se ainda não tiver login, como enviar o convite</legend>
            <div className="flex flex-wrap gap-2">
              {[["link", "Gerar link para eu enviar", "você manda por WhatsApp ou e-mail"], ["email", "Supabase envia por e-mail", "depende do e-mail do Supabase configurado"]].map(([v, t, sub]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[14px] ${novo.convite === v ? "border-[#00A99D] bg-[#ECFDF9]" : "border-[#D0D5DD] bg-white hover:bg-[#F8F9FB]"}`}>
                  <input type="radio" name="convite" className="mt-1" checked={novo.convite === v} onChange={() => setNovo({ ...novo, convite: v })} />
                  <span><span className="block font-medium">{t}</span><span className="block text-[12px] text-[#667085]">{sub}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-end"><Botao type="submit" variante="primario" disabled={acao.ocupado}>{acao.ocupado ? "Enviando…" : "Dar acesso"}</Botao></div>
        </form>
        {criado && (
          <div className="mt-5">
            {criado.link_convite ? (
              <Aviso tom="bom">
                <p className="font-medium">{criado.reenvio ? `Link novo para ${criado.email} definir a senha:` : `Acesso criado para ${criado.email}. Envie este link para a pessoa definir a senha:`}</p>
                <div className="mt-2 flex gap-2">
                  <input readOnly aria-label="Link do convite" className={`${campoCls} mono text-[12px]`} value={criado.link_convite} onFocus={(e) => e.target.select()} />
                  <Botao onClick={async () => { try { await navigator.clipboard.writeText(criado.link_convite); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? "Copiado" : "Copiar"}</Botao>
                </div>
                <p className="mt-2 text-[12px]">O link vale por tempo limitado e só funciona uma vez. Ele não fica guardado no sistema: copie agora. Se expirar, use &ldquo;Novo link de acesso&rdquo; na lista acima. Serve também para quem esqueceu a senha.</p>
              </Aviso>
            ) : criado.convite === "email" ? (
              <Aviso tom="bom">{criado.reenvio ? "E-mail enviado" : "Acesso criado. Convite enviado"} para {criado.email}, como Seven OS. Se não chegar em alguns minutos, olhe o spam ou gere um link.</Aviso>
            ) : (
              <Aviso tom="bom">Acesso liberado para {criado.email}. A pessoa já tinha login: é só entrar com a senha dela.</Aviso>
            )}
          </div>
        )}
      </Cartao>
    </div>
  );
}

function Contas() {
  const contas = useApi<J[]>("/os/admin/contas");
  const acao = useAcao();
  const [edit, setEdit] = useState<J | null>(null);
  const [cred, setCred] = useState(false);
  const salvar = () =>
    acao.rodar(async () => {
      const corpo = { nome: edit!.nome, cnpj: edit!.cnpj || null, filial: edit!.filial || null, ativa: edit!.ativa };
      if (edit!.id) await api(`/os/admin/contas/${edit!.id}`, { metodo: "PATCH", corpo });
      else await api("/os/admin/contas", { metodo: "POST", corpo });
      setEdit(null); contas.recarregar();
    });
  return (
    <div className="space-y-4">
      <Cartao titulo="Contas e portais" acoes={<><Botao onClick={() => setCred(true)}>Credenciais do Coupa</Botao><Botao variante="primario" onClick={() => { acao.limpar(); setEdit({ nome: "", cnpj: "", filial: "", ativa: true }); }}>Nova conta</Botao></>}>
        <Estado erro={contas.erro} carregando={contas.carregando && !contas.dados}>
          <table className="w-full">
            <thead><tr><th className={th}>Conta</th><th className={th}>Portal</th><th className={th}>CNPJ</th><th className={th}>Filial</th><th className={th}>Ligada ao robô</th><th className={th}></th></tr></thead>
            <tbody>
              {(contas.dados || []).map((c) => (
                <tr key={c.id} className="border-t border-[#F0F2F5]">
                  <td className={td}><span className="font-medium">{c.nome}</span>{!c.ativa && <> <Etiqueta>inativa</Etiqueta></>}</td>
                  <td className={td}>{c.portal}</td><td className={`${td} tabular-nums`}>{c.cnpj || <span className="text-[#98A2B3]">a preencher</span>}</td><td className={td}>{c.filial}</td>
                  <td className={td}>{c.conta_robo ? <Etiqueta tom="bom">{c.conta_robo}</Etiqueta> : <Etiqueta tom="alerta">ainda não captura</Etiqueta>}</td>
                  <td className={`${td} text-right`}><Botao variante="texto" onClick={() => { acao.limpar(); setEdit({ ...c }); }}>Editar</Botao></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Estado>
        <p className="mt-3 text-[12px] text-[#667085]">Conta nova criada aqui só passa a capturar depois que a SSYS ligar o robô a ela. As senhas do Coupa ficam cifradas no banco e nunca são mostradas.</p>
      </Cartao>
      {edit && (
        <Cartao titulo={edit.id ? `Editar ${edit.nome}` : "Nova conta"}>
          <form onSubmit={(e) => { e.preventDefault(); salvar(); }} className="grid gap-2 md:grid-cols-4">
            <Campo rotulo="Nome"><input required autoFocus className={campoCls} value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Campo>
            <Campo rotulo="CNPJ"><input className={campoCls} value={edit.cnpj || ""} onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></Campo>
            <Campo rotulo="Filial"><input className={campoCls} value={edit.filial || ""} onChange={(e) => setEdit({ ...edit, filial: e.target.value })} /></Campo>
            <label className="flex items-end gap-2 pb-2 text-[14px]"><input type="checkbox" checked={edit.ativa} onChange={(e) => setEdit({ ...edit, ativa: e.target.checked })} /> Ativa</label>
            {acao.erro && <div className="md:col-span-4"><Aviso tom="ruim">{acao.erro}</Aviso></div>}
            <div className="flex gap-2 md:col-span-4"><Botao type="submit" variante="primario" disabled={acao.ocupado}>Salvar</Botao><Botao type="button" onClick={() => setEdit(null)}>Cancelar</Botao></div>
          </form>
        </Cartao>
      )}
      {cred && <GerenciadorCredenciais backendUrl={ROBO} obterToken={async () => (await supabase().auth.getSession()).data.session?.access_token ?? null} onFechar={() => setCred(false)} onSalvo={() => {}} />}
    </div>
  );
}

function Parametros() {
  const { dados, erro, carregando, recarregar } = useApi<J>("/os/admin/parametros");
  const acao = useAcao();
  const [ok, setOk] = useState("");
  const [v, setV] = useState<J | null>(null);
  const atual = (chave: string, padrao: any) => dados?.valores[chave]?.valor ?? padrao;
  const estado = v || (dados ? {
    horarios: (atual("robo.agenda", { horarios: [] }).horarios as string[]).join(", "),
    pct: String(atual("alertas.divergencia_pct", 30)),
    motivos: (atual("listas.motivos_declinio", []) as string[]).join("\n"),
    categorias: (atual("listas.categorias", []) as string[]).join("\n"),
  } : null);
  const gravar = (chave: string, valor: any) => acao.rodar(async () => { await api(`/os/admin/parametros/${chave}`, { metodo: "PUT", corpo: { valor } }); setOk(`Salvo: ${chave}`); setV(null); recarregar(); });
  const linhas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
  if (!estado) return <Estado erro={erro} carregando={carregando} />;
  const set = (m: J) => { setOk(""); setV({ ...estado, ...m }); };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="xl:col-span-2 space-y-2">{acao.erro && <Aviso tom="ruim">{acao.erro}</Aviso>}{ok && <Aviso tom="bom">{ok}</Aviso>}</div>
      <Cartao titulo="Agenda do robô">
        <Campo rotulo="Horários das rodadas (HH:MM, separados por vírgula; até 6)" dica="Vazio deixa a agenda desligada. A agenda só passa a valer depois do corte, quando o OS acionar o robô."><input className={campoCls} value={estado.horarios} onChange={(e) => set({ horarios: e.target.value })} placeholder="07:00, 13:00" /></Campo>
        <div className="mt-2"><Botao disabled={acao.ocupado} onClick={() => gravar("robo.agenda", { horarios: estado.horarios.split(",").map((x: string) => x.trim()).filter(Boolean) })}>Salvar agenda</Botao></div>
      </Cartao>
      <Cartao titulo="Alerta de preço divergente">
        <Campo rotulo="Diferença máxima em relação ao último preço de compra (%)" dica="Acima disso a cotação pede correção ou justificativa. Padrão provisório: 30%."><input inputMode="decimal" className={campoCls} value={estado.pct} onChange={(e) => set({ pct: e.target.value })} /></Campo>
        <div className="mt-2"><Botao disabled={acao.ocupado} onClick={() => gravar("alertas.divergencia_pct", Number(estado.pct.replace(",", ".")))}>Salvar limite</Botao></div>
      </Cartao>
      <Cartao titulo="Motivos de declínio">
        <Campo rotulo="Um por linha"><textarea rows={6} className={campoCls} value={estado.motivos} onChange={(e) => set({ motivos: e.target.value })} /></Campo>
        <div className="mt-2"><Botao disabled={acao.ocupado || !linhas(estado.motivos).length} onClick={() => gravar("listas.motivos_declinio", linhas(estado.motivos))}>Salvar motivos</Botao></div>
      </Cartao>
      <Cartao titulo="Categorias de item">
        <Campo rotulo="Uma por linha"><textarea rows={6} className={campoCls} value={estado.categorias} onChange={(e) => set({ categorias: e.target.value })} /></Campo>
        <div className="mt-2"><Botao disabled={acao.ocupado || !linhas(estado.categorias).length} onClick={() => gravar("listas.categorias", linhas(estado.categorias))}>Salvar categorias</Botao></div>
      </Cartao>
    </div>
  );
}

function Exportar() {
  const eu = useEu();
  const acao = useAcao();
  return (
    <Cartao titulo="Exportação completa da base">
      <p className="text-[14px] text-[#344054]">Gera um arquivo .zip com um CSV por tabela do Seven OS, incluindo preços e margens. Cada exportação fica registrada na auditoria.</p>
      {eu.perfil === "administrador" ? (
        <div className="mt-3"><Botao variante="primario" disabled={acao.ocupado} onClick={() => acao.rodar(() => baixar("/os/admin/exportar-base", { metodo: "POST" }, "seven_os_base.zip"))}>{acao.ocupado ? "Gerando…" : "Exportar a base completa"}</Botao></div>
      ) : <div className="mt-3"><Aviso tom="alerta">Só o perfil Administrador exporta a base completa.</Aviso></div>}
      {acao.erro && <div className="mt-3"><Aviso tom="ruim">{acao.erro}</Aviso></div>}
    </Cartao>
  );
}

type ResultadoCarga = { arquivo: string; linhas: number; substituidas: number; com_produto: number; sem_produto: number; produtos_novos: number;
  com_preco_compra: number; declinadas: number; ganhas: number; fornecedores_novos: number; vinculos_novos: number; periodo: [string, string] | null };

function ImportarBase() {
  const eu = useEu();
  const acao = useAcao();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [res, setRes] = useState<ResultadoCarga | null>(null);
  const br = (d: string) => d.split("-").reverse().join("/");
  const n = (x: number) => x.toLocaleString("pt-BR");
  return (
    <Cartao titulo="Base histórica da Seven">
      <p className="text-[14px] text-[#344054]">
        Carrega a planilha BASE.xlsx (aba BASE e, se houver, a aba COD E PV com os pedidos ganhos). Cada linha vira histórico do produto, com
        fornecedor, preços e situação. Fornecedores que deram preço entram no cadastro e ficam ligados à peça. Carregar a mesma planilha de novo
        atualiza as linhas, sem duplicar. Os preços ficam visíveis só para os perfis que podem ver preço.
      </p>
      {!["administrador", "suporte"].includes(eu.perfil) ? <div className="mt-3"><Aviso tom="alerta">Só o Administrador ou o Suporte SSYS carrega a base da Seven.</Aviso></div> : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.xlsm" disabled={acao.ocupado} onChange={(e) => { setArquivo(e.target.files?.[0] || null); setRes(null); }}
            className="text-[14px] file:mr-3 file:rounded-md file:border file:border-[#D0D5DD] file:bg-white file:px-3 file:py-1.5 file:text-[14px] file:font-medium hover:file:border-[#0B1A2A]" />
          <Botao variante="primario" disabled={!arquivo || acao.ocupado}
            onClick={() => acao.rodar(async () => { setRes(await enviarArquivo<ResultadoCarga>("/os/admin/importar-base", arquivo!)); })}>
            {acao.ocupado ? "Carregando… (pode levar até 1 minuto)" : "Carregar planilha"}
          </Botao>
        </div>
      )}
      {acao.erro && <div className="mt-3"><Aviso tom="ruim">{acao.erro}</Aviso></div>}
      {res && (
        <div className="mt-4">
          <Aviso tom="bom">{res.arquivo}: {n(res.linhas)} linhas carregadas{res.periodo ? `, de ${br(res.periodo[0])} a ${br(res.periodo[1])}` : ""}.{res.substituidas ? ` ${n(res.substituidas)} já existiam e foram atualizadas.` : ""}</Aviso>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-3">
            {([["Ligadas a um produto", res.com_produto], ["Sem produto (descrição insuficiente)", res.sem_produto], ["Produtos novos criados", res.produtos_novos],
               ["Com preço de compra", res.com_preco_compra], ["Declinadas", res.declinadas], ["Ganhas (com pedido)", res.ganhas],
               ["Fornecedores novos", res.fornecedores_novos], ["Vínculos peça e fornecedor", res.vinculos_novos]] as [string, number][]).map(([t, v]) => (
              <div key={t}><dt className="text-[#667085]">{t}</dt><dd className="mono text-[15px] font-medium text-[#0B1A2A]">{n(v)}</dd></div>
            ))}
          </dl>
        </div>
      )}
    </Cartao>
  );
}

const ABAS_ADMIN: [string, string, () => React.ReactElement][] = [["usuarios", "Usuários", Usuarios], ["contas", "Contas e credenciais", Contas], ["parametros", "Parâmetros", Parametros], ["importar", "Base da Seven", ImportarBase], ["exportar", "Exportar base", Exportar]];

export default function Admin() {
  const eu = useEu();
  const [aba, setAba] = useState("usuarios");
  if (!eu.pode("admin.usuarios")) return <Aviso tom="alerta">Seu perfil não tem acesso à administração.</Aviso>;
  const Atual = ABAS_ADMIN.find((a) => a[0] === aba)![2];
  return (
    <>
      <Titulo sub="Toda mudança aqui fica registrada na auditoria.">Administração</Titulo>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-[#EAECF0]">
        {ABAS_ADMIN.map(([k, r]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-medium ${aba === k ? "border-[#0B1A2A] text-[#0B1A2A]" : "border-transparent text-[#667085] hover:text-[#0B1A2A]"}`}>{r}</button>)}
      </div>
      <Atual />
    </>
  );
}
