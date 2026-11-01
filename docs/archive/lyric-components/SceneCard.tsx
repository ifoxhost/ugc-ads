import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared 2-column storyboard scene card.
 *
 * All storyboard surfaces (StoryboardEditor, StoryboardManager, StoryboardStage,
 * UGCGenerator pipeline) MUST render scene cards through this component so the
 * layout, step indicator, and action-row affordances stay consistent.
 *
 * Step semantics:
 *   - hasImage=false              → Step 1 active, Step 2 pending
 *   - hasImage=true, hasVideo=false → Step 1 done, Step 2 active
 *   - hasImage=true, hasVideo=true  → both done
 *
 * Step 2 is hidden when `videoButton` is not provided AND `showVideoStep=false`,
 * for surfaces that only manage image generation (e.g. StoryboardStage).
 */
export interface SceneCardProps {
  sceneNumber: number | string;
  timeRange?: React.ReactNode;
  headerRight?: React.ReactNode;

  /** Left column body: prompts, settings, lyrics, errors. */
  leftContent: React.ReactNode;

  /** Right column: media preview (image/video/loader/empty state). */
  previewSlot: React.ReactNode;
  /** Right column header — defaults to "Storyboard Frame Preview". */
  previewTitle?: React.ReactNode;
  previewSubtitle?: React.ReactNode;

  /** Optional render metadata block shown above the step indicator. */
  metadataSlot?: React.ReactNode;

  /** Step state. */
  hasImage: boolean;
  hasVideo?: boolean;
  imageStepLabel?: string;
  videoStepLabel?: string;
  /** Show the step indicator's second pill even with no video button. */
  showVideoStep?: boolean;

  /** Action row — left side is always the image (step 1) control. */
  imageButton: React.ReactNode;
  /** Right side action — pass the video (step 2) control, or any other element. */
  videoButton?: React.ReactNode;
  /** Extra controls rendered between the two main buttons. */
  midActions?: React.ReactNode;

  className?: string;
  /** Optional extra classes on <CardContent>. Useful for accent borders. */
  contentClassName?: string;
}

function StepDot({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border",
          state === "done" && "bg-green-500/20 border-green-500/60 text-green-500",
          state === "active" && "bg-primary/20 border-primary text-primary",
          state === "pending" && "bg-muted/40 border-border text-muted-foreground",
        )}
      >
        {state === "done" ? <Check className="h-3 w-3" /> : n}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium",
          state === "done" && "text-green-500",
          state === "active" && "text-foreground",
          state === "pending" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function SceneCard({
  sceneNumber,
  timeRange,
  headerRight,
  leftContent,
  previewSlot,
  previewTitle,
  previewSubtitle = "Render Node",
  metadataSlot,
  hasImage,
  hasVideo = false,
  imageStepLabel = "Generate Image",
  videoStepLabel = "Generate Video",
  showVideoStep,
  imageButton,
  videoButton,
  midActions,
  className,
  contentClassName,
}: SceneCardProps) {
  const showStep2 = showVideoStep ?? !!videoButton;
  const step1: "done" | "active" = hasImage ? "done" : "active";
  const step2: "done" | "active" | "pending" = hasVideo
    ? "done"
    : hasImage
      ? "active"
      : "pending";

  return (
    <Card className={cn("overflow-hidden border border-border/80 shadow-md", className)}>
      <CardContent className={cn("p-5 grid lg:grid-cols-2 gap-6 bg-card/15", contentClassName)}>
        {/* ──── LEFT ──── */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-primary whitespace-nowrap">
                SCENE {sceneNumber}
              </span>
              {timeRange && (
                <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full truncate">
                  {timeRange}
                </span>
              )}
            </div>
            {headerRight && <div className="flex items-center gap-1.5 shrink-0">{headerRight}</div>}
          </div>
          {leftContent}
        </div>

        {/* ──── RIGHT ──── */}
        <div className="flex flex-col justify-between border-l border-border/40 pl-0 lg:pl-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              {previewTitle ?? (
                <>
                  <ImageIcon className="h-4 w-4 text-primary" /> Storyboard Frame Preview
                </>
              )}
            </span>
            {previewSubtitle && (
              <span className="text-[10px] text-muted-foreground font-semibold">
                {previewSubtitle}
              </span>
            )}
          </div>

          <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black relative flex items-center justify-center">
            {previewSlot}
          </div>

          {metadataSlot}

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/20 rounded-lg border border-border/30">
            <StepDot n={1} label={imageStepLabel} state={step1} />
            {showStep2 && (
              <>
                <div
                  className={cn(
                    "flex-1 h-px",
                    hasImage ? "bg-green-500/40" : "bg-border",
                  )}
                />
                <StepDot n={2} label={videoStepLabel} state={step2} />
              </>
            )}
          </div>

          {/* Action row */}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
            <div className="flex items-center gap-2">{imageButton}</div>
            {midActions && <div className="flex items-center gap-2">{midActions}</div>}
            {videoButton && <div className="flex items-center gap-2">{videoButton}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SceneCard;
