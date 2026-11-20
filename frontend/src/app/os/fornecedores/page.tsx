"use client";
 
import { useState } from "react";
import { Aviso, Botao, Campo, Cartao, Etiqueta, Estado, Titulo, api, campoCls, fmtNum, td, th, useAcao, useApi, useEu, type J } from "../_lib";

const VAZIO = { nome: "", cidade: "", uf: "", contato: "", telefone: "", email: "", observacao: "", marcas: "" };

export default function Fornecedores() {
  const eu = useEu();
  const pode = eu.pode("fornecedor.vincular");
  const [f, setF] = useState({ busca: "", marca: "", inativos: false });
  const [busca, setBusca] = useState("");
  const { dados, erro, carregando, recarregar } = useApi<J>("/os/fornecedores", f);
  const [form, setForm] = useState<J | null>(null);
  const [juntar, setJuntar] = useState<number | null>(null);
  const acao = useAcao();
  const detalhe = useApi<J>(form?.id ? `/os/fornecedores/${form.id}` : null);

  const salvar = () =>
    acao.rodar(async () => {
      const corpo = { ...form, uf: form!.uf || null, marcas: String(form!.marcas || "").split(",").map((m) => m.trim()).filter(Boolean) };
      delete (corpo as J).id;
      if (form!.id) await api(`/os/fornecedores/${form!.id}`, { metodo: "PATCH", corpo });
      else await api("/os/fornecedores", { metodo: "POST", corpo });
      setForm(null); recarregar();
    });

  return (
    <>
      <Titulo sub="Cadastro único. Fabricante é marca; fornecedor é quem vende." acoes={pode && <Botao variante="primario" onClick={() => { acao.limpar(); setForm({ ...VAZIO }); }}>Novo fornecedor</Botao>}>Fornecedores</Titulo>
      <form onSubmit={(e) => { e.preventDefault(); setF({ ...f, busca }); }} className="mb-3 flex flex-wrap gap-2">
        <input aria-label="Buscar" className={`${campoCls} max-w-sm`} placeholder="Nome, variação do nome ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Marca" className={`${campoCls} max-w-xs`} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })}>
          <option value="">Todas as marcas</option>
          {(dados?.marcas || []).map((m: string) => <option key={m}>{m}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.inativos} onChange={(e) => setF({ ...f, inativos: e.target.checked })} /> Mostrar inativos</label>
        <Botao type="submit">Buscar</Botao>
      </form>
      {acao.erro && !form && <div className="mb-3"><Aviso tom="ruim">{acao.erro}</Aviso></div>}

      {form && (
        <Cartao titulo={form.id ? `Editar ${form.nome}` : "Novo fornecedor"} className="mb-4">
          <form onSubmit={(e) => { e.preventDefault(); salvar(); }} className="grid gap-2 md:grid-cols-4">
            <div className="md:col-span-2"><Campo rotulo="Nome"><input required autoFocus className={campoCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo></div>
            <Campo rotulo="Cidade"><input className={campoCls} value={form.cidade || ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Campo>
            <Campo rotulo="UF"><input maxLength={2} className={campoCls} value={form.uf || ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></Campo>
            <Campo rotulo="Contato"><input className={campoCls} value={form.contato || ""} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></Campo>
            <Campo rotulo="Telefone"><input className={campoCls} value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
            <div className="md:col-span-2"><Campo rotulo="E-mail"><input type="email" className={campoCls} value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo></div>
            <div className="md:col-span-2"><Campo rotulo="Marcas que atende" dica="Separe por vírgula. Vira sugestão nos produtos dessas marcas."><input className={campoCls} value={form.marcas || ""} onChange={(e) => setForm({ ...form, marcas: e.target.value })} placeholder="SKF, NSK" /></Campo></div>
            <div className="md:col-span-2"><Campo rotulo="Observação"><input className={campoCls} value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></Campo></div>
            {form.id && <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>}
            {acao.erro && <div className="md:col-span-4"><Aviso tom="ruim">{acao.erro}</Aviso></div>}
            <div className="flex gap-2 md:col-span-4"><Botao type="submit" variante="primario" disabled={acao.ocupado}>Salvar</Botao><Botao type="button" onClick={() => setForm(null)}>Cancelar</Botao></div>
          </form>
          {form.id && detalhe.dados && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
              {detalhe.dados.outros_nomes.length > 0 && <p className="text-slate-600">Outras escritas do nome: {detalhe.dados.outros_nomes.join(", ")}</p>}
              <p className="mt-1 font-semibold">Produtos vinculados ({detalhe.dados.produtos.length})</p>
              <ul className="mt-1 max-h-48 overflow-auto text-slate-700">{detalhe.dados.produtos.map((p: J) => <li key={p.id}>{p.nome} <span className="text-xs text-slate-500">{[p.fabricante, p.referencia].filter(Boolean).join(" · ")}</span></li>)}</ul>
            </div>
          )}
        </Cartao>
      )}

      {juntar !== null && <div className="mb-3"><Aviso tom="alerta">Escolha na lista o cadastro que deve <strong>ficar</strong>. O outro some e o nome dele vira uma variação. <button className="font-medium underline" onClick={() => setJuntar(null)}>Cancelar</button></Aviso></div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.fornecedores.length && "Nenhum fornecedor cadastrado com esse filtro. A base da Seven ainda não foi importada; cadastre aqui ou pela ficha do item."}>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Fornecedor</th><th className={th}>Contato</th><th className={th}>Marcas</th><th className={th}>Produtos</th><th className={th}>Taxa de vitória</th><th className={th}></th></tr></thead>
            <tbody>
              {dados?.fornecedores.map((x: J) => (
                <tr key={x.id} className="border-b border-slate-100 last:border-0">
                  <td className={td}><span className="font-medium">{x.nome}</span>{!x.ativo && <> <Etiqueta>inativo</Etiqueta></>}<div className="text-xs text-slate-500">{[x.cidade, x.uf].filter(Boolean).join("/")}</div></td>
                  <td className={td}><div>{x.contato}</div><div className="text-xs text-slate-500">{[x.telefone, x.email].filter(Boolean).join(" · ")}</div></td>
                  <td className={td}><div className="flex flex-wrap gap-1">{x.marcas.map((m: string) => <Etiqueta key={m}>{m}</Etiqueta>)}</div></td>
                  <td className={`${td} tabular-nums`}>{fmtNum(x.produtos)}</td>
                  <td className={`${td} tabular-nums`}>{x.com_resultado ? `${Math.round((100 * x.ganhas) / x.com_resultado)}% (${x.ganhas} de ${x.com_resultado})` : <span className="text-slate-400">sem resultado</span>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {pode && (juntar === null ? (
                      <>
                        <Botao variante="texto" onClick={() => { acao.limpar(); setForm({ ...x, marcas: x.marcas.join(", ") }); }}>Editar</Botao>
                        <Botao variante="texto" onClick={() => setJuntar(x.id)}>Juntar com outro</Botao>
                      </>
                    ) : juntar === x.id ? <Etiqueta tom="alerta">será juntado</Etiqueta> : (
                      <Botao disabled={acao.ocupado} onClick={() => acao.rodar(async () => { await api("/os/fornecedores/juntar", { metodo: "POST", corpo: { manter_id: x.id, juntar_id: juntar } }); setJuntar(null); recarregar(); })}>Manter este</Botao>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Estado>
      </div>
    </>
  );
}
