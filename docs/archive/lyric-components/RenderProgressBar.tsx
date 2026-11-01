import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveRender {
  id: string;
  style_template: string;
  aspect_ratio: string | null;
  video_progress?: number | null;
  video_status?: string | null;
  status: string;
  ad_copy: {
    title?: string;
    artist?: string;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued:     "Queued…",
  processing: "Rendering…",
  fetching:   "Preparing…",
  rendering:  "Rendering…",
  saving:     "Saving…",
  complete:   "Done!",
  failed:     "Failed",
};

const isActiveOrFailed = (ad: ActiveRender) =>
  ad.status === "processing" ||
  ad.status === "video_failed" ||
  ad.video_status === "queued" ||
  ad.video_status === "processing" ||
  ad.video_status === "fetching" ||
  ad.video_status === "rendering" ||
  ad.video_status === "saving" ||
  ad.video_status === "failed";

interface RenderProgressBarProps {
  /** Optional pre-fetched active renders to display (bypasses internal polling/fetching) */
  renders?: ActiveRender[];
  /** Poll interval in ms (default 5000) */
  pollInterval?: number;
  className?: string;
}

const RenderProgressBar = ({ renders: propRenders, pollInterval = 5000, className }: RenderProgressBarProps) => {
  const [internalRenders, setInternalRenders] = useState<ActiveRender[]>([]);

  const fetchActive = useCallback(async () => {
    if (propRenders) return; // Bypassed
    const { data } = await supabase
      .from("generated_ads")
      .select("id, style_template, aspect_ratio, video_progress, video_status, status, ad_copy")
      .or("status.eq.processing,status.eq.video_failed,video_status.eq.queued,video_status.eq.processing,video_status.eq.fetching,video_status.eq.rendering,video_status.eq.saving,video_status.eq.failed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setInternalRenders(
        (data as ActiveRender[]).filter(isActiveOrFailed)
      );
    }
  }, [propRenders]);

  useEffect(() => {
    if (propRenders) return; // Bypassed
    fetchActive();
    const interval = setInterval(fetchActive, pollInterval);

    // Also subscribe to real-time updates
    const channel = supabase
      .channel("render-progress-bar")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "generated_ads" },
        () => fetchActive()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchActive, pollInterval, propRenders]);

  const renders = propRenders ?? internalRenders;

  if (renders.length === 0) return null;

  const allFailed = renders.every(r => r.video_status === "failed" || r.status === "video_failed");
  const activeCount = renders.filter(r => r.status === "processing" || (r.video_status && !["failed"].includes(r.video_status))).length;

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        {allFailed ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        )}
        {allFailed ? "Generation Failed" : "Rendering"}
        <span className="ml-auto text-[10px] font-normal normal-case tracking-normal">
          {activeCount > 0 ? `${activeCount} job${activeCount > 1 ? "s" : ""} in progress` : `${renders.length} failed`}
        </span>
      </h3>

      <div className="space-y-2">
        {renders.map((render) => {
          const pct = render.video_progress ?? 10;
          const statusKey = render.video_status ?? "queued";
          const statusLabel = STATUS_LABEL[statusKey] ?? "Processing…";
          const isComplete = statusKey === "complete";
          const isFailed = statusKey === "failed";

          const title = (render.ad_copy as { title?: string } | null)?.title;
          const label = title
            ? `"${title}"`
            : `${render.style_template} · ${render.aspect_ratio ?? ""}`;

          return (
            <div
              key={render.id}
              className={cn(
                "rounded-xl border bg-card p-3 space-y-2 transition-all duration-300",
                isComplete && "border-primary/30 bg-primary/5",
                isFailed && "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : isFailed ? (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  ) : (
                    <Music2 className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">{label}</span>
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold whitespace-nowrap",
                    isComplete ? "text-primary" : isFailed ? "text-destructive" : "text-primary/80"
                  )}
                >
                  {isComplete ? "Complete" : isFailed ? "Failed" : `${statusLabel} ${pct}%`}
                </span>
              </div>

              {!isFailed && (
                <Progress
                  value={pct}
                  className="h-1.5"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RenderProgressBar;
