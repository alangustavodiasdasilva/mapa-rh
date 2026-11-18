-- 18/11/2026 (aplicada): visitante sem login não executa admitir/desfazer (já eram barrados pelas regras; agora nem chamam).
revoke execute on function public.maparh_admitir from anon;
revoke execute on function public.maparh_desfazer_admissao from anon;
