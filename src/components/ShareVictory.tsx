import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal } from "./Modal";

// Publier une victoire dans le groupe en un clic
export function ShareVictory({ initial = "", onClose }: { initial?: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({ thread_rider_id: null, kind: "victory", body: text.trim() });
    setBusy(false);
    if (!error) setDone(true);
  };
  return (
    <Modal title="Partager une victoire" onClose={onClose}>
      {done ? (
        <>
          <div className="success">C'est publié dans le groupe Évolution. Bravo !</div>
          <button className="btn btn-block" onClick={onClose}>Fermer</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Une victoire mentale compte autant qu'un classement : un stress mieux géré, une routine tenue, un parcours fluide.</p>
          <label htmlFor="vic" className="sr-only">Ta victoire</label>
          <textarea id="vic" className="textarea" value={text} placeholder="Ex. : j'ai tenu ma routine du début à la fin !" onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-block" disabled={busy || !text.trim()} onClick={send}>Publier dans le groupe</button>
        </>
      )}
    </Modal>
  );
}
