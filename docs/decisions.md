# Appli Évolution : décisions validées par Christina

Date : 10 novembre 2026. Ces choix complètent le cahier des charges (version 1).

## Réponses aux points [À DÉCIDER]

| Sujet | Décision |
|---|---|
| Horaires de réponse (messagerie) | « Christina répond sous 24 h, 7 jours sur 7 » |
| Anciennes clientes | Gardent le groupe et voient leur historique et leur routine en lecture seule. Pas de check-in hebdo, pas de messages automatiques, pas d'alertes coach. |
| Critères du check-in (1 à 10) | Confiance en moi, niveau de stress, concentration à cheval, motivation, plus la question ouverte « Qu'est-ce qui t'occupe l'esprit en ce moment ? » |
| Seuils des alertes coach | Confiance en baisse : -2 points ou plus en 2 semaines. Décrochage : 10 jours sans check-in. Fin de programme : 7 jours avant la fin. Alerte en plus : stress élevé (note de 8 ou plus). |
| Badges | Premier pas (1er débrief), Cavalière réflexive (5 débriefs), Routine au paddock (routine suivie en entier), Module validé (module terminé), Sans-faute (1er sans-faute), 3 mois d'Évolution. Les libellés s'accordent au masculin pour les cavaliers. |
| Connexion Systemio | Les clientes se connectent avec leur e-mail : la même adresse sert pour l'appli. |
| Lien Calendly | https://calendly.com/christina-battung/coaching-individuel |
| Logo | Fourni par Christina (icône de l'appli). |

## Choix techniques (version 1)

- **Supabase**, région Union européenne (Francfort) : comptes et mots de passe, base de données, messagerie en temps réel, photos et vocaux, envois programmés. Un seul compte à créer.
- **Appli web installable (PWA)** : pas d'App Store, notifications push standard (Web Push) envoyées depuis Supabase.
- **Hébergement de l'appli** : GitHub Pages (compte GitHub déjà existant), à l'adresse app.evolution-coaching.fr. Aucune donnée de cliente n'y est stockée : elles restent toutes chez Supabase, en Europe.
- Coût de départ : 0 €. Plus tard : formule Supabase payante (environ 25 $/mois) pour les sauvegardes quotidiennes automatiques, dès que de vraies clientes utilisent l'appli.
- Adresse de l'appli : **app.evolution-coaching.fr** (le domaine de Christina chez OVH s'écrit avec un tiret).
