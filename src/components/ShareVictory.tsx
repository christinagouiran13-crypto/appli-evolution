import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { compressImage, newId, upload } from "../lib/storage";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

// Publier une victoire dans le groupe (et sur le mur des victoires), avec photo si on veut
export function ShareVictory({ initial = "", onClose }: { initial?: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = async () => {
    if (!text.trim() && !photo) return;
    setBusy(true); setErr(null);
    try {
      let image_path: string | null = null;
      if (photo) {
        const blob = await compressImage(photo);
        image_path = `group/${newId()}.jpg`;
        await upload("chat", image_path, blob, "image/jpeg");
      }
      const { error } = await supabase.from("messages").insert({ thread_rider_id: null, kind: "victory", body: text.trim() || null, image_path });
      if (error) throw error;
      setDone(true);
    } catch {
      setErr("La victoire n'a pas pu être publiée. Réessaie.");
    }
    setBusy(false);
  };
  return (
    <Modal title="Partager une victoire" onClose={onClose}>
      {done ? (
        <>
          <div className="success">C'est publié dans l'Équipe Évolution et sur le mur des victoires. Bravo !</div>
          <button className="btn btn-block" onClick={onClose}>Fermer</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Une victoire mentale compte autant qu'un classement : un stress mieux géré, une routine tenue, un parcours fluide.</p>
          <label htmlFor="vic" className="sr-only">Ta victoire</label>
          <textarea id="vic" className="textarea" value={text} placeholder="Ex. : j'ai tenu ma routine du début à la fin !" onChange={(e) => setText(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={16} />{photo ? `Photo : ${photo.name}` : "Ajouter une photo (facultatif)"}
          </button>
          {err && <div className="error">{err}</div>}
          <button className="btn btn-block" disabled={busy || (!text.trim() && !photo)} onClick={send}>{busy ? "Publication…" : "Publier"}</button>
        </>
      )}
    </Modal>
  );
}
