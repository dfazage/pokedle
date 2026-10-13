# Environnements et workflow

| Environnement | Branche | URL | Hébergement |
|---|---|---|---|
| Prod | `main` | https://pokebadle.fun | GitHub Pages (`.github/workflows/deploy.yml`) |
| QA | `dev` | https://qa.pokebadle.fun (et https://pokedle-qa.pages.dev) | Cloudflare Pages, projet `pokedle-qa` |

Flux de travail :

1. Les PR de fonctionnalités ciblent `dev`.
2. Le merge sur `dev` déploie automatiquement sur QA (branche de production du projet Cloudflare = `dev`).
3. Après validation sur QA, ouvrir une PR `dev` → `main`.
4. Le merge sur `main` déploie en prod via GitHub Pages.

Notes :

- Les autres branches et PR obtiennent une preview Cloudflare (`*.pokedle-qa.pages.dev`).
- DNS : `pokebadle.fun` est géré chez GoDaddy ; `qa` est un CNAME vers `pokedle-qa.pages.dev`.
- QA et prod partagent la même base Supabase : les tests en QA touchent les vraies données (scores, séries).
- Variables du projet Cloudflare : `NODE_VERSION=22`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_GOOGLE_CLIENT_ID` (mêmes valeurs publiques que dans `deploy.yml`).
- Pour que la connexion fonctionne en QA : ajouter `https://qa.pokebadle.fun/**` dans Supabase → Authentication → URL Configuration → Redirect URLs, et `https://qa.pokebadle.fun` dans Google Cloud → Identifiants → Origines JavaScript autorisées.
- Les sections ci-dessous décrivent la création du projet Cloudflare Pages (branche de production = `dev`, donc QA ; la prod reste sur GitHub Pages).

---

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

## Notifications push (combat du jour disponible)

Une notification est envoyée à 12h00 (heure de Paris), au reset du jeu, aux appareils qui l'ont activée dans Paramètres → Notifications. Android et ordinateur : directement dans le navigateur. iPhone/iPad : uniquement si Pokédle est ajouté à l'écran d'accueil (l'app l'indique dans la carte).

1. **Clés VAPID** (une seule fois) : `npx web-push generate-vapid-keys`. La clé publique est publique ; la privée ne doit jamais être committée.
2. **Front** : GitHub → Settings → Secrets and variables → Actions → *Variables* : `VITE_VAPID_PUBLIC_KEY` = clé publique, puis relancer le déploiement. Tant que la variable est vide, la carte Notifications reste cachée.
3. **Base** : exécuter `supabase/push_subscriptions.sql` dans l'éditeur SQL Supabase.
4. **Edge Function** : `supabase functions deploy send-daily-push --no-verify-jwt`, puis
   `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=<valeur aléatoire>`.
5. **Planification** : dans l'éditeur SQL, `select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');` (même valeur que ci-dessus), puis exécuter `supabase/push_cron.sql`. Deux appels (10h et 11h UTC) couvrent l'heure d'été et d'hiver : la fonction ignore celui qui ne tombe pas à 12h Paris.
6. **Test** : activer les notifications sur son téléphone, puis appeler la fonction à la main (hors horaire) :
   `curl -X POST https://<ref>.supabase.co/functions/v1/send-daily-push -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"force":true,"only_user_id":"<ton user id>"}'`

Les abonnements morts (site désinstallé, permission retirée) sont supprimés automatiquement quand le service push répond 404/410.
