import { useEffect, useRef, useState } from "react";

const SPEEDS = [1, 1.5, 2];
const KEY = "evolution-audio-speed";

function readSpeed() {
  try { const v = Number(localStorage.getItem(KEY)); return SPEEDS.includes(v) ? v : 1; } catch { return 1; }
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Lecteur audio avec vitesse 1× / 1,5× / 2× (comme WhatsApp)
export function AudioPlayer({ src, compact }: { src: string; compact?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(readSpeed);

  // La vitesse choisie s'applique à tous les lecteurs ouverts
  useEffect(() => {
    const on = (e: Event) => setSpeed((e as CustomEvent<number>).detail);
    window.addEventListener("evolution-audio-speed", on);
    return () => window.removeEventListener("evolution-audio-speed", on);
  }, []);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.playbackRate = speed;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [speed]);

  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      // Un seul audio à la fois
      document.querySelectorAll("audio").forEach((x) => { if (x !== a) x.pause(); });
      a.playbackRate = speed;
      await a.play().catch(() => undefined);
    } else a.pause();
  };

  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    try { localStorage.setItem(KEY, String(s)); } catch { /* rien */ }
    window.dispatchEvent(new CustomEvent("evolution-audio-speed", { detail: s }));
  };

  return (
    <div className="audio-player" style={compact ? undefined : { width: "100%" }}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); e.currentTarget.playbackRate = speed; }}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
      />
      <button type="button" className="ap-play" onClick={toggle} aria-label={playing ? "Pause" : "Écouter"}>
        {playing
          ? <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
      </button>
      <input
        type="range" className="ap-bar" min={0} max={isFinite(dur) && dur > 0 ? dur : 0} step={0.1} value={time}
        aria-label="Position dans l'audio"
        onChange={(e) => { const a = ref.current; if (a) { a.currentTime = Number(e.target.value); setTime(a.currentTime); } }}
      />
      <span className="ap-time">{fmt(playing || time > 0 ? time : dur)}</span>
      <button type="button" className="ap-speed" onClick={nextSpeed} aria-label={`Vitesse de lecture : ${speed} fois. Toucher pour changer.`}>
        {String(speed).replace(".", ",")}×
      </button>
    </div>
  );
}

