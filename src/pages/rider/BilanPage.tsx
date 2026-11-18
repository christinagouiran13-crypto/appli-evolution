import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import type { Profile } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Bilan } from "../../components/Bilan";
import { Parcours } from "../../components/Parcours";

// Bilan de la cavalière connectée (ou, pour la coach, d'une cavalière : /coach/bilan/:id)
export default function BilanPage() {
  const { me, settings } = useMe();
  const { id } = useParams();
  const [p, setP] = useState<Profile | null>(id ? null : me);
  useEffect(() => {
    if (id) supabase.from("profiles").select("*").eq("id", id).single().then(({ data }) => setP(data as Profile));
  }, [id]);
  if (!p) return <div className="loading">Chargement…</div>;
  return (
    <div className={id ? "stack-lg" : "page"} style={id ? { maxWidth: 720 } : undefined}>
      <BackHeader />
      <h1 className="h1">{id ? `Bilan de ${p.first_name}` : "Mon bilan"}</h1>
      <Bilan p={p} settings={settings} />
      {!id && <Parcours />}
    </div>
  );
}
