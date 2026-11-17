# Testes

Rodar antes de publicar. Nenhum deles precisa de instalação além do Node.

## 1. Sintaxe de todos os arquivos

```bash
for f in js/*.js js/pages/*.js; do node --check "$f" || echo "ERRO em $f"; done
```

## 2. Sincronização com o banco central

```bash
node testes/nuvem.test.js
```

Usa um banco de mentira em memória (não toca no Supabase). Cobre: primeiro envio, dois usuários editando,
exclusão, queda de internet e reabertura, visualizador, junção de dados de outro navegador.
Tem que terminar com `TUDO OK`.

## 3. Regras de acesso no banco (por perfil)

O arquivo `regras-de-acesso.sql` é executado no SQL Editor do Supabase (ou pela ferramenta de SQL).
Ele cria usuários e dados de teste, entra como administrador, gestor restrito, visualizador e conta sem acesso,
tenta ler e gravar, e **desfaz tudo no final** (termina de propósito com um erro que carrega o resultado).

Resultado esperado: em cada item, o valor obtido é igual ao que está entre parênteses.

Rodar sempre que mudar uma política de acesso (RLS) ou as tabelas `maparh_*`.
