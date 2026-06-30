-- Lecture pilote SCOPÉE de son boîtier affecté (panneau équipement NG). Le pilote
-- ne voit JAMAIS le parc — uniquement le(s) boîtier(s) qui lui sont affectés via
-- device_assignments. Débloque device_health_logs_pilot_select (son sous-exists
-- sur device_assignments devient lisible) et le panneau équipement.

create policy device_assignments_pilot_select on public.device_assignments
for select to authenticated
using (pilot_id = auth.uid());

create policy devices_pilot_select on public.devices
for select to authenticated
using (
  exists (
    select 1 from public.device_assignments da
    where da.device_id = devices.id and da.pilot_id = auth.uid()
  )
);

-- Le pilote journalise l'état de SON boîtier au connect BLE (source 'app').
create policy device_health_logs_pilot_insert on public.device_health_logs
for insert to authenticated
with check (
  exists (
    select 1 from public.device_assignments da
    where da.device_id = device_health_logs.device_id and da.pilot_id = auth.uid()
  )
);
