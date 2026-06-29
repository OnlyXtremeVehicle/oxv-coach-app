-- Hardening : les fonctions de trigger ne doivent jamais etre appelables en RPC
-- par les clients (anon/authenticated). Les triggers s'executent independamment
-- des grants EXECUTE. On revoque donc l'acces RPC (advisor security WARN).
revoke execute on function public.tg_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.ambassador_guard_status() from public, anon, authenticated;
