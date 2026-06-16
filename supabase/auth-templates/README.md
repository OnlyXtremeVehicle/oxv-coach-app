# Templates e-mail Auth Supabase — charte OXV

Re-skin des e-mails transactionnels **Supabase Auth** au ton OXV (fond `#050505`,
rouge `#C8102E`, titre ultra-light, vouvoiement, sans emoji). Remplacent les
gabarits Supabase par défaut (signalés « hors-charte » dans l'audit).

> Ces gabarits **ne se déploient pas** par migration ni par MCP : ils se collent
> dans le **Dashboard Supabase** → `Authentication` → `Emails` → onglet de chaque
> template. (Variables Go conservées : `{{ .ConfirmationURL }}`, `{{ .Token }}`.)

## Correspondance fichier ↔ template Dashboard ↔ objet suggéré

| Fichier | Template Supabase | Objet (à coller dans « Subject ») |
|---|---|---|
| `confirmation.html` | Confirm signup | `Confirmez votre adresse — OXV` |
| `recovery.html` | Reset password | `Réinitialisation de votre mot de passe — OXV` |
| `magic_link.html` | Magic Link | `Votre lien de connexion — OXV` |
| `invite.html` | Invite user | `Vous êtes invité — OXV` |
| `email_change.html` | Change Email Address | `Confirmez votre nouvelle adresse — OXV` |
| `reauthentication.html` | Reauthentication | `Votre code de vérification — OXV` |

## Procédure (par template)

1. Dashboard → `Authentication` → `Emails`.
2. Ouvrir l'onglet correspondant (ex. « Reset password »).
3. Coller le contenu HTML du fichier dans le corps du message.
4. Renseigner l'objet (colonne ci-dessus).
5. Enregistrer, puis tester via `Send test email`.

## Notes

- `confirmation.html` n'est utilisé que si « Confirm email » est activé (prod).
- `recovery.html` est l'e-mail envoyé quand un utilisateur clique « mot de passe
  oublié » dans l'app. Le flux d'inscription (validate-inscription) envoie son
  **propre** e-mail brandé avec un lien recovery — il ne dépend pas de ce gabarit.
- `reauthentication.html` affiche un **code** (`{{ .Token }}`), pas de bouton.
- Police : `Menlo`/monospace pour le code, `Helvetica Neue` pour le reste
  (cohérent avec les e-mails transactionnels OXV existants).
