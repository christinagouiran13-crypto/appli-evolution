import { supabase } from "./supabase";

const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(bucket: string, path: string) {
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function upload(bucket: string, path: string, file: Blob, contentType?: string) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: contentType ?? file.type,
    upsert: true,
  });
  if (error) throw error;
  cache.delete(`${bucket}/${path}`);
  return path;
}

// Réduit une photo avant l'envoi (plus rapide, moins de stockage)
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("compression"))), "image/jpeg", quality),
    );
  } catch {
    return file;
  }
}

export function newId() {
  return crypto.randomUUID();
}
