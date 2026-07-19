// =============================================================================
// OXV — Gabarits e-mail inscription (charte OXV)
// =============================================================================

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const RED = '#C8102E';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(opts: {
  title: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string } | null;
  reference: string;
}): string {
  const cta = opts.cta
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:8px 0 4px 0;">
            <tr><td style="background:${RED};border-radius:8px;">
              <a href="${opts.cta.url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.3px;text-decoration:none;">${escapeHtml(
                opts.cta.label,
              )}</a>
            </td></tr>
          </table>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
        <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">${escapeHtml(
          opts.eyebrow,
        )}</p>
        <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
        <h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${escapeHtml(
          opts.heading,
        )}</h1>
        ${opts.bodyHtml}
        ${cta}
        <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(
          opts.reference,
        )}</p>
        <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
        <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const P = (html: string) =>
  `<p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">${html}</p>`;

const PMUTED = (html: string) =>
  `<p style="margin:0 0 16px 0;color:#888888;font-size:13px;line-height:1.6;">${html}</p>`;

const bonjour = (firstName: string) =>
  firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';

export function renderApproval(opts: {
  firstName: string;
  reference: string;
  actionLink: string | null;
}): RenderedEmail {
  const subject = 'Votre inscription est acceptée — OXV';
  const link = opts.actionLink;

  const bodyHtml =
    P('Votre demande d’inscription a été acceptée. Nous sommes heureux de vous accueillir.') +
    (link
      ? P('Pour accéder à votre espace, définissez votre mot de passe. Ce lien vous est personnel et reste valable un temps limité.')
      : P('Votre compte est créé. Vous recevrez très prochainement le lien pour définir votre mot de passe et accéder à votre espace.')) +
    (link
      ? PMUTED(
          `Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br><span style="color:#aaaaaa;word-break:break-all;">${escapeHtml(
            link,
          )}</span>`,
        )
      : '');

  const html = shell({
    title: subject,
    eyebrow: 'OXV · INSCRIPTION ACCEPTÉE',
    heading: bonjour(opts.firstName),
    bodyHtml,
    cta: link ? { label: 'Définir mon mot de passe', url: link } : null,
    reference: opts.reference,
  });

  const text = [
    bonjour(opts.firstName).replace(/&[^;]+;/g, ''),
    '',
    'Votre demande d’inscription a été acceptée. Nous sommes heureux de vous accueillir.',
    '',
    link
      ? `Pour accéder à votre espace, définissez votre mot de passe via ce lien (personnel, valable un temps limité) :\n${link}`
      : 'Votre compte est créé. Vous recevrez très prochainement le lien pour définir votre mot de passe.',
    '',
    `Référence ${opts.reference}`,
    '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].join('\n');

  return { subject, html, text };
}

export function renderRejection(opts: {
  firstName: string;
  reference: string;
  adminNote: string | null;
}): RenderedEmail {
  const subject = 'Votre demande d’inscription — OXV';
  const note = opts.adminNote && opts.adminNote.trim().length > 0 ? opts.adminNote.trim() : null;

  const bodyHtml =
    P('Nous avons étudié votre demande d’inscription avec attention.') +
    P('Nous ne sommes pas en mesure d’y donner suite pour le moment.') +
    (note
      ? `<p style="margin:0 0 16px 0;padding:14px 16px;border-left:2px solid ${RED};background:rgba(255,255,255,0.03);color:#bbbbbb;font-size:14px;line-height:1.6;">${escapeHtml(
          note,
        )}</p>`
      : '') +
    P('Nous restons à votre disposition si vous souhaitez en échanger.');

  const html = shell({
    title: subject,
    eyebrow: 'OXV · INSCRIPTION',
    heading: bonjour(opts.firstName),
    bodyHtml,
    cta: null,
    reference: opts.reference,
  });

  const text = [
    bonjour(opts.firstName).replace(/&[^;]+;/g, ''),
    '',
    'Nous avons étudié votre demande d’inscription avec attention.',
    'Nous ne sommes pas en mesure d’y donner suite pour le moment.',
    note ? `\n${note}\n` : '',
    'Nous restons à votre disposition si vous souhaitez en échanger.',
    '',
    `Référence ${opts.reference}`,
    '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].join('\n');

  return { subject, html, text };
}

export function renderAcknowledgement(opts: {
  firstName: string;
  reference: string;
}): RenderedEmail {
  const subject = 'Nous avons bien reçu votre demande — OXV';

  const bodyHtml =
    P('Nous avons bien reçu votre demande d’inscription.') +
    P('Elle est en cours d’examen par notre équipe. Vous recevrez une réponse dès qu’une décision aura été prise.') +
    P('Aucune action n’est requise de votre part pour l’instant.');

  const html = shell({
    title: subject,
    eyebrow: 'OXV · DEMANDE REÇUE',
    heading: bonjour(opts.firstName),
    bodyHtml,
    cta: null,
    reference: opts.reference,
  });

  const text = [
    bonjour(opts.firstName).replace(/&[^;]+;/g, ''),
    '',
    'Nous avons bien reçu votre demande d’inscription.',
    'Elle est en cours d’examen par notre équipe. Vous recevrez une réponse dès qu’une décision aura été prise.',
    'Aucune action n’est requise de votre part pour l’instant.',
    '',
    `Référence ${opts.reference}`,
    '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].join('\n');

  return { subject, html, text };
}
