import type { Feedback, Profile } from "../lib/types";
import { FEEDBACK_QUESTIONS } from "../lib/text";
import { fmtDate, relativeDay } from "../lib/dates";

export function FeedbackDetails({ f, p }: { f: Feedback; p: Pick<Profile, "gender"> }) {
  return (
    <div className="stack">
      <div className="row-between wrap">
        <div className="h3">Feedback · {f.title || "Concours"} · {fmtDate(f.date)}</div>
        {f.coach_read_at && <span className="tag tag-vert">Lu par Christina {relativeDay(f.coach_read_at)}</span>}
      </div>
      {FEEDBACK_QUESTIONS.map((q, i) => f.answers[q.key] ? (
        <div key={q.key} className="stack-sm">
          <div className="small bold">{i + 1}. {p.gender === "m" ? q.m : q.f}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{f.answers[q.key]}</div>
        </div>
      ) : null)}
    </div>
  );
}
