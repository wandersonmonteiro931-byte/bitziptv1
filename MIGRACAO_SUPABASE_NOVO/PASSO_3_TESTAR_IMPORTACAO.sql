-- BITZIPTV1 / WMCPLAYER - PASSO 3 - TESTAR IMPORTAÇÃO
SELECT 'profiles' AS tabela, count(*) AS total FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'iptv_payments', count(*) FROM public.iptv_payments
UNION ALL SELECT 'tv_programs', count(*) FROM public.tv_programs;

SELECT p.username, p.name, r.role, p.iptv_password
FROM public.profiles p
LEFT JOIN public.user_roles r ON r.user_id = p.id
ORDER BY r.role, p.created_at
LIMIT 20;
