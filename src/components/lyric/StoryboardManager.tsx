import { useEffect, useMemo, useState, useCallback } from "react";
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
  ImageIcon, AlertTriangle, Check, Wand2, Save, Download, Play,
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

  const missingScenes = useMemo(
    () => scenes.filter((s) => s.image_status !== "ready" || !s.image_url),
    [scenes],
  );
  const readyCount = scenes.length - missingScenes.length;

  const allReady = scenes.length > 0 && missingScenes.length === 0;
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
                {readyCount}/{scenes.length} scenes ready
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
            {isRendering && <Progress value={videoProgress} className="h-2" />}
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                className="w-full max-h-[60vh] rounded-lg bg-black"
              />
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

              return (
                <Card key={scene.id} className="overflow-hidden">
                  <CardContent className="p-4 grid md:grid-cols-[260px_1fr] gap-4">
                    {/* Image */}
                    <div className="space-y-2">
                      <div className="aspect-square rounded-lg border bg-muted/30 overflow-hidden relative">
                        {scene.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={scene.image_url}
                            alt={`Scene ${scene.index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <ImageIcon className="h-8 w-8" />
                            <span className="text-xs">No image</span>
                          </div>
                        )}
                        {scene.image_status === "generating" && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">
                          SCENE {scene.index + 1}
                        </span>
                        {statusBadge}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5"
                        onClick={() => regenScene(scene)}
                        disabled={busy || scene.image_status === "generating"}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Regenerate image
                      </Button>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Reference image URL
                        </Label>
                        <Input
                          value={scene.image_url ?? ""}
                          onChange={(e) => updateScene(scene.id, { image_url: e.target.value })}
                          placeholder="https://..."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Prompt + timing */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start (s)</Label>
                          <Input
                            type="number" min={0} step={0.1}
                            value={scene.start_sec}
                            onChange={(e) => updateScene(scene.id, { start_sec: Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">End (s)</Label>
                          <Input
                            type="number" min={0} step={0.1}
                            value={scene.end_sec}
                            onChange={(e) => updateScene(scene.id, { end_sec: Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {scene.lyric_lines && scene.lyric_lines.length > 0 && (
                        <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs italic text-muted-foreground">
                          {scene.lyric_lines.join(" / ")}
                        </div>
                      )}

                      {(["story", "camera", "environment", "colorGrading", "vfx"] as const).map((field) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{field}</Label>
                          <textarea
                            value={(scene.prompt?.[field] as string) ?? ""}
                            onChange={(e) => updatePromptField(scene.id, field, e.target.value)}
                            rows={field === "story" ? 3 : 2}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            placeholder={`Describe ${field}…`}
                          />
                        </div>
                      ))}

                      {scene.error_message && (
                        <p className="text-[11px] text-destructive">{scene.error_message}</p>
                      )}

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => saveScene(scene)}
                          disabled={savingId === scene.id}
                        >
                          {savingId === scene.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save edits
                        </Button>
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
