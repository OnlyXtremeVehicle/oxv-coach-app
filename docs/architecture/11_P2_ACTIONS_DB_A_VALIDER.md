# P2 — Actions base de données à valider (fondateur)

> **STATUT : ✅ VALIDÉ + APPLIQUÉ (2026-07-12).** Gabin a validé les deux actions
> (« je valide tous et conformité »). Les deux migrations sont appliquées en prod
> et mirrorées dans `supabase/migrations/` :
>
> - `20260712090000_harden_next_coach_invoice_number_authz.sql`
> - `20260712090500_coach_invoices_buyer_name_snapshot.sql`
>
> Types régénérés, code câblé (snapshot destinataire). Le flag `coach_billing`
> reste **OFF** jusqu'au SIRET d'OXV (#82). Historique de la décision ci-dessous.

Contexte : vérif adversariale du 2026-07-11 (4 lentilles : doctrine, canon
couleur, RGPD, correction). Les correctifs de **code** sont déjà appliqués et
committés. Restent 2 actions **DB** qui relèvent de ta décision.

---

## 1 — ✅ APPLIQUÉ · SÉCURITÉ (majeur) : durcir `next_coach_invoice_number`

**Problème.** La fonction de numérotation est `SECURITY DEFINER` et utilise son
paramètre `p_coach` tel quel. Un utilisateur authentifié peut donc appeler
`next_coach_invoice_number(<id d'un AUTRE coach>, année)` et **faire avancer /
lire le compteur de facturation d'un autre coach** → trous de numérotation chez
la victime, fuite de séquence. La RLS de la table ne protège pas (DEFINER la
contourne). Non exploitable aujourd'hui (flag OFF), mais **bloqueur avant
activation**.

**Correctif (transparent pour l'app, qui passe déjà son propre id) :**

```sql
-- Force la numérotation sur l'appelant authentifié (p_coach ignoré) + révoque anon.
create or replace function public.next_coach_invoice_number(p_coach uuid, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
  alloc int;
  v_coach uuid := auth.uid();
begin
  if v_coach is null then
    raise exception 'not_authenticated';
  end if;
  -- p_coach est ignoré au profit de l'appelant authentifié (garde-fou d'autorisation).
  insert into coach_invoice_counters (coach_id, year, next_number)
    values (v_coach, p_year, 1)
    on conflict (coach_id) do nothing;
  select * into cur from coach_invoice_counters where coach_id = v_coach for update;
  if cur.year <> p_year then
    alloc := 1;
  else
    alloc := cur.next_number;
  end if;
  update coach_invoice_counters set year = p_year, next_number = alloc + 1 where coach_id = v_coach;
  return alloc;
end;
$$;

revoke execute on function public.next_coach_invoice_number(uuid, int) from public;
revoke execute on function public.next_coach_invoice_number(uuid, int) from anon;
grant execute on function public.next_coach_invoice_number(uuid, int) to authenticated;
```

Additif, réversible, sans impact fonctionnel (l'app appelle avec `p_coach =
auth.uid()` déjà). Une fois appliqué via `apply_migration`, mirrorer le fichier
dans `supabase/migrations/`.

---

## 2 — ✅ APPLIQUÉ · Conformité : figer le nom du destinataire à l'émission

> Option **(a) retenue** par le fondateur (« conformité »). Colonne `buyer_name`
> ajoutée + écrite par `issueInvoice` + lue en priorité par `getInvoiceDetail`
> (repli sur résolution vive pour les factures antérieures). Détail ci-dessous.

**Problème.** `getInvoiceDetail` re-résout le nom du destinataire via
`listMyPilots()` à chaque ouverture. Si le pilote retire son consentement (sort
du binôme), le coach ne peut plus régénérer une copie **conforme** de sa propre
facture (le nom repasse à « — »). Le **vendeur** est bien figé (snapshot) au
moment de l'émission ; le **destinataire** ne l'est pas.

**Arbitrage (ta décision).** Deux voies :

- **(a) Figer le destinataire** — ajouter une colonne et l'écrire à l'émission,
  comme le vendeur. Le nom du destinataire est déjà légitimement affiché à
  l'émission ; le figer sert la conformité (copie stable de la facture). Je penche
  pour cette option.

  ```sql
  alter table public.coach_invoices
    add column if not exists buyer_name text;
  -- (rempli par issueInvoice au moment de l'émission)
  ```

- **(b) Ne rien stocker** — rester en résolution vive (minimisation des données) ;
  accepter qu'une facture ré-ouverte après retrait de consentement affiche « — »
  comme destinataire. Plus « RGPD-minimal », moins « conforme facture ».

Si tu choisis (a), je câble `issueInvoice` pour écrire `buyer_name` et
`getInvoiceDetail` pour le lire en priorité (avec repli sur la résolution vive
pour les factures antérieures).

---

## Ce qui est DÉJÀ fait (code, committé)

- CA affiché en **crème** (plus en or — canon couleur, décision 2026-07-11).
- Texte « factures conformes » → reformulé (l'app **aide**, le coach reste
  émetteur et responsable — honnêteté).
- Garde-fou numérotation : `seq < 1` refusé (plus de « ANNÉE-0001 » silencieux).
- Année de numérotation = année d'**émission** (plus la date de prestation).
- Quantité de ligne en **entier** (supprime la dérive d'arrondi au centime sur le PDF).
- Source unique du montant HT (`linesAmountHtCents`) entre l'aperçu et l'écriture.
