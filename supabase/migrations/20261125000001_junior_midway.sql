-- Juniors : message « comment ça va cette semaine ? » 7 jours après chaque séance
insert into public.auto_messages (code, label, body, sort) values
  ('junior_midway', 'Juniors : 7 jours après la séance (pas encore réservé)',
   'Coucou {prenom} ! Comment ça va cette semaine ? 🐴 On se voit bientôt : pense à réserver ta prochaine séance dans l''appli (Accueil → Mes séances) 💚', 12),
  ('junior_midway_booked', 'Juniors : 7 jours après la séance (déjà réservé)',
   'Coucou {prenom} ! Comment ça va cette semaine ? 🐴 On se voit le {date} à {heure} pour ta prochaine séance 💚', 13)
on conflict (code) do nothing;
