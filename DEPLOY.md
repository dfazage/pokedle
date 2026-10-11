# Hébergement (Cloudflare Pages)

1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → dépôt `pokedle`.
2. Réglages de build :
   - Framework preset : Vite (ou aucun)
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Variable `NODE_VERSION` = `22`
3. Variables d'environnement (Production **et** Preview), valeurs de `.env.example` :
   - `VITE_SUPABASE_URL` = `https://gcjsqxogywmgslkqoojq.supabase.co`
   - `VITE_SUPABASE_KEY` = la clé publishable du projet Supabase (publique par conception, protégée par RLS)
4. Save and Deploy. Chaque `git push` sur `main` redéploie.
5. Supabase → Authentication → URL Configuration : mettre l'URL Pages (`https://<projet>.pages.dev`) dans **Site URL** et dans **Redirect URLs**, sinon les liens de confirmation d'e-mail pointent vers localhost.
6. Test : ouvrir l'URL sur mobile → menu du navigateur → « Ajouter à l'écran d'accueil » (PWA).

`public/_redirects` renvoie toute URL vers `index.html` ; `public/_headers` empêche de mettre en cache le service worker (mises à jour immédiates) et cache les `assets/` un an.
