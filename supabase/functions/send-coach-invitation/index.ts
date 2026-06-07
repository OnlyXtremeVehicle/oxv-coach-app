// @ts-nocheck — Deno runtime, pas Node
// Edge Function : send-coach-invitation
//
// Envoie un email d'invitation à un nouveau coach via Resend.
// L'email contient :
//   - Mot de bienvenue OXV doctrinal
//   - Lien de téléchargement de l'app OXV Mirror (TestFlight / Play)
//   - Instructions d'activation (login avec email + mdp temporaire)
//
// Pré-requis : le user a déjà été créé côté Supabase Auth par l'admin
// (via Dashboard ou auth.signup) et promu role='coach' via
// /(admin)/preparation. Cette Edge Function envoie juste l'email
// de bienvenue/invitation.
//
// V1.1 : générer un magic link Supabase Auth pour login sans mdp.
//
// Body attendu : { email, firstName, lastName, temporaryPassword? }
// verify_jwt = true : seul un admin authentifié peut appeler.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

Deno.serve(async (req: Request) => {
  try {
    const { email, firstName, lastName, temporaryPassword } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email requis' }), { status: 400 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée' }), {
        status: 500,
      });
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'cher coach';
    const passwordLine = temporaryPassword
      ? `<p style="margin: 16px 0; color: #777777; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">Votre mot de passe temporaire&nbsp;: <code style="background: #1a1a1a; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: Menlo, monospace; font-size: 13px;">${temporaryPassword}</code></p><p style="margin: 12px 0; color: #999999; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px;">Vous pourrez le changer après votre première connexion.</p>`
      : '';

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Bienvenue chez OXV Mirror</title>
</head>
<body style="margin: 0; padding: 40px 20px; background: #050505; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 560px; margin: 0 auto; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 40px;">
    <tr><td>
      <p style="margin: 0 0 24px 0; color: #1E3A5F; font-size: 11px; letter-spacing: 3px; font-weight: 600;">OXV MIRROR · INVITATION</p>
      <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 28px; font-weight: 200; line-height: 1.3;">Bonjour ${fullName}.</h1>
      <p style="margin: 0 0 16px 0; color: #cccccc; font-size: 16px; line-height: 1.6;">L'équipe OXV vous invite à rejoindre l'application OXV Mirror en tant que coach.</p>
      <p style="margin: 0 0 16px 0; color: #cccccc; font-size: 16px; line-height: 1.6;">Votre rôle&nbsp;: accompagner des pilotes qui vous seront assignés et qui vous accorderont leur confiance. Vous observerez leurs sessions, leurs analyses, leur progression. Vous ne donnerez jamais d'instructions par l'app.</p>
      <p style="margin: 0 0 32px 0; color: #cccccc; font-size: 16px; line-height: 1.6;">L'app est un miroir. Votre regard l'est aussi.</p>

      <h2 style="margin: 32px 0 16px 0; color: #ffffff; font-size: 18px; font-weight: 400;">Pour commencer</h2>
      <ol style="margin: 0; padding-left: 20px; color: #cccccc; font-size: 14px; line-height: 1.8;">
        <li>Installez l'application OXV Mirror&nbsp;:
          <br><a href="https://apps.apple.com/app/oxv" style="color: #C8102E; text-decoration: none;">iPhone</a> &middot; <a href="https://play.google.com/store/apps/details?id=fr.oxvehicle.app" style="color: #C8102E; text-decoration: none;">Android</a>
        </li>
        <li>Ouvrez l'application et connectez-vous avec votre email&nbsp;: <strong style="color: #ffffff;">${email}</strong></li>
        ${passwordLine}
        <li>Lisez et signez le Pacte de coaching qui vous sera présenté</li>
        <li>Vous accueillerez vos premiers pilotes quand l'équipe OXV vous les aura assignés</li>
      </ol>

      <p style="margin: 40px 0 0 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); color: #777777; font-size: 12px; line-height: 1.6;">Une question&nbsp;? Répondez à cet email&nbsp; ou écrivez à <a href="mailto:contact@oxvehicle.fr" style="color: #999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin: 8px 0 0 0; color: #555555; font-size: 11px; letter-spacing: 1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `Bonjour ${fullName},

L'équipe OXV vous invite à rejoindre l'application OXV Mirror en tant que coach.

Votre rôle : accompagner des pilotes qui vous seront assignés et qui vous accorderont leur confiance. Vous observerez leurs sessions, leurs analyses, leur progression. Vous ne donnerez jamais d'instructions par l'app.

L'app est un miroir. Votre regard l'est aussi.

Pour commencer :
1. Installez OXV Mirror (iPhone : https://apps.apple.com/app/oxv, Android : https://play.google.com/store/apps/details?id=fr.oxvehicle.app)
2. Connectez-vous avec votre email : ${email}
${temporaryPassword ? `3. Mot de passe temporaire : ${temporaryPassword} (vous pourrez le changer après la connexion)\n4. Signez le Pacte de coaching\n5. Vos premiers pilotes vous seront assignés par OXV` : `3. Signez le Pacte de coaching\n4. Vos premiers pilotes vous seront assignés par OXV`}

Une question ? contact@oxvehicle.fr

— L'équipe OXV`;

    const resendBody = {
      from: 'OXV <contact@oxvehicle.fr>',
      to: [email],
      subject: 'Bienvenue chez OXV Mirror',
      html,
      text,
      tags: [{ name: 'category', value: 'coach_invitation' }],
    };

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendBody),
    });
    const json = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'resend_error', detail: json }), {
        status: 502,
      });
    }

    return new Response(JSON.stringify({ ok: true, resend: json }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
