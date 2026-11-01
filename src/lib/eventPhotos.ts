// Slike eventa — JEDINO mjesto koje ih upisuje u Storage + `event_attachments` i briše (S191).
//
// Do S191 je upload bio prepisan na tri mjesta (Add, Edit izmjena, Edit novi event) i sva tri su
// grešku GUTALA (`console.error`, Add još i `continue`): spremanje je javljalo uspjeh, a slike nije
// bilo. Ovdje greška ide pozivatelju, koji je mora reći naglas. Kartica kataloga (`CatalogPickerField`)
// je četvrti korisnik — zato funkcija, ne još jedna kopija.
//
// ⚠ Brisanje: PRVO zapis (broji retke — RLS-blokiran DELETE „uspije" s 0, S134), PA datoteka.
//   Obrnuto (kako je bilo u Editu) bi uz blokiran zapis ostavilo zapis koji pokazuje na obrisanu sliku.
import { supabase } from '@/lib/supabaseClient';
import type { PendingPhoto } from '@/types/activity';

const BUCKET = 'activity-attachments';

/** `…/object/public/activity-attachments/<put>` ⇒ `<put>`; `null` kad URL nije iz ovog bucketa. */
export function storagePathFromUrl(url: string): string | null {
  const parts = url.split(`/${BUCKET}/`);
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

/** Put datoteke: mapa = uploader (Storage politika), ime = event + lokalni id slike. */
export function photoStoragePath(uploaderId: string, eventId: string, photoId: string): string {
  return `${uploaderId}/${eventId}_${photoId}.jpg`;
}

/** `data:image/jpeg;base64,…` (ili goli base64) ⇒ JPEG blob. */
export function base64ToJpegBlob(base64: string): Blob {
  const data = base64.includes(',') ? base64.split(',')[1] : base64;
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

const msgOf = (e: unknown) => (e as { message?: string })?.message ?? String(e);

/** Upload + zapis. Baca s porukom; pad zapisa pokuša maknuti već uploadanu datoteku. */
export async function uploadEventPhoto(eventId: string, uploaderId: string, photo: PendingPhoto): Promise<void> {
  const path = photoStoragePath(uploaderId, eventId, photo.id);
  const up = await supabase.storage.from(BUCKET).upload(path, base64ToJpegBlob(photo.base64));
  if (up.error) throw new Error(`„${photo.filename}": upload — ${msgOf(up.error)}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const ins = await supabase.from('event_attachments').insert({
    event_id: eventId,
    user_id: uploaderId,
    type: 'image',
    url: urlData.publicUrl,
    filename: photo.filename,
    size_bytes: photo.sizeBytes,
  }).select('id');
  if (ins.error || !ins.data?.length) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`„${photo.filename}": zapis — ${ins.error ? msgOf(ins.error) : 'nemaš pravo dodati sliku'}`);
  }
}

/** Briše zapis pa datoteku. Baca kad zapis nije obrisan; neuspjelo brisanje datoteke samo ostavi siroče. */
export async function deleteEventPhoto(attachmentId: string): Promise<void> {
  const del = await supabase.from('event_attachments').delete().eq('id', attachmentId).select('url');
  if (del.error) throw new Error(`brisanje slike — ${msgOf(del.error)}`);
  if (!del.data?.length) throw new Error('brisanje slike — nemaš pravo (ništa nije obrisano)');
  const path = storagePathFromUrl((del.data[0] as { url: string }).url);
  if (path) {
    const rm = await supabase.storage.from(BUCKET).remove([path]);
    if (rm.error) console.warn('Slika obrisana iz zapisa, datoteka ostala u Storageu:', path, rm.error);
  }
}

export interface PhotoChangesResult {
  /** Lokalni id-evi novih slika koje su spremljene. */
  added: string[];
  /** Id-evi zapisa koji su obrisani. */
  removed: string[];
  /** Poruke za sve što nije uspjelo — pozivatelj ih mora pokazati. */
  failed: string[];
}

/** Brisanja pa dodavanja za jedan event; ne baca — uspjeh i pad po slici, da se neuspjelo da ponoviti. */
export async function savePhotoChanges(
  eventId: string,
  uploaderId: string,
  add: PendingPhoto[],
  remove: string[],
): Promise<PhotoChangesResult> {
  const out: PhotoChangesResult = { added: [], removed: [], failed: [] };
  for (const id of remove) {
    try { await deleteEventPhoto(id); out.removed.push(id); } catch (e) { out.failed.push(msgOf(e)); }
  }
  for (const p of add) {
    try { await uploadEventPhoto(eventId, uploaderId, p); out.added.push(p.id); } catch (e) { out.failed.push(msgOf(e)); }
  }
  return out;
}

/** Jedna rečenica za toast / grešku. */
export function photoFailuresMessage(failed: string[]): string | null {
  if (failed.length === 0) return null;
  return `Slike: ${failed.length} nije spremljeno — ${failed.join('; ')}`;
}
