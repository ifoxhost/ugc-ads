import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, AlertCircle, CheckCircle2, PlayCircle, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { SceneCard } from "./SceneCard";

type SceneRow = {
  id: string;
  ad_id: string;
  index: number;
  lyric_lines: string[];
  start_sec: number;
  end_sec: number;
  prompt: { story: string; camera: string; environment: string; colorGrading: string; vfx: string };
  image_url: string | null;
  image_status: "pending" | "generating" | "ready" | "failed";
  regen_count: number;
  error_message: string | null;
  failed_step: string | null;
  updated_at: string;
  created_at: string;
};

type AdRow = {
  id: string;
  video_status: string | null;
  video_progress: number | null;
  generated_video_url: string | null;
  ad_copy: any;
};

const STAGE_LABEL: Record<string, string> = {
  script: "Writing shot list (GPT-4o)…",
  transcribe: "Transcribing audio…",
  storyboard: "Generating storyboard frames (Nano Banana)…",
  ready_to_render: "Storyboard ready — review then render",
  rendering: "Rendering final video on Kie.ai…",
  done: "Complete",
  failed: "Failed",
};

interface Props {
  adId: string;
  onClose?: () => void;
}

export default function StoryboardStage({ adId, onClose }: Props) {
  const [ad, setAd] = useState<AdRow | null>(null);
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [regenLoading, setRegenLoading] = useState<string | null>(null);
  const [regenAllLoading, setRegenAllLoading] = useState(false);
  const [retryFailedLoading, setRetryFailedLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [detailsScene, setDetailsScene] = useState<SceneRow | null>(null);

  // Initial load + realtime subscriptions
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: adData }, { data: scenesData }] = await Promise.all([
        supabase.from("generated_ads").select("id, video_status, video_progress, generated_video_url, ad_copy").eq("id", adId).maybeSingle(),
        supabase.from("video_scenes").select("*").eq("ad_id", adId).order("index", { ascending: true }),
      ]);
      if (!mounted) return;
      if (adData) setAd(adData as AdRow);
      if (scenesData) setScenes(scenesData as SceneRow[]);
    };
    load();

    const adCh = supabase
      .channel(`ad-${adId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "generated_ads", filter: `id=eq.${adId}` },
        (payload) => setAd(payload.new as AdRow))
      .subscribe();

    const sceneCh = supabase
      .channel(`scenes-${adId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "video_scenes", filter: `ad_id=eq.${adId}` },
        () => {
          supabase.from("video_scenes").select("*").eq("ad_id", adId).order("index", { ascending: true })
            .then(({ data }) => { if (data) setScenes(data as SceneRow[]); });
        })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(adCh); supabase.removeChannel(sceneCh); };
  }, [adId]);

  const stage: string = ad?.ad_copy?.pipelineStage ?? "script";
  const allReady = scenes.length > 0 && scenes.every((s) => s.image_status === "ready" && s.image_url);
  const anyFailed = scenes.some((s) => s.image_status === "failed");
  // Derive "Re-roll all in progress" from server state so a refresh keeps the UI in sync.
  const reRollInFlight = scenes.length > 0
    && scenes.filter((s) => s.image_status === "generating" || s.image_status === "pending").length >= 2;
  const showRegenAllBusy = regenAllLoading || reRollInFlight;

  const handleRegen = async (sceneId: string) => {
    setRegenLoading(sceneId);
    try {
      const { error } = await supabase.functions.invoke("regenerate-scene-image", { body: { sceneId } });
      if (error) throw error;
      toast.success("Regenerating scene…");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to regenerate scene");
    } finally {
      setRegenLoading(null);
    }
  };

  const handleRegenAll = async () => {
    if (!confirm("Re-roll every scene image using the same script and reference inputs?")) return;
    setRegenAllLoading(true);
    try {
      const { error } = await supabase.functions.invoke("regenerate-all-scenes", { body: { adId } });
      if (error) throw error;
      toast.success("Re-rolling all scenes…");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to re-roll scenes");
    } finally {
      setRegenAllLoading(false);
    }
  };

  const handleRetryAllFailed = async () => {
    setRetryFailedLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-failed-scenes", { body: { adId } });
      if (error) throw error;
      const n = (data as any)?.count ?? 0;
      if (n === 0) toast.info("No failed scenes to retry.");
      else toast.success(`Re-queued ${n} failed scene${n === 1 ? "" : "s"}…`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to retry scenes");
    } finally {
      setRetryFailedLoading(false);
    }
  };


  const handleRender = async () => {
    setRendering(true);
    try {
      const { error } = await supabase.functions.invoke("render-lyric-video", { body: { adId } });
      if (error) throw error;
      toast.success("Render started — we'll notify you when it's ready.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start render");
    } finally {
      setRendering(false);
    }
  };



  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Stage banner */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {stage === "done" ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : stage === "failed" ? <AlertCircle className="w-5 h-5 text-destructive" />
              : <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            <div>
              <div className="text-sm font-medium text-foreground">{STAGE_LABEL[stage] ?? stage}</div>
              <div className="text-xs text-muted-foreground">Ad ID: {adId.slice(0, 8)}</div>
            </div>
          </div>
          {ad?.video_progress != null && (
            <div className="text-xs text-muted-foreground">{ad.video_progress}%</div>
          )}
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${ad?.video_progress ?? 0}%` }} />
        </div>
      </div>

      {/* Scenes grid (OpenArt-style) */}
      {scenes.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          Generating shot list… scenes will appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {scenes.map((s) => {
            const hasImage = s.image_status === "ready" && !!s.image_url;
            const hasVideo = !!ad?.generated_video_url;
            const isBusy = s.image_status === "generating" || s.image_status === "pending" || regenLoading === s.id;
            return (
              <SceneCard
                key={s.id}
                sceneNumber={s.index + 1}
                timeRange={`${Math.round(s.start_sec)}s - ${Math.round(s.end_sec)}s`}
                hasImage={hasImage}
                hasVideo={hasVideo}
                videoStepLabel="Render Video"
                showVideoStep
                headerRight={
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium",
                      s.image_status === "ready" && "border-green-500/60 text-green-500 bg-green-500/10",
                      s.image_status === "generating" && "border-primary/60 text-primary bg-primary/10 animate-pulse",
                      s.image_status === "failed" && "border-destructive/60 text-destructive bg-destructive/10",
                      s.image_status === "pending" && "text-muted-foreground",
                    )}
                  >
                    {s.image_status === "ready" ? "Completed"
                      : s.image_status === "generating" ? "Rendering…"
                      : s.image_status === "failed" ? "Failed"
                      : "Queued"}
                  </Badge>
                }
                leftContent={
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Scene Prompt</Label>
                      <p className="text-xs text-foreground/90 bg-background/50 border border-border rounded-xl p-3 font-mono whitespace-pre-wrap break-words">
                        {s.prompt?.story || "—"}
                      </p>
                    </div>
                    {s.lyric_lines?.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lyric Lines</Label>
                        <p className="text-[11px] text-muted-foreground italic">"{s.lyric_lines.join(" / ")}"</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg text-[10px] text-muted-foreground font-mono">
                      <div>Camera: <span className="text-foreground">{s.prompt?.camera || "—"}</span></div>
                      <div>Environment: <span className="text-foreground">{s.prompt?.environment || "—"}</span></div>
                      <div>Grading: <span className="text-foreground">{s.prompt?.colorGrading || "—"}</span></div>
                      <div>VFX: <span className="text-foreground">{s.prompt?.vfx || "—"}</span></div>
                    </div>
                    {s.error_message && (
                      <p className="text-[11px] text-destructive line-clamp-3 border-t border-border/30 pt-2">{s.error_message}</p>
                    )}
                  </>
                }
                previewSlot={
                  s.image_url ? (
                    <img src={s.image_url} alt={`Scene ${s.index + 1}`} className="w-full h-full object-cover" />
                  ) : isBusy ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                      <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
                      <span className="text-[10px] text-white">Rendering scene frame…</span>
                    </div>
                  ) : s.image_status === "failed" ? (
                    <div className="text-center p-6 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto text-destructive/70 mb-2" />
                      <p className="text-[10px]">Generation failed for this frame.</p>
                    </div>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/35 mb-2" />
                      <p className="text-[10px]">No frame rendered yet.</p>
                    </div>
                  )
                }
                metadataSlot={
                  <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg text-[10px] text-muted-foreground font-mono">
                    <div>Model: <span className="text-foreground">Nano Banana</span></div>
                    <div>Attempts: <span className="text-foreground">{s.regen_count}</span></div>
                    <div className="col-span-2">Updated: <span className="text-foreground">{new Date(s.updated_at).toLocaleTimeString()}</span></div>
                  </div>
                }
                imageButton={
                  <Button
                    size="sm"
                    variant={s.image_status === "failed" ? "destructive" : "outline"}
                    className="h-8 text-[10px]"
                    disabled={regenLoading === s.id || s.image_status === "generating" || showRegenAllBusy}
                    onClick={() => handleRegen(s.id)}
                  >
                    {regenLoading === s.id || s.image_status === "generating" ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    {s.image_status === "failed"
                      ? "1) Retry Image"
                      : hasImage
                        ? `1) Regenerate Image${s.regen_count > 0 ? ` (${s.regen_count})` : ""}`
                        : "1) Generate Image"}
                  </Button>
                }
                midActions={
                  s.image_status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => setDetailsScene(s)}
                      title="View error details"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  ) : null
                }
                videoButton={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px]"
                    disabled
                    title="Video is rendered for the full storyboard from the action bar below"
                  >
                    <Film className="h-3.5 w-3.5 mr-1" />
                    2) Video (storyboard)
                  </Button>
                }
              />
            );
          })}
        </div>
      )}


      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-card/95 backdrop-blur border border-border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          {(() => {
            const q = scenes.filter(s => s.image_status === "pending").length;
            const r = scenes.filter(s => s.image_status === "generating").length;
            const c = scenes.filter(s => s.image_status === "ready").length;
            const f = scenes.filter(s => s.image_status === "failed").length;
            return (
              <>
                <span><span className="text-foreground font-medium">{c}</span>/{scenes.length} completed</span>
                {r > 0 && <span className="text-primary">• {r} rendering</span>}
                {q > 0 && <span>• {q} queued</span>}
                {f > 0 && <span className="text-destructive">• {f} failed</span>}
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
          {scenes.some(s => s.image_status === "failed") && (
            <Button
              variant="destructive" size="sm"
              disabled={retryFailedLoading || showRegenAllBusy || stage === "rendering"}
              onClick={handleRetryAllFailed}>
              {retryFailedLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-1" />
              )}
              Retry all failed
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            disabled={showRegenAllBusy || scenes.length === 0 || stage === "rendering"}
            onClick={handleRegenAll}>
            {showRegenAllBusy ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {showRegenAllBusy ? "Re-rolling…" : "Re-roll all"}
          </Button>
          {ad?.generated_video_url ? (
            <Button asChild size="sm">
              <a href={ad.generated_video_url} target="_blank" rel="noreferrer">
                <PlayCircle className="w-4 h-4 mr-1" /> Watch video
              </a>
            </Button>
          ) : (
            <Button
              size="sm" disabled={!allReady || rendering || stage === "rendering"}
              onClick={handleRender}>
              {rendering || stage === "rendering" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              Render video
            </Button>
          )}
        </div>
      </div>

      {/* Failed-scene details drawer */}
      <Sheet open={!!detailsScene} onOpenChange={(o) => !o && setDetailsScene(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailsScene && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Scene {detailsScene.index + 1} — failure details
                </SheetTitle>
                <SheetDescription>
                  {Math.round(detailsScene.start_sec)}–{Math.round(detailsScene.end_sec)}s
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="destructive">Failed</Badge>
                  {detailsScene.failed_step && (
                    <Badge variant="outline">Step: {detailsScene.failed_step}</Badge>
                  )}
                  {detailsScene.regen_count > 0 && (
                    <Badge variant="outline">Attempts: {detailsScene.regen_count}</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Last error</div>
                  <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words">
{detailsScene.error_message ?? "No error message captured."}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div>{new Date(detailsScene.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last updated</div>
                    <div>{new Date(detailsScene.updated_at).toLocaleString()}</div>
                  </div>
                </div>

                {detailsScene.prompt?.story && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Scene prompt</div>
                    <p className="text-xs text-foreground/90">{detailsScene.prompt.story}</p>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm" variant="destructive" className="flex-1"
                    disabled={regenLoading === detailsScene.id}
                    onClick={async () => {
                      const id = detailsScene.id;
                      setDetailsScene(null);
                      await handleRegen(id);
                    }}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry this scene
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

