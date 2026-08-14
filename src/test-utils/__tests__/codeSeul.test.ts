import { codeExecutable, codeSansCommentaires } from '../codeSeul';

describe('codeSansCommentaires', () => {
  it('retire un commentaire de ligne', () => {
    const src = `const a = 1; // max_g_lateral ?? 0\n`;
    expect(codeSansCommentaires(src)).not.toContain('max_g_lateral');
    expect(codeSansCommentaires(src)).toContain('const a = 1;');
  });

  it('retire un commentaire de bloc, même sur plusieurs lignes', () => {
    const src = `/**\n * max_g_lateral ?? 0\n */\nconst a = 1;\n`;
    expect(codeSansCommentaires(src)).not.toContain('max_g_lateral');
  });

  /**
   * LES POSITIONS RESTENT VRAIES. Une garde qui rapporte « fichier:ligne »
   * désignerait la mauvaise ligne si l'on coupait au lieu de blanchir.
   */
  it('préserve le nombre de lignes et les colonnes', () => {
    const src = `// un\nconst a = 1;\n/* deux\ntrois */\nconst b = 2;\n`;
    const out = codeSansCommentaires(src);
    expect(out.split('\n')).toHaveLength(src.split('\n').length);
    expect(out.split('\n')[1]).toBe('const a = 1;');
  });

  /**
   * LE CAS QUI FAIT ÉCHOUER UNE EXPRESSION RÉGULIÈRE, ET PAS LE SCANNER.
   *
   * `//` dans une chaîne n'ouvre pas un commentaire. Un dépouillement par
   * expression régulière mange la fin de la ligne et fait disparaître du code
   * réel — le genre de faux NÉGATIF qui rend une garde verte pour rien.
   */
  it('ne prend pas un « // » DANS une chaîne pour un commentaire', () => {
    const src = `const url = 'https://exemple.fr'; const interdit = x ?? 0;\n`;
    const out = codeSansCommentaires(src);
    expect(out).toContain('https://exemple.fr');
    expect(out).toContain('x ?? 0');
  });

  it('ne prend pas un « /* » dans une chaîne pour un bloc', () => {
    const src = `const s = "un /* faux debut"; const vrai = 1;\n`;
    expect(codeSansCommentaires(src)).toContain('const vrai = 1;');
  });
});

describe('le commentaire JSX', () => {
  /**
   * LE CAS QUE LE SCANNER SEUL LAISSE PASSER, ET QUI A COÛTÉ UN VERDICT FAUX.
   *
   * `{` puis un commentaire puis `}` : le scanner linéaire est en mode texte
   * JSX à cet endroit et ne l'émet pas comme commentaire. Le parseur, lui, le
   * nomme — c'est un `JsxExpression` sans expression.
   *
   * Mesuré le 14/08 : sans cette prise en charge, `intentionJuxtaposee` a
   * accusé un écran JUSTE, dont le commentaire énonçait l'interdit qu'il
   * respecte.
   */
  it('est retiré par codeSansCommentaires', () => {
    const src = 'const el = <View>{/* tenue manquée */}<Text /></View>;';
    const out = codeSansCommentaires(src);
    expect(out).not.toContain('tenue');
    expect(out).not.toContain('manquée');
    expect(out).toContain('<Text />');
  });

  it('est retiré par codeExecutable aussi', () => {
    const src = 'const el = <View>{/* interdit */}</View>;';
    expect(codeExecutable(src)).not.toContain('interdit');
  });
});

describe('codeExecutable', () => {
  it('retire AUSSI les littéraux de chaîne', () => {
    const src = `const msg = 'max_g_lateral ?? 0'; const a = 1;\n`;
    const out = codeExecutable(src);
    expect(out).not.toContain('max_g_lateral');
    expect(out).toContain('const a = 1;');
  });

  it('retire les gabarits, morceaux compris', () => {
    const src = 'const t = `interdit ${x} encore interdit`;\n';
    const out = codeExecutable(src);
    expect(out).not.toContain('interdit');
    // L'expression interpolée, elle, EST du code et doit survivre.
    expect(out).toContain('x');
  });

  /**
   * LA DIFFÉRENCE ENTRE LES DEUX, DITE PAR UN EXEMPLE RÉEL.
   *
   * `colonneSupprimeeBalayee` vérifie `.update({ role }).eq('id', userId)` :
   * elle a besoin de voir `'id'`. Une garde qui cherche un motif INTERDIT, au
   * contraire, ne doit pas compter une chaîne qui le cite.
   */
  it('les deux fonctions ne servent pas au même usage', () => {
    const src = `supabase.from('users').update({ role }).eq('id', userId);\n`;
    expect(codeSansCommentaires(src)).toContain("eq('id', userId)");
    expect(codeExecutable(src)).not.toContain('id');
  });

  it('le JSX textuel est retiré aussi', () => {
    const src = `const el = <Text>Heatmap</Text>;\n`;
    expect(codeExecutable(src)).not.toContain('Heatmap');
  });
});
