import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import type { Debrief } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { DebriefDetails } from "../../components/DebriefDetails";

export default function DebriefView() {
  const { id } = useParams();
  const [d, setD] = useState<Debrief | null>(null);
  useEffect(() => {
    supabase.from("debriefs").select("*").eq("id", id).single().then(({ data }) => setD(data as Debrief));
  }, [id]);
  if (!d) return <div className="loading">Chargement…</div>;
  return (
    <div className="page">
      <BackHeader label={fmtDate(d.date)} />
      <h1 className="h1">{d.title || (d.kind === "cours" ? "Débrief de cours" : "Débrief de concours")}</h1>
      <DebriefDetails d={d} />
    </div>
  );
}
