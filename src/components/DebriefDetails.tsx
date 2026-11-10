import type { Debrief } from "../lib/types";
import { fmtDate, relativeDay } from "../lib/dates";
import { resultLabel } from "../lib/text";

export function DebriefDetails({ d, showDate }: { d: Debrief; showDate?: boolean }) {
  return (
    <div className="stack">
      {showDate && <div className="h3">{d.title || (d.kind === "cours" ? "Cours" : "Concours")} · {fmtDate(d.date)}</div>}
      <div className="row wrap">
        {d.kind === "concours" && <span className="tag tag-rose">{resultLabel(d.result)}</span>}
        {d.kind === "cours" && <span className="tag tag-gris">Après un cours</span>}
        {d.coach_read_at && <span className="tag tag-vert">Lu par Christina {relativeDay(d.coach_read_at)}</span>}
      </div>
      <div className="card stack-sm">
        <div className="row-between"><span className="muted">Avant</span><b>{d.mental_before ?? "—"}</b></div>
        <div className="row-between"><span className="muted">Pendant</span><b>{d.mental_during ?? "—"}</b></div>
        <div className="row-between"><span className="muted">Après</span><b>{d.mental_after ?? "—"}</b></div>
      </div>
      {d.went_well && <div className="stack-sm"><div className="h3">Ce qui a bien marché</div><div style={{ whiteSpace: "pre-wrap" }}>{d.went_well}</div></div>}
      {d.change_next && <div className="stack-sm"><div className="h3">Ce que je change la prochaine fois</div><div style={{ whiteSpace: "pre-wrap" }}>{d.change_next}</div></div>}
    </div>
  );
}
