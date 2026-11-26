import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, X, Check, UserRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { functionError } from "./studio-utils";
import { MAX_CHARACTER_IMAGES } from "../../../supabase/functions/_shared/ugc-characters";

interface SavedCharacter { id: string; name: string; imagePaths: string[]; imageUrls: string[] }
interface Reference { path: string; url: string }
interface Props { value?: string | null; onChange: (id: string | null) => void; disabled?: boolean }

export default function CharacterPicker({ value, onChange, disabled }: Props) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const pendingPaths = useRef<string[]>([]);
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const { data, error } = await supabase.functions.invoke("ugc-studio", { body: { action: "characters-list" } });
      if (error || data?.error) throw new Error(await functionError(error, data));
      setCharacters(data.characters);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Could not load characters."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user?.id, load]);

  function start(character?: SavedCharacter) {
    setEditing(character?.id); setName(character?.name || "");
    setReferences(character?.imagePaths.map((path, i) => ({ path, url: character.imageUrls[i] })) || []);
    pendingPaths.current = []; setError(""); setOpen(true);
  }
  async function close() {
    if (lock.current) return;
    setOpen(false);
    const unused = pendingPaths.current; pendingPaths.current = [];
    if (unused.length) await supabase.storage.from("character-references").remove(unused);
  }
  async function upload(files: FileList | null) {
    if (!files || !user || lock.current) return;
    const selected = Array.from(files);
    if (references.length + selected.length > MAX_CHARACTER_IMAGES) { setError("Maximum 3 photos per character. Remove a photo before adding another."); return; }
    if (selected.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)) { setError("Use PNG, JPG, or WEBP photos up to 10 MB each."); return; }
    lock.current = true; setUploading(true); setError("");
    const added: Reference[] = [];
    try {
      for (const file of selected) {
        const path = `${user.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
        const { error } = await supabase.storage.from("character-references").upload(path, file);
        if (error) throw error;
        pendingPaths.current.push(path);
        const { data, error: signedError } = await supabase.storage.from("character-references").createSignedUrl(path, 3600);
        if (signedError || !data) throw new Error("Could not preview the uploaded photo.");
        added.push({ path, url: data.signedUrl });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setReferences(old => [...old, ...added]); setUploading(false); lock.current = false; }
  }
  async function save() {
    if (lock.current || !name.trim() || !references.length) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("ugc-studio", { body: { action: "character-save", id: editing, name, imagePaths: references.map(ref => ref.path) } });
      if (error || data?.error) throw new Error(await functionError(error, data));
      const unused = pendingPaths.current.filter(path => !references.some(ref => ref.path === path));
      pendingPaths.current = [];
      if (unused.length) await supabase.storage.from("character-references").remove(unused);
      onChange(data.id); setOpen(false); await load(); toast.success(editing ? "Character updated" : "Character saved and selected");
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); lock.current = false; }
  }
  async function remove(character: SavedCharacter) {
    if (lock.current || !window.confirm(`Delete “${character.name}” from your saved characters? Existing ads will stay in your Library.`)) return;
    lock.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ugc-studio", { body: { action: "character-delete", id: character.id } });
      if (error || data?.error) throw new Error(await functionError(error, data));
      if (value === character.id) onChange(null);
      await load(); toast.success("Character deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed."); }
    finally { setBusy(false); lock.current = false; }
  }
  const blocked = disabled || busy || uploading;
  return <section className="space-y-4 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg">Reusable characters</h3><Button variant="outline" disabled={blocked} onClick={() => start()}><Plus className="mr-2 h-4 w-4" />Add character</Button></div>
    <div className="flex flex-wrap gap-2"><Button variant={!value ? "secondary" : "outline"} disabled={blocked} onClick={() => onChange(null)}><UserRound className="mr-2 h-4 w-4" />New creator</Button>{value && <span className="self-center text-xs text-muted-foreground">Saved character selected</span>}</div>
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading characters…</p>}
    {loadError && <div role="alert" className="text-sm text-destructive">{loadError}<Button variant="ghost" onClick={() => void load()}>Retry</Button></div>}
    {!loading && !loadError && !characters.length && <p className="text-sm text-muted-foreground">No saved characters yet.</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {characters.map(character => <article key={character.id} className={`min-w-0 overflow-hidden rounded-lg border bg-card ${value === character.id ? "border-primary" : "border-border"}`}>
        <Button variant="ghost" disabled={blocked} className="h-auto w-full flex-col items-stretch gap-3 rounded-none p-3" aria-pressed={value === character.id} aria-label={`Use character ${character.name}`} onClick={() => onChange(character.id)}>
          <div className="grid grid-cols-3 gap-1">{[0,1,2].map(i => <div key={i} className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-secondary">{character.imageUrls[i] ? <img src={character.imageUrls[i]} alt={`${character.name}, reference ${i+1}`} className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5 text-muted-foreground" />}</div>)}</div>
          <div className="flex min-w-0 items-center justify-between gap-2 text-left"><span className="min-w-0 break-words whitespace-normal">{character.name}</span>{value === character.id && <Check className="h-4 w-4 shrink-0 text-primary" />}</div>
        </Button>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2"><span className="text-xs text-muted-foreground">{character.imagePaths.length}/3 photos</span><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={blocked} aria-label={`Edit character ${character.name}`} title="Edit character" onClick={() => start(character)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={blocked} aria-label={`Delete character ${character.name}`} title="Delete character" onClick={() => void remove(character)}><Trash2 className="h-4 w-4" /></Button></div></div>
      </article>)}
    </div>
    <Dialog open={open} onOpenChange={next => { if (!next) void close(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" aria-describedby="character-photo-limits">
      <DialogHeader><DialogTitle>{editing ? "Edit character" : "New reusable character"}</DialogTitle></DialogHeader>
      <div className="space-y-2"><Label htmlFor="character-name">Character name</Label><Input id="character-name" value={name} maxLength={100} disabled={busy || uploading} onChange={e => setName(e.target.value)} /></div>
      <div className="flex items-center justify-between"><Label>Character sheet</Label><span className="text-xs text-muted-foreground">{references.length}/3 photos</span></div>
      <div className="grid grid-cols-3 gap-3">{references.map((ref, i) => <div key={ref.path} className="min-w-0"><div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-secondary"><img src={ref.url} alt={`Character reference ${i+1}`} className="h-full w-full object-cover" /><Button size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" title="Remove reference" aria-label={`Remove character photo ${i+1}`} disabled={busy || uploading} onClick={() => setReferences(old => old.filter(item => item.path !== ref.path))}><X className="h-3 w-3" /></Button></div><p className="mt-2 text-xs text-muted-foreground">Reference {i+1}</p></div>)}{references.length < MAX_CHARACTER_IMAGES && <label className="relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 text-center"><Upload className="h-5 w-5 text-primary" /><span className="text-xs">{uploading ? "Uploading…" : "Add photos"}</span><input type="file" aria-label="Upload character photos" accept="image/png,image/jpeg,image/webp" multiple disabled={busy || uploading} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={e => { void upload(e.target.files); e.target.value = ""; }} /></label>}</div>
      <p id="character-photo-limits" className="text-xs text-muted-foreground">1–3 photos of the same person, from different angles · PNG, JPG, WEBP · 10 MB each · private to your account</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy || uploading} onClick={() => void close()}>Cancel</Button><Button disabled={busy || uploading || !name.trim() || !references.length} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save character</Button></div>
    </DialogContent></Dialog>
  </section>;
}