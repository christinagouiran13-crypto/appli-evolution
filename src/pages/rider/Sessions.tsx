import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { fmtDateTime } from "../../lib/dates";
import type { Session } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Icon } from "../../components/Icon";
import { BookingModal } from "../../components/BookingModal";

export default function Sessions() {
  const { me, settings } = useMe();
  const [sessions, setSessions] = useState<Session[]>([]);

  const [booking, setBooking] = useState(false);
  const load = useCallback(() => {
    supabase.from("sessions").select("*").eq("rider_id", me.id).order("number").order("scheduled_at").then(({ data }) => setSessions((data as Session[]) ?? []));
  }, [me.id]);
  useEffect(load, [load]);

  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => !s.done && s.scheduled_at && s.scheduled_at >= now);
  const booked = sessions.filter((s) => !s.done && !s.scheduled_at && s.booked_at);
  const toBook = sessions.filter((s) => !s.done && !s.scheduled_at && !s.booked_at);
  const past = sessions.filter((s) => s.done || (s.scheduled_at && s.scheduled_at < now));

  const book = () => setBooking(true);

  return (
    <div className="page">
      <BackHeader />
      <div className="stack-sm">
        <h1 className="h1">Mes séances</h1>
        <p className="muted" style={{ margin: 0 }}>{settings?.slots_text}</p>
      </div>

      {me.status === "active" && (
        <div className="card-soft stack">
          <div className="h3">Prendre rendez-vous</div>
          <div className="small">Choisis ton créneau dans l'agenda de Christina, directement ici. Ta séance s'ajoute toute seule{me.is_junior ? ", et ta mission arrive dans tes messages" : ""}.</div>
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={book}><Icon name="calendar" size={18} />Réserver ma séance</button>
        </div>
      )}

      <section className="stack">
        <h2 className="h2">À venir</h2>
        {upcoming.length === 0 && <div className="empty">Aucune séance prévue pour l'instant.</div>}
        {upcoming.map((s) => (
          <div key={s.id} className="card stack-sm">
            <div className="row-between">
              <div className="h3">{s.number ? `Séance ${s.number} · ` : ""}{s.theme || "Séance"}</div>
            </div>
            <div className="small bold" style={{ color: "var(--vert)" }}>{fmtDateTime(s.scheduled_at)}</div>
            {s.prep && <div className="small"><b>À préparer : </b>{s.prep}</div>}
            {s.visio_url && <a className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} href={s.visio_url} target="_blank" rel="noreferrer">Rejoindre la visio</a>}
          </div>
        ))}
      </section>

      {booked.map((s) => (
        <div key={s.id} className="card row">
          <div className="grow"><div className="h3">{s.number ? `Séance ${s.number} · ` : ""}{s.theme}</div>
            <div className="small muted">Réservée : la date est dans ton e-mail de confirmation.</div></div>
          <span className="tag tag-vert">Réservée</span>
        </div>
      ))}

      {toBook.length > 0 && (
        <section className="stack">
          <h2 className="h2">À réserver</h2>
          {toBook.map((s) => (
            <div key={s.id} className="card row">
              <div className="grow"><div className="h3">{s.number ? `Séance ${s.number} · ` : ""}{s.theme}</div>
                {s.prep && <div className="small muted">À préparer : {s.prep}</div>}</div>
              <span className="tag tag-rose">À réserver</span>
            </div>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="stack">
          <h2 className="h2">Faites</h2>
          {past.map((s) => (
            <div key={s.id} className="card row">
              <div className="grow"><div className="h3">{s.number ? `Séance ${s.number} · ` : ""}{s.theme || "Séance"}</div>
                <div className="small muted">{s.scheduled_at ? fmtDateTime(s.scheduled_at) : ""}</div></div>
              <span className="tag tag-vert">Faite</span>
            </div>
          ))}
        </section>
      )}
      {booking && <BookingModal onClose={() => setBooking(false)} onBooked={load} />}
    </div>
  );
}
