import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, AlertCircle, CheckCircle2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [rendering, setRendering] = useState(false);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {s.image_url ? (
                  <img src={s.image_url} alt={`Scene ${s.index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {s.image_status === "generating" || s.image_status === "pending" ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : s.image_status === "failed" ? (
                      <AlertCircle className="w-6 h-6 text-destructive" />
                    ) : null}
                  </div>
                )}
                <div className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur px-2 py-0.5 rounded">
                  Scene {s.index + 1} • {Math.round(s.start_sec)}–{Math.round(s.end_sec)}s
                </div>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-xs text-foreground/90 line-clamp-3">{s.prompt.story}</p>
                {s.lyric_lines?.length > 0 && (
                  <p className="text-[11px] text-muted-foreground italic line-clamp-2">"{s.lyric_lines.join(" / ")}"</p>
                )}
                {s.error_message && (
                  <p className="text-[11px] text-destructive">{s.error_message}</p>
                )}
                <Button
                  size="sm" variant="outline" className="w-full"
                  disabled={regenLoading === s.id || s.image_status === "generating"}
                  onClick={() => handleRegen(s.id)}>
                  {regenLoading === s.id || s.image_status === "generating" ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1" />
                  )}
                  Regenerate {s.regen_count > 0 && `(${s.regen_count})`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-card/95 backdrop-blur border border-border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground">
          {allReady ? "Storyboard ready — review and render when happy."
            : anyFailed ? "Some scenes failed — regenerate before rendering."
            : `${scenes.filter(s => s.image_status === "ready").length}/${scenes.length} scenes ready`}
        </div>
        <div className="flex items-center gap-2">
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
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
    </div>
  );
}
