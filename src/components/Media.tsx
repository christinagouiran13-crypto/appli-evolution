import { useEffect, useState } from "react";
import { signedUrl } from "../lib/storage";

export function useSigned(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    if (path) signedUrl(bucket, path).then((u) => ok && setUrl(u));
    return () => { ok = false; };
  }, [bucket, path]);
  return url;
}

export function SignedImage({ path, alt = "Photo" }: { path: string; alt?: string }) {
  const url = useSigned("chat", path);
  if (!url) return <div style={{ width: 200, height: 150, borderRadius: 12, background: "#EEF1EF" }} />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  );
}

export function SignedAudio({ bucket = "chat", path }: { bucket?: string; path: string }) {
  const url = useSigned(bucket, path);
  if (!url) return <div className="small muted">Chargement de l'audio…</div>;
  return <audio controls preload="metadata" src={url} />;
}
