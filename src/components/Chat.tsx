import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { compressImage, newId, upload } from "../lib/storage";
import { fmtDate, fmtTime, todayISO } from "../lib/dates";
import type { Member, Message } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { SignedAudio, SignedImage, SignedVideo } from "./Media";

const PAGE = 150;

export function threadKey(thread: string | null) {
  return thread ?? "group";
}

export async function markRead(thread: string | null) {
  await supabase.from("read_state").upsert({ thread: threadKey(thread), last_read_at: new Date().toISOString() });
}

let directoryCache: Map<string, Member> | null = null;
async function loadDirectory() {
  if (directoryCache) return directoryCache;
  const { data } = await supabase.from("member_directory").select("*");
  directoryCache = new Map((data as Member[] | null ?? []).map((m) => [m.id, m]));
  return directoryCache;
}

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

// Enregistrement d'un message vocal
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const started = useRef(0);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.start();
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 500);
  };

  const stop = () => new Promise<{ blob: Blob; seconds: number } | null>((resolve) => {
    const r = rec.current;
    if (timer.current) window.clearInterval(timer.current);
    setRecording(false);
    if (!r) return resolve(null);
    r.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: r.mimeType || "audio/mp4" });
      resolve({ blob, seconds: Math.round((Date.now() - started.current) / 1000) });
    };
    r.stop();
    rec.current = null;
  });

  const cancel = async () => { await stop(); };
  return { recording, seconds, start, stop, cancel };
}

type Props = {
  thread: string | null;   // null = groupe Évolution ; sinon identifiant de la cavalière
  readOnly?: boolean;
  readOnlyText?: string;
  header?: React.ReactNode;
  className?: string;
};

