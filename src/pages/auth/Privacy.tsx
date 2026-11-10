import { BackHeader } from "../../components/BackHeader";

// Modèle de page de confidentialité — à faire relire par un juriste.
export default function Privacy() {
  return (
    <div className="app">
      <div className="page" style={{ paddingBottom: 40 }}>
        <BackHeader />
        <h1 className="h1">Confidentialité</h1>
        <p className="muted" style={{ margin: 0 }}>Dernière mise à jour : novembre 2026</p>

        <section className="stack-sm">
          <h2 className="h2">Qui s'occupe de tes données ?</h2>
          <p style={{ margin: 0 }}>
            Christina, Évolution Coaching, est responsable de tes données. L'appli Évolution sert uniquement à ton
            accompagnement en préparation mentale.
          </p>
        </section>

        <section className="stack-sm">
          <h2 className="h2">Ce que l'appli enregistre</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Ton compte : prénom, nom, e-mail, programme suivi et sa date de début.</li>
            <li>Ton profil : photo, discipline, niveau, nom de ton cheval, objectif de saison (si tu les renseignes).</li>
            <li>Ton suivi : check-ins (confiance, stress, concentration, motivation), objectifs de la semaine,
              concours, débriefs, routine.</li>
            <li>Tes messages, photos et vocaux, dans le groupe et avec Christina.</li>
            <li>Pour les juniors : le nom et l'e-mail du parent qui a donné son accord.</li>
          </ul>
          <p style={{ margin: 0 }}>
            Ton humeur, ton stress et ta confiance sont des informations personnelles et sensibles. Ils ne sont
            collectés qu'avec ton accord, donné à la création de ton compte, et seulement pour ton suivi.
          </p>
        </section>

        <section className="stack-sm">
          <h2 className="h2">Qui les voit ?</h2>
          <p style={{ margin: 0 }}>
            Toi et Christina. Les autres membres du groupe voient seulement ton prénom, ta photo et les messages
            que tu publies dans le groupe. Rien n'est vendu ni partagé à des fins publicitaires.
          </p>
        </section>

        <section className="stack-sm">
          <h2 className="h2">Où sont-elles stockées ?</h2>
          <p style={{ margin: 0 }}>
            Chez Supabase, sur des serveurs situés dans l'Union européenne (Francfort, Allemagne). Les échanges
            sont chiffrés. Les notifications passent par le service de notifications de ton téléphone (Apple ou
            Google), qui ne reçoit que le court texte de la notification.
          </p>
        </section>

        <section className="stack-sm">
          <h2 className="h2">Combien de temps ?</h2>
          <p style={{ margin: 0 }}>
            Tant que tu es accompagnée par Évolution, puis tant que tu gardes ton accès au groupe en tant
            qu'ancienne cliente. Tu peux demander la suppression à tout moment.
          </p>
        </section>

        <section className="stack-sm">
          <h2 className="h2">Tes droits</h2>
          <p style={{ margin: 0 }}>
            Tu peux consulter, corriger ou supprimer tes données. Pour tout supprimer, va dans ton Profil et
            choisis « Supprimer mon compte et mes données » : Christina traite la demande dans un délai d'un mois au
            maximum. Tu peux aussi écrire à Christina. En cas de désaccord, tu peux t'adresser à la CNIL (cnil.fr).
          </p>
        </section>
      </div>
    </div>
  );
}
