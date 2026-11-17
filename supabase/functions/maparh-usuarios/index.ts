// Mapa RH — gestão de usuários (roda no Supabase com a chave de serviço; o site só tem a chave pública).
// Ações: status | primeiro | criar | atualizar | excluir | incluirProjeto
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });
const PERFIS = ["admin", "gestor", "leitor"];
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// login simples ("maria") vira um e-mail interno; quem preferir pode usar o e-mail de verdade como login
const emailDe = (login: string) => (login.includes("@") ? login : `${login}@maparh.local`);
const limparLogin = (l: unknown) => String(l ?? "").trim().toLowerCase();

function validar(d: any, { senhaObrigatoria }: { senhaObrigatoria: boolean }) {
  const login = limparLogin(d.login), nome = String(d.nome ?? "").trim(), senha = String(d.senha ?? "");
  if (!nome) throw new Error("Informe o nome.");
  if (!/^[a-z0-9._-]{3,40}$/.test(login) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(login)) throw new Error("Login inválido: use de 3 a 40 letras/números (sem espaço) ou um e-mail.");
  if (!PERFIS.includes(d.perfil)) throw new Error("Perfil inválido.");
  if ((senhaObrigatoria || senha) && senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  const projetos = d.perfil === "admin" || d.projetos == null ? null : (Array.isArray(d.projetos) ? d.projetos.map(String) : null);
  return { login, nome, senha, perfil: d.perfil as string, projetos, ativo: d.ativo !== false };
}
async function criarUsuario(v: ReturnType<typeof validar>) {
  const { data, error } = await sb.auth.admin.createUser({ email: emailDe(v.login), password: v.senha, email_confirm: true, user_metadata: { nome: v.nome, login: v.login } });
  if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "Já existe um usuário com este login." : error.message);
  const { error: e2 } = await sb.from("maparh_membros").insert({ user_id: data.user.id, login: v.login, nome: v.nome, perfil: v.perfil, projetos: v.projetos, ativo: v.ativo });
  if (e2) { await sb.auth.admin.deleteUser(data.user.id); throw new Error(e2.code === "23505" ? "Já existe um usuário com este login." : e2.message); }
  return data.user.id;
}
async function adminsAtivos(excetoId = "") {
  const { data } = await sb.from("maparh_membros").select("user_id").eq("perfil", "admin").eq("ativo", true);
  return (data ?? []).filter((m) => m.user_id !== excetoId).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const d = await req.json();
    const { count } = await sb.from("maparh_membros").select("user_id", { count: "exact", head: true });

    if (d.acao === "status") return json({ temAdmin: (count ?? 0) > 0 });

    // primeiro acesso: só funciona enquanto não existe nenhum usuário
    if (d.acao === "primeiro") {
      if ((count ?? 0) > 0) throw new Error("O administrador já foi criado. Entre com o seu usuário.");
      const v = validar({ ...d, perfil: "admin", projetos: null, ativo: true }, { senhaObrigatoria: true });
      await criarUsuario(v);
      return json({ ok: true });
    }

    // daqui para baixo: precisa estar logado e ser membro ativo
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: quem } = await sb.auth.getUser(token);
    if (!quem?.user) throw new Error("Sessão expirada. Entre novamente.");
    const { data: eu } = await sb.from("maparh_membros").select("*").eq("user_id", quem.user.id).maybeSingle();
    if (!eu || !eu.ativo) throw new Error("Seu usuário não tem acesso ao Mapa RH.");

    if (d.acao === "incluirProjeto") { // gestor que cria um projeto passa a enxergá-lo
      if (eu.projetos && d.projetoId && !eu.projetos.includes(String(d.projetoId))) {
        await sb.from("maparh_membros").update({ projetos: [...eu.projetos, String(d.projetoId)] }).eq("user_id", eu.user_id);
      }
      return json({ ok: true });
    }

    if (eu.perfil !== "admin") throw new Error("Somente administradores podem gerenciar usuários.");

    if (d.acao === "criar") {
      const id = await criarUsuario(validar(d, { senhaObrigatoria: true }));
      return json({ ok: true, id });
    }
    if (d.acao === "atualizar") {
      const { data: alvo } = await sb.from("maparh_membros").select("*").eq("user_id", d.id).maybeSingle();
      if (!alvo) throw new Error("Usuário não encontrado.");
      const v = validar({ ...d, login: d.login || alvo.login }, { senhaObrigatoria: false });
      if (alvo.perfil === "admin" && alvo.ativo && (v.perfil !== "admin" || !v.ativo) && (await adminsAtivos(alvo.user_id)) === 0) throw new Error("É preciso manter ao menos um administrador ativo.");
      const auth: Record<string, unknown> = { user_metadata: { nome: v.nome, login: v.login } };
      if (v.login !== alvo.login) { auth.email = emailDe(v.login); auth.email_confirm = true; }
      if (v.senha) auth.password = v.senha;
      const { error } = await sb.auth.admin.updateUserById(alvo.user_id, auth);
      if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "Já existe um usuário com este login." : error.message);
      const { error: e2 } = await sb.from("maparh_membros").update({ login: v.login, nome: v.nome, perfil: v.perfil, projetos: v.projetos, ativo: v.ativo }).eq("user_id", alvo.user_id);
      if (e2) throw new Error(e2.message);
      return json({ ok: true });
    }
    if (d.acao === "excluir") {
      if (d.id === eu.user_id) throw new Error("Você não pode excluir o próprio usuário.");
      const { data: alvo } = await sb.from("maparh_membros").select("*").eq("user_id", d.id).maybeSingle();
      if (!alvo) throw new Error("Usuário não encontrado.");
      if (alvo.perfil === "admin" && alvo.ativo && (await adminsAtivos(alvo.user_id)) === 0) throw new Error("É preciso manter ao menos um administrador ativo.");
      const { error } = await sb.auth.admin.deleteUser(alvo.user_id); // o membro some junto (on delete cascade)
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }
    throw new Error("Ação desconhecida.");
  } catch (e) {
    return json({ erro: (e as Error).message || String(e) });
  }
});
