import { useEffect, useState } from "react";
import { signedUrl } from "../lib/storage";

export function Avatar({ path, name, size = 40 }: { path: string | null | undefined; name: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    if (path) signedUrl("avatars", path).then((u) => ok && setUrl(u));
    else setUrl(null);
    return () => { ok = false; };
  }, [path]);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {url ? <img src={url} alt="" /> : (name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
