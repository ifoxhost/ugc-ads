import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, RefreshCw, Sparkles, Film, Music2,
  ImageIcon, AlertTriangle, Check, Wand2, Save, Download, Play, Pause, Eye,
  Lock, Unlock,
} from "lucide-react";

interface Props {
  ad: any;
  onClose: () => void;
  onSave?: (updatedAd: any) => void;
}

type ScenePromptFields = {
  story?: string; camera?: string; environment?: string;
  colorGrading?: string; vfx?: string;
};

type Scene = {
  id: string;
  ad_id: string;
  index: number;
  lyric_lines: string[] | null;
  start_sec: number;
  end_sec: number;
  image_url: string | null;
  image_status: "pending" | "generating" | "ready" | "failed" | string;
  prompt: ScenePromptFields & Record<string, unknown>;
  error_message?: string | null;
  regen_count?: number;
  locked: boolean;
};

const TERMINAL_VIDEO_STATUSES = new Set(["completed", "failed"]);

export default function StoryboardManager({ ad, onClose, onSave }: Props) {
  const { toast } = useToast();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [stitchBusy, setStitchBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adState, setAdState] = useState<any>(ad);

  const videoUrl: string | null = adState?.generated_video_url ?? null;
  const videoStatus: string = adState?.video_status ?? "idle";
  const videoProgress: number = adState?.video_progress ?? 0;
  const audioUrl: string | null =
    adState?.ad_copy?.audioFileUrl ?? adState?.ad_copy?.audioUrl ?? null;

  const songTitle = adState?.ad_copy?.title ?? "Untitled";
  const artist = adState?.ad_copy?.artist ?? "";

  const fetchScenes = useCallback(async () => {
    const { data, error } = await supabase
      .from("video_scenes")
      .select("*")
      .eq("ad_id", ad.id)
      .order("index", { ascending: true });
    if (error) {
      toast({ title: "Failed to load scenes", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setScenes(
      (data ?? []).map((s: any) => ({
        ...s,
        prompt: (s.prompt ?? {}) as ScenePromptFields,
        lyric_lines: s.lyric_lines ?? [],
      })),
    );
    setLoading(false);
  }, [ad.id, toast]);

  const fetchAd = useCallback(async () => {
    const { data } = await supabase
      .from("generated_ads")
      .select("*")
      .eq("id", ad.id)
      .maybeSingle();
    if (data) setAdState(data);
  }, [ad.id]);

  useEffect(() => {
    fetchScenes();
    fetchAd();
  }, [fetchScenes, fetchAd]);

  // Realtime: keep scenes & ad in sync while the user works.
  useEffect(() => {
    const channel = supabase
      .channel(`storyboard-${ad.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_scenes", filter: `ad_id=eq.${ad.id}` },
        (payload: any) => {
          setScenes((prev) => {
            const next = [...prev];
            const idx = next.findIndex((s) => s.id === payload.new?.id);
            if (payload.eventType === "DELETE") {
              return next.filter((s) => s.id !== payload.old?.id);
            }
            const merged = { ...(payload.new ?? {}), prompt: payload.new?.prompt ?? {} } as Scene;
            if (idx >= 0) next[idx] = { ...next[idx], ...merged };
            else next.push(merged);
            return next.sort((a, b) => a.index - b.index);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "generated_ads", filter: `id=eq.${ad.id}` },
        (payload: any) => setAdState((cur: any) => ({ ...cur, ...payload.new })),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ad.id]);

  const unlockedScenes = useMemo(() => scenes.filter((s) => !s.locked), [scenes]);
  const missingScenes = useMemo(
    () => unlockedScenes.filter((s) => s.image_status !== "ready" || !s.image_url),
    [unlockedScenes],
  );
  const readyCount = unlockedScenes.length - missingScenes.length;

  const allReady = unlockedScenes.length > 0 && missingScenes.length === 0;
  const isRendering = videoStatus === "processing" || renderBusy;

  // ── Mutations ────────────────────────────────────────────────────────────
  const markBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  const regenScene = async (scene: Scene) => {
    markBusy(scene.id, true);
    try {
      const { error } = await supabase.functions.invoke("regenerate-scene-image", {
        body: { sceneId: scene.id },
      });
      if (error) throw error;
      toast({ title: `Scene ${scene.index + 1} regenerating`, description: "Image will refresh when ready." });
    } catch (e: any) {
      toast({ title: "Regeneration failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      markBusy(scene.id, false);
    }
  };

  const bulkGenerateMissing = async () => {
    if (missingScenes.length === 0) {
      toast({ title: "Nothing to generate", description: "All scenes already have images." });
      return;
    }
    setBulkBusy(true);
    try {
      // Mark them pending so the UI shows progress immediately.
      await supabase
        .from("video_scenes")
        .update({ image_status: "pending", error_message: null, failed_step: null })
        .in("id", missingScenes.map((s) => s.id));

      // Kick each scene through regenerate-scene-image in small batches.
      const concurrency = 2;
      let cursor = 0;
      const queue = [...missingScenes];
      const runNext = async () => {
        while (cursor < queue.length) {
          const s = queue[cursor++];
          try {
            await supabase.functions.invoke("regenerate-scene-image", { body: { sceneId: s.id } });
          } catch (e) {
            console.warn("bulk regen failed for", s.id, e);
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, runNext));
      toast({
        title: "Bulk generation started",
        description: `Generating ${missingScenes.length} scene image${missingScenes.length === 1 ? "" : "s"}.`,
      });
    } catch (e: any) {
      toast({ title: "Bulk generate failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  };

  const updateScene = (id: string, patch: Partial<Scene>) =>
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updatePromptField = (id: string, field: keyof ScenePromptFields, value: string) =>
    setScenes((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, prompt: { ...(s.prompt ?? {}), [field]: value } } : s,
      ),
    );

  const toggleSceneLock = async (scene: Scene) => {
    const nextLocked = !scene.locked;
    try {
      const { error } = await supabase
        .from("video_scenes")
        .update({ locked: nextLocked })
        .eq("id", scene.id);
      if (error) throw error;
      updateScene(scene.id, { locked: nextLocked });
      toast({
        title: nextLocked ? `Scene ${scene.index + 1} locked` : `Scene ${scene.index + 1} unlocked`,
        description: nextLocked ? "Excluded from bulk generate and stitching." : "Included in workflows.",
      });
    } catch (e: any) {
      toast({ title: "Lock toggle failed", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const saveScene = async (scene: Scene) => {
    setSavingId(scene.id);
    try {
      const { error } = await supabase
        .from("video_scenes")
        .update({
          prompt: scene.prompt,
          start_sec: Number(scene.start_sec) || 0,
          end_sec: Number(scene.end_sec) || 0,
          image_url: scene.image_url,
          locked: scene.locked,
        })
        .eq("id", scene.id);
      if (error) throw error;
      toast({ title: "Scene saved", description: `Scene ${scene.index + 1} updated.` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const saveAndRegenScene = async (scene: Scene) => {
    await saveScene(scene);
    await regenScene(scene);
  };

  const renderClips = async () => {
    if (!allReady) {
      toast({
        title: "Storyboard incomplete",
        description: "Generate images for every scene before rendering clips.",
        variant: "destructive",
      });
      return;
    }
    setRenderBusy(true);
    try {
      const { error } = await supabase.functions.invoke("render-lyric-video", { body: { adId: ad.id } });
      if (error) throw error;
      toast({ title: "Render started", description: "Per-scene clips are being generated." });
      fetchAd();
    } catch (e: any) {
      toast({ title: "Render failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRenderBusy(false);
    }
  };

  const stitchAndPreview = async () => {
    setStitchBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stitch-lyric-video", {
        body: { adId: ad.id },
      });
      if (error) throw error;
      toast({ title: "Stitch complete", description: "Final video is ready to preview." });
      await fetchAd();
      const url = (data as any)?.videoUrl;
      if (url && onSave) onSave({ ...adState, generated_video_url: url });
    } catch (e: any) {
      toast({
        title: "Stitch failed",
        description: e?.message ?? "Make sure all per-scene clips have rendered first.",
        variant: "destructive",
      });
    } finally {
      setStitchBusy(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground animate-fade-in">
      <header className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" /> Storyboard
              </h1>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{songTitle}</span>
                {artist ? <> — {artist}</> : null}
                <span className="mx-2">·</span>
                {readyCount}/{unlockedScenes.length} scenes ready
                {scenes.length !== unlockedScenes.length && (
                  <span className="text-muted-foreground"> ({scenes.length - unlockedScenes.length} locked)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={bulkGenerateMissing}
              disabled={bulkBusy || missingScenes.length === 0}
              className="gap-1.5"
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Bulk generate{missingScenes.length > 0 ? ` (${missingScenes.length})` : ""}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={renderClips}
              disabled={!allReady || isRendering}
              className="gap-1.5"
            >
              {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Render clips
            </Button>
            <Button
              size="sm"
              onClick={stitchAndPreview}
              disabled={stitchBusy}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {stitchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}
              Stitch with sound
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Preview / status card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                {videoUrl ? (
                  <Badge className="gap-1"><Check className="h-3 w-3" /> Stitched video ready</Badge>
                ) : isRendering ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Rendering — {videoProgress}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> No preview yet — render & stitch
                  </Badge>
                )}
                {audioUrl ? (
                  <Badge variant="outline" className="gap-1"><Music2 className="h-3 w-3" /> Audio attached</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/40 gap-1">
                    <AlertTriangle className="h-3 w-3" /> No audio
                  </Badge>
                )}
              </div>
              {videoUrl && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={videoUrl} download={`${songTitle} - ${artist}.mp4`}>
                    <Download className="h-4 w-4" /> Export
                  </a>
                </Button>
              )}
            </div>
            {/* Aggregate storyboard progress */}
            {scenes.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Storyboard images</span>
                  <span>{readyCount}/{scenes.length} ready</span>
                </div>
                <Progress value={(readyCount / scenes.length) * 100} className="h-2" />
              </div>
            )}
            {isRendering && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Render progress</span>
                  <span>{videoProgress}%</span>
                </div>
                <Progress value={videoProgress} className="h-2" />
              </div>
            )}
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                className="w-full max-h-[60vh] rounded-lg bg-black"
              />
            ) : (
              <TimelinePreview scenes={scenes} audioUrl={audioUrl} />
            )}
          </CardContent>
        </Card>

        {/* Scenes */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : scenes.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">
            No scenes found for this video yet.
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {scenes.map((scene) => {
              const busy = busyIds.has(scene.id);
              const statusBadge =
                scene.image_status === "ready" ? (
                  <Badge className="gap-1"><Check className="h-3 w-3" /> Ready</Badge>
                ) : scene.image_status === "generating" ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating
                  </Badge>
                ) : scene.image_status === "failed" ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Failed
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                );

              const hasImage = !!scene.image_url;
              return (
                <Card
                  key={scene.id}
                  className={`overflow-hidden border border-border/80 shadow-md ${
                    scene.locked ? "border-amber-500/40 bg-amber-500/5" : ""
                  }`}
                >
                  <CardContent className="p-5 grid lg:grid-cols-2 gap-6 bg-card/15">
                    {/* ── LEFT: SCENE SETTINGS & PROMPT ── */}
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary">SCENE {scene.index + 1}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                            {Number(scene.start_sec).toFixed(1)}s - {Number(scene.end_sec).toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {statusBadge}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={scene.locked ? "Unlock scene" : "Lock scene"}
                            onClick={() => toggleSceneLock(scene)}
                          >
                            {scene.locked ? (
                              <Lock className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Timing row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start (s)</Label>
                          <Input
                            type="number" min={0} step={0.1}
                            value={scene.start_sec}
                            onChange={(e) => updateScene(scene.id, { start_sec: Number(e.target.value) })}
                            className="h-8 text-xs rounded-lg border-border bg-card"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">End (s)</Label>
                          <Input
                            type="number" min={0} step={0.1}
                            value={scene.end_sec}
                            onChange={(e) => updateScene(scene.id, { end_sec: Number(e.target.value) })}
                            className="h-8 text-xs rounded-lg border-border bg-card"
                          />
                        </div>
                      </div>

                      {scene.lyric_lines && scene.lyric_lines.length > 0 && (
                        <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs italic text-muted-foreground">
                          {scene.lyric_lines.join(" / ")}
                        </div>
                      )}

                      {/* Prompt fields */}
                      <div className="space-y-2">
                        {(["story", "camera", "environment", "colorGrading", "vfx"] as const).map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{field}</Label>
                            <textarea
                              value={(scene.prompt?.[field] as string) ?? ""}
                              onChange={(e) => updatePromptField(scene.id, field, e.target.value)}
                              rows={field === "story" ? 3 : 2}
                              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none font-mono"
                              placeholder={`Describe ${field}…`}
                            />
                          </div>
                        ))}
                      </div>

                      {scene.error_message && (
                        <p className="text-[11px] text-destructive">{scene.error_message}</p>
                      )}
                    </div>

                    {/* ── RIGHT: IMAGE PREVIEW & ACTIONS ── */}
                    <div className="flex flex-col justify-between border-l border-border/40 pl-0 lg:pl-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4 text-primary" /> Storyboard Frame Preview
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">Render Node</span>
                      </div>

                      <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black relative flex items-center justify-center">
                        {scene.image_url ? (
                          <img
                            src={scene.image_url}
                            alt={`Scene ${scene.index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-6 text-muted-foreground">
                            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/35 mb-2" />
                            <p className="text-[10px]">No image generated for this scene.</p>
                          </div>
                        )}
                        {scene.image_status === "generating" && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Reference URL input */}
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Reference image URL
                        </Label>
                        <Input
                          value={scene.image_url ?? ""}
                          onChange={(e) => updateScene(scene.id, { image_url: e.target.value })}
                          placeholder="https://..."
                          className="h-8 text-xs rounded-lg border-border bg-card"
                        />
                      </div>

                      {/* Step indicator */}
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/20 rounded-lg border border-border/30">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                              hasImage
                                ? "bg-green-500/20 border-green-500/60 text-green-500"
                                : "bg-primary/20 border-primary text-primary"
                            }`}
                          >
                            {hasImage ? <Check className="h-3 w-3" /> : 1}
                          </div>
                          <span className={`text-[10px] font-medium ${hasImage ? "text-green-500" : "text-foreground"}`}>
                            Generate Image
                          </span>
                        </div>
                        <div className={`flex-1 h-px ${hasImage ? "bg-green-500/40" : "bg-border"}`} />
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border bg-muted/40 border-border text-muted-foreground">
                            2
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground">Render Clip</span>
                        </div>
                      </div>

                      {/* Operational buttons */}
                      <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[10px] gap-1"
                          onClick={() => regenScene(scene)}
                          disabled={busy || scene.image_status === "generating"}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          {hasImage ? "1) Regenerate Image" : "1) Generate Image"}
                        </Button>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-[10px] gap-1"
                            onClick={() => saveScene(scene)}
                            disabled={savingId === scene.id}
                          >
                            {savingId === scene.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-[10px] gap-1 bg-primary hover:bg-primary/95 text-white"
                            onClick={() => saveAndRegenScene(scene)}
                            disabled={savingId === scene.id || busy || scene.image_status === "generating"}
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            Save & regen
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Timeline Preview ────────────────────────────────────────────────────────
// Lightweight pre-stitch preview: plays the imported audio and crossfades
// through the storyboard images at their start_sec/end_sec timestamps so
// the user can sanity-check pacing before paying for a full render.
function TimelinePreview({
  scenes,
  audioUrl,
}: {
  scenes: Scene[];
  audioUrl: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);

  const orderedReady = useMemo(
    () => scenes.filter((s) => !s.locked && s.image_url).sort((a, b) => a.index - b.index),
    [scenes],
  );

  const activeScene = useMemo(() => {
    if (orderedReady.length === 0) return null;
    const match = orderedReady.find((s) => t >= Number(s.start_sec) && t < Number(s.end_sec));
    return match ?? orderedReady[orderedReady.length - 1];
  }, [orderedReady, t]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [audioUrl]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { await a.play(); setPlaying(true); }
  };

  if (orderedReady.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
        <Eye className="h-5 w-5 mx-auto mb-2 opacity-60" />
        Generate storyboard images to enable timeline preview.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {activeScene?.image_url && (
          <img
            src={activeScene.image_url}
            alt={`Scene ${(activeScene.index ?? 0) + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-background/70 backdrop-blur rounded-md px-2 py-1.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggle} disabled={!audioUrl}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-[10px] tabular-nums text-muted-foreground w-16">
            {formatTime(t)} / {formatTime(duration)}
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: duration > 0 ? `${(t / duration) * 100}%` : "0%" }}
            />
          </div>
          {activeScene && (
            <Badge variant="secondary" className="text-[10px] h-5">
              Scene {activeScene.index + 1}/{orderedReady.length}
            </Badge>
          )}
        </div>
      </div>
      {audioUrl ? (
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">
          No audio attached — preview is silent.
        </p>
      )}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {orderedReady.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              const a = audioRef.current;
              if (a) { a.currentTime = Number(s.start_sec) || 0; setT(a.currentTime); }
            }}
            className={`shrink-0 w-16 aspect-video rounded border-2 overflow-hidden transition-all ${
              activeScene?.id === s.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
            }`}
            title={`Scene ${s.index + 1} — ${formatTime(Number(s.start_sec))}`}
          >
            <img src={s.image_url!} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
