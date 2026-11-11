import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { signedUrl } from "../../lib/storage";
import type { JuniorMission } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { MissionSheet } from "../../components/MissionSheet";
import { Icon } from "../../components/Icon";

export default function MissionPage() {
  const { id } = useParams();
  const [m, setM] = useState<JuniorMission | null>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    supabase.from("junior_missions").select("*").order("position").order("created_at").then(({ data }) => {
      const list = (data as JuniorMission[]) ?? [];
      const i = list.findIndex((x) => x.id === id);
      setIndex(Math.max(0, i));
      setM(list[i] ?? null);
    });
  }, [id]);
  if (!m) return <div className="loading">Chargement…</div>;
  return (
    <div className="page">
      <div className="no-print"><BackHeader /></div>
      <MissionSheet m={m} index={index} />
      <div className="row wrap no-print">
        <button className="btn btn-sm" onClick={() => window.print()}><Icon name="share" size={16} />Enregistrer en PDF ou imprimer</button>
        {m.pdf_path && (
          <button className="btn btn-sm btn-light" onClick={async () => { const u = await signedUrl("resources", m.pdf_path!); if (u) window.open(u, "_blank"); }}>Ouvrir le PDF de Christina</button>
        )}
      </div>
    </div>
  );
}
