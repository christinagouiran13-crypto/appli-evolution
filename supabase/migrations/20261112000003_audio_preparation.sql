-- Audio de préparation mentale de Christina, à écouter avant les concours (pour toutes)
insert into public.resources (rider_id, category, title, description, url)
select null, 'audio', 'Audio de préparation mentale', 'À écouter avant chaque concours, au calme, avec des écouteurs.',
       '/audios/preparation-mentale-concours.m4a'
where not exists (select 1 from public.resources where url = '/audios/preparation-mentale-concours.m4a');
