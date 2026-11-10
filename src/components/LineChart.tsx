// Courbe simple des notes semaine après semaine (1 à 10)
export type Series = { label: string; color: string; values: (number | null)[]; dashed?: boolean };

export function LineChart({ labels, series, height = 180 }: { labels: string[]; series: Series[]; height?: number }) {
  const W = 340, H = height, padL = 24, padR = 10, padT = 10, padB = 24;
  const n = Math.max(labels.length, 1);
  const x = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + ((10 - v) * (H - padT - padB)) / 9;
  const step = Math.ceil(n / 6);
  return (
    <div className="stack-sm">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={series.map((s) => `${s.label} : ${s.values.filter((v) => v != null).join(", ")}`).join(". ")}>
        {[1, 4, 7, 10].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#E3EEE9" />
            <text x={padL - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#5B6F68">{v}</text>
          </g>
        ))}
        {labels.map((l, i) => i % step === 0 && (
          <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#5B6F68">{l}</text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.label}>
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}
