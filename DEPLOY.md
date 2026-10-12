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

**Liens des e-mails (confirmation / mot de passe oublié)** : l'app envoie `redirectTo` = `VITE_SITE_URL` (ou l'origine courante). Cette URL doit figurer dans Supabase → Authentication → URL Configuration → **Redirect URLs**, et **Site URL** ne doit plus être `http://localhost:3000`.

GitHub Pages (`https://pokebadle.fun/`) : dans Supabase, **Site URL** = `https://pokebadle.fun/` et **Redirect URLs** = `https://pokebadle.fun/` + `https://pokebadle.fun/**`.

## Connexion Google

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (type *Web application*).
   - Authorized redirect URI : `https://gcjsqxogywmgslkqoojq.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google : activer, coller *Client ID* et *Client secret*.
3. Supabase → Authentication → URL Configuration : **Site URL** = URL de production (jamais `localhost`), et l'URL de production + `http://localhost:5173/**` dans **Redirect URLs**.

**Connexion Google (Google Identity Services)** : le bouton de la page de connexion utilise `VITE_GOOGLE_CLIENT_ID` (workflow `deploy.yml`), le même Client ID que dans Supabase → Authentication → Providers → Google. Le domaine du site doit figurer dans Google Cloud → Identifiants → *Origines JavaScript autorisées* (`https://pokebadle.fun`). Le jeton Google est échangé via `supabase.auth.signInWithIdToken` (nonce haché SHA-256). Sans `VITE_GOOGLE_CLIENT_ID` ou si le script Google est bloqué, l'app retombe sur `signInWithOAuth` (écran affichant `supabase.co`).
