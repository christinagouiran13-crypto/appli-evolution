import type { JuniorMission } from "../lib/types";
import logo from "./logo-vert.svg";

// Fiche mission mise en page à partir du texte (même présentation que les PDF)
export function parseMission(m: JuniorMission) {
  const [label, ...rest] = m.title.split(" · ");
  const name = rest.join(" · ") || m.title;
  const lines = m.body.split("\n").map((l) => l.trim()).filter(Boolean);
  const steps: { title: string; when: string; text: string }[] = [];
  const intro: string[] = [];
  let send = "";
  for (const l of lines) {
    const step = l.match(/^\d+\.\s*(.+?)\s*\(([^)]+)\)\s*:\s*(.+)$/);
    if (step) steps.push({ title: step[1], when: step[2], text: step[3].charAt(0).toUpperCase() + step[3].slice(1) });
    else if (/^À m'envoyer/i.test(l)) send = l.replace(/^À m'envoyer[^:]*:\s*/i, "");
    else intro.push(l);
  }
  return { label: label.trim(), name: name.trim(), intro, steps, send };
}

const THEMES = ["Où j'en suis", "Mes objectifs", "Ma concentration", "Ma confiance en moi", "Mes émotions", "Mon plan d'action"];

export function MissionSheet({ m, index }: { m: JuniorMission; index: number }) {
  const p = parseMission(m);
  const next = THEMES[index + 1];
  return (
    <article className="mission-sheet">
      <header className="row-between" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8 }}><img src={logo} alt="" width={36} height={26} /><span className="eyebrow">Évolution Coaching · Junior 90</span></div>
        {THEMES[index] && <span className="small muted">Thème : {THEMES[index]}</span>}
      </header>
      <div className="stack-sm">
        <div className="eyebrow rose">{p.label}</div>
        <h1 className="h1">{p.name}</h1>
        {p.intro.map((t, i) => <p key={i} style={{ margin: 0 }}>{t}</p>)}
      </div>
      {p.steps.length > 0 && <h2 className="h2">Ta mission jusqu'à notre prochaine séance</h2>}
      <ol className="mission-steps">
        {p.steps.map((s, i) => (
          <li key={i}>
            <span className="num" aria-hidden="true">{i + 1}</span>
            <div className="stack-sm">
              <div className="h3">{s.title}</div>
              <div>{s.text}</div>
              <div className="small muted">Quand : {s.when.charAt(0).toUpperCase() + s.when.slice(1)}</div>
            </div>
          </li>
        ))}
      </ol>
      {p.send && (
        <div className="card-rose stack-sm">
          <div className="h3">À m'envoyer dans l'appli (onglet Messages) avant notre séance</div>
          <div>{p.send.charAt(0).toUpperCase() + p.send.slice(1)}</div>
        </div>
      )}
      <footer className="center small muted stack-sm">
        <div>{next ? `Prochaine séance : « ${next} ». ` : "Bravo, tu as terminé Junior 90 ! On fait le bilan ensemble. "}Une question ? Écris-moi, je suis là.</div>
        <div>Christina Gouiran · Évolution Coaching</div>
      </footer>
    </article>
  );
}