export function Chat({ thread, readOnly, readOnlyText, header, className }: Props) {
  const { profile: me } = useAuth();
  const isCoach = me?.role === "coach";
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [dir, setDir] = useState<Map<string, Member>>(new Map());
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);
  const recorder = useRecorder();

  const belongs = useCallback((m: Message) => (thread === null ? m.thread_rider_id === null : m.thread_rider_id === thread), [thread]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsgs([]);
    (async () => {
      let q = supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(PAGE);
      q = thread === null ? q.is("thread_rider_id", null) : q.eq("thread_rider_id", thread);
      const [{ data }, d] = await Promise.all([q, loadDirectory()]);
      if (!alive) return;
      setDir(d);
      setMsgs(((data as Message[]) ?? []).reverse());
      setLoading(false);
      markRead(thread);
    })();

    const channel = supabase
      .channel(`chat-${threadKey(thread)}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
        if (payload.eventType === "DELETE") {
          setMsgs((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
          return;
        }
        const m = payload.new as Message;
        if (!belongs(m)) return;
        if (m.sender_id && !directoryCache?.has(m.sender_id)) {
          directoryCache = null;
          const d = await loadDirectory();
          setDir(new Map(d));
        }
        setMsgs((prev) => {
          if (payload.eventType === "UPDATE") {
            return prev.map((x) => (x.id === m.id ? m : m.pinned && x.pinned && x.thread_rider_id === null ? { ...x, pinned: false } : x));
          }
          return prev.some((x) => x.id === m.id) ? prev : [...prev, m];
        });
        markRead(thread);
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") catchUp(); });

    // Filet de sécurité : si un message temps réel se perd (réseau mobile), on rattrape
    async function catchUp() {
      let q = supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(50);
      q = thread === null ? q.is("thread_rider_id", null) : q.eq("thread_rider_id", thread);
      const { data } = await q;
      if (!alive || !data) return;
      const fresh = (data as Message[]).reverse();
      setMsgs((prev) => {
        if (prev.length === 0) return fresh;
        const ids = new Set(prev.map((m) => m.id));
        const add = fresh.filter((m) => !ids.has(m.id) && m.created_at >= prev[0].created_at);
        if (add.length === 0) return prev;
        return [...prev, ...add].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
    const onVisible = () => document.visibilityState === "visible" && catchUp();
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(catchUp, 20000);
    return () => {
      alive = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
    };
  }, [thread, belongs]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function insert(fields: Partial<Message>) {
    const { data, error: err } = await supabase.from("messages")
      .insert({ thread_rider_id: thread, ...fields }).select().single();
    if (err) throw err;
    atBottom.current = true;
    setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  }

  async function sendText() {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setError(null);
    try {
      await insert({ body });
      setText("");
    } catch {
      setError("Le message n'est pas parti. Vérifie ta connexion et réessaie.");
    } finally { setBusy(false); }
  }

  async function sendVideo(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setError("Cette vidéo est trop lourde (50 Mo maximum). Coupe-la pour garder le passage important, puis renvoie-la.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${threadKey(thread)}/${newId()}.${ext}`;
      await upload("chat", path, file, file.type || "video/mp4");
      await insert({ video_path: path, body: text.trim() || null });
      setText("");
    } catch {
      setError("La vidéo n'a pas pu être envoyée. Vérifie ta connexion (le Wi-Fi est conseillé).");
    } finally { setBusy(false); }
  }

  async function sendPhoto(file: File) {
    if (file.type.startsWith("video/")) return sendVideo(file);
    setBusy(true); setError(null);
    try {
      const blob = await compressImage(file);
      const path = `${threadKey(thread)}/${newId()}.jpg`;
      await upload("chat", path, blob, "image/jpeg");
      await insert({ image_path: path, body: text.trim() || null });
      setText("");
    } catch {
      setError("La photo n'a pas pu être envoyée.");
    } finally { setBusy(false); }
  }

  async function toggleRecord() {
    setError(null);
    if (!recorder.recording) {
      try { await recorder.start(); } catch { setError("Autorise le micro pour envoyer un message vocal."); }
      return;
    }
    const res = await recorder.stop();
    if (!res || res.seconds < 1) return;
    setBusy(true);
    try {
      const ext = res.blob.type.includes("webm") ? "webm" : "m4a";
      const path = `${threadKey(thread)}/${newId()}.${ext}`;
      await upload("chat", path, res.blob, res.blob.type);
      await insert({ audio_path: path, audio_seconds: res.seconds });
    } catch {
      setError("Le vocal n'a pas pu être envoyé.");
    } finally { setBusy(false); }
  }

  async function togglePin(m: Message) {
    await supabase.from("messages").update({ pinned: !m.pinned }).eq("id", m.id);
    setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !m.pinned } : m.pinned ? x : { ...x, pinned: false })));
    setSelected(null);
  }

  async function remove(m: Message) {
    if (!confirm("Supprimer ce message ?")) return;
    await supabase.from("messages").delete().eq("id", m.id);
    setMsgs((prev) => prev.filter((x) => x.id !== m.id));
    setSelected(null);
  }

  const pinned = thread === null ? msgs.filter((m) => m.pinned).slice(-1)[0] : undefined;
  let lastDay = "";

  return (
    <div className={className}>
      {header}
      {pinned && (
        <div style={{ padding: "0 16px 8px" }}>
          <div className="pinned"><Icon name="pin" size={18} /><div><b>Épinglé par Christina · </b>{pinned.body ?? "Photo"}</div></div>
        </div>
      )}
      <div className="chat-body" ref={bodyRef} onScroll={onScroll} aria-live="polite">
        {loading && <div className="loading">Chargement…</div>}
        {!loading && msgs.length === 0 && (
          <div className="empty">{thread === null ? "Le groupe démarre ici. Dis bonjour !" : "Aucun message pour l'instant."}</div>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === me?.id;
          const sender = m.sender_id ? dir.get(m.sender_id) : undefined;
          const fromCoach = sender?.role === "coach";
          const d = dayKey(m.created_at);
          const sep = d !== lastDay ? (lastDay = d, true) : false;
          const canAct = isCoach || mine;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {sep && <div className="day-sep">{d === todayISO() ? "Aujourd'hui" : fmtDate(m.created_at, { weekday: "long", day: "numeric", month: "long" })}</div>}
              <div className={`bubble-wrap ${mine ? "me" : "them"} ${fromCoach ? "from-coach" : ""}`}>
                {!mine && thread === null && (
                  <div className="row" style={{ gap: 6 }}>
                    <Avatar path={sender?.avatar_path} name={sender?.first_name ?? "?"} size={20} />
                    <span className="who">{sender?.first_name ?? "Ancienne cliente"}{fromCoach ? " · coach" : ""}</span>
                  </div>
                )}
                <div
                  className={`bubble ${m.kind === "victory" ? "victory" : ""} ${m.kind === "urgent" ? "urgent" : ""}`}
                  onClick={() => canAct && setSelected(selected === m.id ? null : m.id)}
                >
                  {m.kind === "victory" && <div className="tiny bold" style={{ marginBottom: 4 }}>🏆 Victoire partagée</div>}
                  {m.kind === "urgent" && <div className="tiny bold" style={{ marginBottom: 4 }}>🚨 URGENCE</div>}
                  {m.image_path && <SignedImage path={m.image_path} />}
                  {m.video_path && <SignedVideo path={m.video_path} />}
                  {m.audio_path && <SignedAudio path={m.audio_path} />}
                  {m.body && <div style={{ marginTop: m.image_path || m.video_path ? 6 : 0 }}>{m.body}</div>}
                </div>
                <div className="when">
                  {fmtTime(m.created_at)}
                  {isCoach && m.kind === "auto" && " · message automatique"}
                  {m.pinned && " · épinglé"}
                </div>
                {selected === m.id && (
                  <div className="row" style={{ gap: 6 }}>
                    {isCoach && thread === null && (
                      <button className="btn btn-sm btn-light" onClick={() => togglePin(m)}>
                        <Icon name="pin" size={16} />{m.pinned ? "Désépingler" : "Épingler"}
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(m)}><Icon name="trash" size={16} />Supprimer</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {busy && <div className="hint" style={{ margin: "0 16px 6px" }} aria-live="polite">Envoi en cours… garde l'appli ouverte.</div>}
      {error && <div className="error" style={{ margin: "0 12px 8px" }}>{error}</div>}
      {readOnly ? (
        <div className="chat-foot"><div className="hint" style={{ padding: 8 }}>{readOnlyText ?? "Cette conversation est en lecture seule."}</div></div>
      ) : (
        <div className="chat-foot">
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendPhoto(f);
            e.target.value = "";
          }} />
          {!recorder.recording && (
            <button className="icon-btn" aria-label="Envoyer une photo ou une vidéo" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="image" size={20} />
            </button>
          )}
          {recorder.recording ? (
            <div className="grow row" style={{ minHeight: 44, padding: "0 12px" }}>
              <span className="bold">Enregistrement… {recorder.seconds} s</span>
              <button className="btn-ghost btn" onClick={() => recorder.cancel()}>Annuler</button>
            </div>
          ) : (
            <>
              <label htmlFor={`msg-${threadKey(thread)}`} className="sr-only">Ton message</label>
              <textarea
                id={`msg-${threadKey(thread)}`}
                className="input grow"
                rows={1}
                placeholder="Écris ton message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                    e.preventDefault();
                    sendText();
                  }
                }}
              />
            </>
          )}
          {text.trim() && !recorder.recording ? (
            <button className="icon-btn solid" aria-label="Envoyer" onClick={sendText} disabled={busy}>
              <Icon name="send" size={18} stroke={2} />
            </button>
          ) : (
            <button className={`icon-btn ${recorder.recording ? "rec" : "solid"}`} disabled={busy}
              aria-label={recorder.recording ? "Envoyer le vocal" : "Enregistrer un message vocal"} onClick={toggleRecord}>
              <Icon name={recorder.recording ? "send" : "mic"} size={18} stroke={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
