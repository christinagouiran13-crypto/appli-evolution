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

## Version 1.1 (11 novembre 2026)

- **Programme terminé** : bouton dans la fiche cliente (et sur l'alerte de fin de programme). La cliente devient « ancienne cliente » : elle garde le groupe, son historique et sa routine, sans check-in ni messages automatiques.
- **Inscription autonome** : un lien unique à partager (WhatsApp, e-mail groupé). Chaque cliente crée son compte avec l'e-mail de Systemio et choisit son programme (ou « accompagnement terminé »). Alerte « Nouvelle inscription » pour vérifier la fiche. Le lien peut être changé à tout moment.
- **Onglet « Indispensables »** (remplace l'onglet Routine) : bouton Urgence, boîte de secours (partie commune + partie personnelle), routine construite par la cavalière (la coach peut aussi la modifier), audios de préparation mentale, questionnaire de feedback (contenu à fournir par Christina), fichiers et liens.
- **Bouton Urgence** : message marqué URGENCE dans la conversation privée, notification prioritaire pour Christina, carte rouge en tête du tableau de bord. Ensuite, la cavalière voit sa boîte de secours.
- **Vidéos** dans la messagerie (50 Mo maximum par vidéo avec l'offre gratuite de Supabase).
- **Messages automatiques** : fin de Starter 90 annoncée une semaine avant ; rappel de séance tous les 15 jours si aucune séance n'est prévue.
- **Juniors** : quand Christina note la date de la séance N, la junior reçoit la confirmation et la mission N (liste des missions dans la page Indispensables de l'espace coach).
- **Questionnaire de feedback après concours** : les 7 questions de Christina, dans l'appli (Indispensables, après un débrief, page Concours). Alerte « Feedback à lire » pour la coach. Le message du lendemain de concours invite au débrief et au feedback.
- **Missions Junior 90** : les 6 missions de Christina (PDF) sont enregistrées ; les juniors ont 6 séances (Où j'en suis, Mes objectifs, Ma concentration, Ma confiance en moi, Mes émotions, Mon plan d'action). « À m'envoyer sur WhatsApp » devient « À m'envoyer dans l'appli (onglet Messages) ».
- **Réservation automatique** : la cliente réserve dans l'appli (agenda Calendly intégré, nom et e-mail pré-remplis). La réservation est détectée toute seule : la séance suivante passe « Réservée » et, pour une junior, la confirmation + la mission suivante partent aussitôt. Rien à saisir pour Christina. Avec une clé Calendly (secret GitHub `CALENDLY_TOKEN`, facultatif), la date et le lien visio sont aussi remplis, ce qui active le rappel de la veille. Rappel de réservation tous les 15 jours tant qu'aucune séance n'est réservée.
- **Juniors, mise à jour** : à la réservation, simple confirmation. La mission N part environ 1 heure après la séance N (date connue grâce à la clé Calendly), ou dès que Christina coche « Séance faite ». Elle est accompagnée du message de fin de séance de Christina et rangée dans Indispensables → « Mes missions » avec son PDF (PDF à déposer par Christina dans Indispensables → Missions junior).
- **Fiches mission** : l'appli met en page chaque mission comme les PDF de Christina (avec « À m'envoyer dans l'appli »), à ouvrir dans « Mes missions » et à enregistrer en PDF. Aucun PDF à déposer.
- **Audio de préparation mentale** de Christina ajouté pour toutes les clientes (Indispensables). Fichier publié avec l'appli : accessible à quiconque connaît son adresse.
- **Pastille sur l'icône** : nombre de messages non lus (groupe + conversation privée ; pour la coach, toutes les conversations), mis à jour à chaque notification et à l'ouverture des messages. iPhone (appli sur l'écran d'accueil, notifications autorisées) et Android.
- **Vocaux en accéléré** : lecteur audio avec vitesse 1×, 1,5×, 2× (comme WhatsApp), retenue d'une écoute à l'autre, sur les vocaux et les audios de préparation.
- **Photos et vidéos** : bouton « + » dans toutes les conversations (groupe et privé) : galerie, prendre une photo, filmer une vidéo. Vidéos jusqu'à 50 Mo avec l'offre gratuite de Supabase.
- **Réactions emoji** : toucher un message pour réagir (❤️ 👍 😂 😮 😢 🙏 👏 💪), une réaction par personne, visible en direct par tous ceux qui voient le message.
- **Messagerie coach** : deux onglets « Équipe Évolution » (groupe) et « One-to-one » (privés : liste triée, non lus en premier, recherche par prénom, conversation en plein écran sur téléphone). Côté cavalières, l'onglet « Groupe » devient « Équipe Évolution ».
- **Accompagnement terminé** : dès que la date de fin (Starter 90 ou Level Up 180) est dépassée, plus aucun message automatique ni alerte « décrochage », même si le statut n'a pas encore été passé à « Programme terminé ». Évolution Club n'a pas de fin.
- **Ma formation (Starter 90)** : les 8 parties de la formation Systemio (introduction, modules 1 à 6, bonus, 34 leçons) dans l'appli, avec le module du moment, « Ouvrir le module » (vers Systemio), « J'ai terminé ce module » (badge Module validé) et la progression visible dans la fiche coach. Liens directs par module facultatifs (Indispensables).
- **Ton parcours Évolution** (dans Ma formation) : Starter 90 → Level Up 180 → Évolution Club. Bouton « Ça m'intéresse » seulement dans les 2 dernières semaines du programme ou après ; message + carte « Intéressée par la suite » pour la coach. Masqué pour les juniors (suite junior à venir). Textes modifiables dans Indispensables.
- **Réponses types** : bouton ⚡ dans les conversations de la coach ; la réponse s'insère avec le prénom ({prenom}) et peut être retouchée. Gestion dans « Messages auto et réponses types ». 7 réponses de départ.
- **Bilan de fin de programme** : page « Mon bilan » (carte sur l'accueil dans les 2 dernières semaines et après) : avant/après des 4 notes, courbe, chiffres, badges, puis « Ton parcours Évolution ». Visible par la coach depuis la fiche. Pas pour les juniors pour l'instant.
- **Mur des victoires** : toutes les victoires partagées (texte + photo), avec ❤️ ; accès depuis le groupe, la progression et l'espace coach.
- Idée gardée pour plus tard : défi du lundi programmé à l'avance.
- **Pause** (fiche → Gestion) : 1 semaine, 15 jours, 1 mois ou jusqu'à une date. Pendant la pause : pas de messages automatiques ni d'alerte « décrochage » ; programme rallongé d'autant ; la cavalière garde l'appli, le groupe et la messagerie. « Reprendre maintenant » rend les jours non utilisés.
- **Feedback accessible à toutes** : aussi aux anciennes clientes ; bouton « Feedback après concours » toujours visible dans l'onglet Concours ; anciennes fiches « questionnaire » sans lien masquées ; l'appli vérifie les mises à jour à chaque retour.
- **Retour de pause** : la relance « 7 jours sans check-in » et l'alerte « décrochage » comptent à partir de la fin de la pause. Vérifié par simulation : aucun message automatique aux anciennes clientes, aux programmes terminés ni pendant une pause.
- **Juniors, entre deux séances** : 7 jours après chaque séance (le lendemain si c'est un mardi), « Comment ça va cette semaine ? » avec rappel de réserver la prochaine séance, ou la date si elle est déjà réservée. Textes modifiables.
- Junior 90 : la coach peut passer une cavalière en Junior 90 depuis sa fiche (Gestion), avec accord parent coché. Les séances non faites/non réservées prennent les 6 thèmes junior, et les missions junior partent ensuite.
- Règle des 48 h : si un message (hors message automatique) a été échangé dans la conversation privée dans les 48 dernières heures, pas de message « prendre des nouvelles » (mardi, relance 7 jours sans check-in, rappel de réservation, « comment ça va » des juniors). Les messages liés à un événement (veille de concours/séance, lendemain de concours, missions, fin de Starter) partent quand même.
- Pas de doublon : un message « prendre des nouvelles » ne part jamais moins de 3 jours après un autre message automatique. Le message du mardi reste prioritaire ; les autres relances (7 jours sans check-in, rappel de réservation, « comment ça va » junior) partent du mercredi au dimanche. Résultat : au plus 2 relances par semaine (mardi + fin de semaine).
