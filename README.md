# Appli Évolution

Appli web installable sur téléphone (PWA) pour les cavalières accompagnées par Évolution Coaching, avec l'espace coach de Christina. Version 1 du cahier des charges.

## Ce qu'elle contient

- **Côté cavalière** : accueil, check-in de la semaine, objectifs de la semaine, concours et débriefs (après un concours ou un cours), routine (avant, pendant, après) avec mot d'ancrage et audios, messagerie (groupe et conversation privée, avec texte, photos et vocaux), mes séances (rendez-vous Calendly), progression (série de check-ins, courbe de confiance, badges, objectif de saison), victoires partagées, profil et notifications.
- **Côté coach** : tableau de bord « qui a besoin de moi », alertes automatiques, tableau filtrable des clientes, fiche cliente (courbes, check-ins, débriefs, objectifs, messages, routine modifiable, séances, notes privées, gestion), invitations, messages automatiques modifiables, réglages.
- **Messages automatiques** : bienvenue, message du mardi (deux versions en alternance), veille et lendemain de concours, relance après 7 jours sans check-in, veille de séance, fin de Starter 90.
- **RGPD** : données hébergées dans l'UE (Supabase, Francfort), accord à la création du compte, accord parental pour les juniors, page de confidentialité (modèle à faire relire par un juriste), demande de suppression depuis le profil.

Les décisions prises avec Christina sont dans [`docs/decisions.md`](docs/decisions.md).

## Organisation technique

| Dossier | Rôle |
|---|---|
| `src/` | L'appli (React + TypeScript, Vite). `pages/rider` pour les cavalières, `pages/coach` pour l'espace coach. |
| `src/sw.ts` | Service worker : installation hors ligne et notifications push. |
| `supabase/migrations/` | Structure de la base, règles de sécurité (RLS), stockage, tâches programmées. |
| `supabase/functions/` | Fonctions serveur : `coach-admin` (invitations, liens, suppression), `push` (notifications), `scheduler` (messages automatiques, toutes les 15 minutes). |
| `.github/workflows/deploy.yml` | Mise en ligne automatique à chaque modification de `main`. |

Le tout premier compte créé dans Supabase devient le compte coach. Les cavalières sont ensuite invitées depuis l'espace coach.

## Travailler en local

```bash
npm install
npx supabase start
npx supabase functions serve
npm run dev
```

Copier `.env.example` en `.env.local` et y mettre l'adresse et la clé publique affichées par `supabase start`.
