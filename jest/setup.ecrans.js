/**
 * Variables d'environnement du projet « écrans ». S'exécute AVANT tout require.
 *
 * `src/lib/supabase.ts` LÈVE au chargement du module si `EXPO_PUBLIC_SUPABASE_URL`
 * ou `_ANON_KEY` manquent, et jest ne lit pas `.env`. Or l'écran Data importe
 * deux services qui importent ce module : le tout premier `import` du fichier
 * testé lèverait, et l'on croirait à un défaut de l'écran alors que c'est la
 * configuration de test.
 *
 * Ces valeurs ne joignent RIEN : l'URL pointe sur une boucle locale et la clé
 * n'existe pas. Tout appel réseau d'un test d'écran doit être mocké — s'il ne
 * l'est pas, il échouera bruyamment, ce qui est le comportement voulu.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-de-test-jamais-valide';
