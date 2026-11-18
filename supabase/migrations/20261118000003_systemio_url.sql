-- Lien de la formation Starter 90 sur Systemio (fourni par Christina)
update public.app_settings
set training_url = 'https://christina-battung.systeme.io/school/course/cavalierdecompetition/lecture/5126432'
where training_url in ('https://www.systeme.io', '');
