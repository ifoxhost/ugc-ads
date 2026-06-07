import { useState } from "react";
import { Download, Trash2, Loader2, ExternalLink, Image as ImageIcon, AlertCircle, Video, Play, Clock, RefreshCw, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";

interface GeneratedAd {
  id: string;
  product_image_url: string;
  generated_image_url: string | null;
  generated_video_url: string | null;
  style_template: string;
  ad_copy: {
    headline?: string;
    cta?: string;
    caption?: string;
    hashtags?: string[];
    title?: string;
    artist?: string;
    lyricsPreview?: string;
    fontTheme?: string;
    colorPalette?: string;
  } | null;
  aspect_ratio: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  video_status?: string | null;
  video_duration?: number | null;
  video_retry_count?: number | null;
  video_progress?: number | null;
}

interface OutputGalleryProps {
  ads: GeneratedAd[];
  onDelete: (id: string) => void;
  onMakeVideo?: (ad: GeneratedAd) => void;
  onRetryVideo?: (ad: GeneratedAd) => void;
  onEditStoryboard?: (ad: GeneratedAd) => void;
  isLoading?: boolean;
}

// Format video duration (seconds) to MM:SS or H:MM:SS
const formatVideoDuration = (seconds: number | null | undefined): string | null => {
  if (!seconds || seconds <= 0) return null;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// Calculate days remaining before video expires (14 days from completion)
const getVideoExpiryInfo = (completedAt: string | null | undefined): { daysLeft: number; hoursLeft: number; isExpiringSoon: boolean } | null => {
  if (!completedAt) return null;
  
  try {
    const completedDate = parseISO(completedAt);
    const expiryDate = new Date(completedDate);
    expiryDate.setDate(expiryDate.getDate() + 14); // 14 days retention
    
    const now = new Date();
    const daysLeft = differenceInDays(expiryDate, now);
    const hoursLeft = differenceInHours(expiryDate, now) % 24;
    
    if (daysLeft < 0) return { daysLeft: 0, hoursLeft: 0, isExpiringSoon: true };
    
    return {
      daysLeft,
      hoursLeft,
      isExpiringSoon: daysLeft <= 3
    };
  } catch {
    return null;
  }
};

const OutputGallery = ({ ads, onDelete, onMakeVideo, onRetryVideo, onEditStoryboard, isLoading }: OutputGalleryProps) => {
  const [selectedAd, setSelectedAd] = useState<GeneratedAd | null>(null);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  const getStyleLabel = (styleId: string) => {
    const styles: Record<string, string> = {
      lifestyle: "Lifestyle",
      handheld: "Hand-held POV",
      flatlay: "Flat Lay",
      "before-after": "Before/After",
      testimonial: "Testimonial",
      "minimal-studio": "Minimal Studio",
      "video-ugc": "Video Ad",
    };
    return styles[styleId] || styleId;
  };

  const isVideoAd = (ad: GeneratedAd) => {
    return ad.style_template === "video-ugc" || ad.generated_video_url;
  };

  const isVideoProcessing = (ad: GeneratedAd) => {
    return ad.status === "video_processing" || ad.video_status === "queued" || ad.video_status === "processing";
  };

  const isVideoRetrying = (ad: GeneratedAd) => {
    return ad.video_status === "retrying";
  };

  const isVideoFailed = (ad: GeneratedAd) => {
    return ad.status === "video_failed" || ad.video_status === "failed";
  };

  // Get processing status message with progress + ETA
  const getVideoStatusMessage = (ad: GeneratedAd): { message: string; progress: number; eta?: string } => {
    const progress = ad.video_progress || 0;
    // Estimate remaining time assuming a typical 4-minute render budget.
    const estimateEta = (pct: number): string | undefined => {
      if (pct <= 0 || pct >= 100) return undefined;
      const totalSec = 240; // ~4 min baseline
      const remaining = Math.max(5, Math.round(totalSec * (1 - pct / 100)));
      if (remaining < 60) return `~${remaining}s left`;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      return s === 0 ? `~${m}m left` : `~${m}m ${s}s left`;
    };

    if (ad.status === "processing") {
      return { message: "Preparing scenes…", progress: Math.max(progress, 3) };
    }
    if (ad.video_status === "queued") {
      return { message: "Queued — waiting for a render slot…", progress: 2 };
    }
    if (ad.video_status === "processing" || ad.video_status === "rendering") {
      if (progress > 0) {
        return { message: `Rendering video… ${progress}%`, progress, eta: estimateEta(progress) };
      }
      return { message: "Rendering video…", progress: 5 };
    }
    if (ad.video_status === "fetching") {
      return { message: "Fetching assets…", progress: Math.max(progress, 10) };
    }
    if (ad.video_status === "saving") {
      return { message: "Saving final cut…", progress: Math.max(progress, 90) };
    }
    if (ad.video_status === "retrying") {
      const retryCount = ad.video_retry_count || 0;
      return { message: `Retrying (${retryCount}/3)…`, progress: Math.max(progress, 2) };
    }
    return { message: "Creating video…", progress: Math.max(progress, 1) };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No generated ads yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first UGC ad above
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {ads.map((ad) => (
          <Card
            key={ad.id}
            className={cn(
              "overflow-hidden group cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
              (ad.status === "processing" || isVideoProcessing(ad)) && "opacity-75"
            )}
            onClick={() => (ad.status === "completed" || ad.generated_video_url) && setSelectedAd(ad)}
          >
            <CardContent className="p-0 relative">
              {ad.status === "processing" ? (
                <div className="aspect-square flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  </div>
                </div>
              ) : isVideoProcessing(ad) || isVideoRetrying(ad) ? (
                <div className="aspect-square flex items-center justify-center bg-muted relative">
                  {ad.generated_image_url || ad.product_image_url ? (
                    <img
                      src={ad.generated_image_url || ad.product_image_url}
                      alt="Source image"
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                  {(() => {
                    const statusInfo = getVideoStatusMessage(ad);
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <span className="text-sm text-white font-medium mb-2">{statusInfo.message}</span>
                        {statusInfo.progress > 0 && (
                          <div className="w-full max-w-[80%] space-y-1">
                            <Progress value={statusInfo.progress} className="h-2" />
                            <div className="flex justify-between text-xs text-white/70">
                              <span>Progress</span>
                              <span className="font-medium">{statusInfo.progress}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : isVideoFailed(ad) ? (
                <div className="aspect-square flex flex-col items-center justify-center bg-destructive/10 p-4 relative">
                  {/* Show source image in background */}
                  {(ad.generated_image_url || ad.product_image_url) && (
                    <img
                      src={ad.generated_image_url || ad.product_image_url}
                      alt="Source image"
                      className="absolute inset-0 w-full h-full object-cover opacity-20"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center">
                    <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                    <span className="text-sm text-destructive font-medium text-center mb-3">Video generation failed</span>
                    {onRetryVideo && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryVideo(ad);
                        }}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate Video
                      </Button>
                    )}
                  </div>
                </div>
              ) : ad.status === "failed" ? (
                <div className="aspect-square flex flex-col items-center justify-center bg-destructive/10 p-4">
                  <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                  <span className="text-xs text-destructive text-center">Failed</span>
                </div>
              ) : ad.generated_video_url ? (
                <div className="aspect-square relative">
                  <video
                    src={ad.generated_video_url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                  {/* Video expiry countdown */}
                  {(() => {
                    const expiryInfo = getVideoExpiryInfo(ad.completed_at);
                    if (expiryInfo) {
                      return (
                        <div className={cn(
                          "absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1",
                          expiryInfo.isExpiringSoon 
                            ? "bg-destructive/90 text-destructive-foreground" 
                            : "bg-black/60 text-white"
                        )}>
                          <Clock className="h-3 w-3" />
                          {expiryInfo.daysLeft > 0 
                            ? `${expiryInfo.daysLeft}d left`
                            : expiryInfo.hoursLeft > 0 
                              ? `${expiryInfo.hoursLeft}h left`
                              : "Expiring soon"
                          }
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Video duration badge */}
                  {ad.video_duration && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-black/70 text-white">
                      {formatVideoDuration(ad.video_duration)}
                    </div>
                  )}
                </div>
              ) : ad.generated_image_url ? (
                <img
                  src={ad.generated_image_url}
                  alt="Generated ad"
                  className="aspect-square object-cover w-full"
                />
              ) : (
                <img
                  src={ad.product_image_url}
                  alt="Product"
                  className="aspect-square object-cover w-full opacity-50"
                />
              )}

              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {getStyleLabel(ad.style_template)}
                  </Badge>
                  {isVideoAd(ad) && (
                    <Badge variant="outline" className="text-xs bg-primary/20 border-primary/30">
                      <Video className="h-3 w-3 mr-1" />
                      Video
                    </Badge>
                  )}
                </div>
              </div>

              {ad.status === "completed" && (
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {ad.generated_image_url && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(ad.generated_image_url!, `ugc-ad-${ad.id}.jpg`);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {ad.generated_video_url && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        const title = ad.ad_copy?.title || "Music Video";
                        const artist = ad.ad_copy?.artist || "AI Creator";
                        handleDownload(ad.generated_video_url!, `${title} - ${artist}.mp4`);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {ad.generated_video_url && onEditStoryboard && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditStoryboard(ad);
                      }}
                      title="Edit Storyboard"
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Make Video button - only show for image ads without video */}
                  {ad.generated_image_url && !ad.generated_video_url && !isVideoProcessing(ad) && onMakeVideo && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMakeVideo(ad);
                      }}
                      title="Make this a Video Ad"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(ad.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Ad Preview</DialogTitle>
          {selectedAd && (
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative">
                {selectedAd.generated_video_url ? (
                  <video
                    src={selectedAd.generated_video_url}
                    controls
                    autoPlay
                    className="w-full aspect-square object-cover"
                  />
                ) : selectedAd.generated_image_url ? (
                  <img
                    src={selectedAd.generated_image_url}
                    alt="Generated ad"
                    className="w-full aspect-square object-cover"
                  />
                ) : null}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{getStyleLabel(selectedAd.style_template)}</Badge>
                  <Badge variant="outline">
                    {selectedAd.aspect_ratio}
                  </Badge>
                  {isVideoAd(selectedAd) && (
                    <Badge variant="outline" className="bg-primary/20 border-primary/30">
                      <Video className="h-3 w-3 mr-1" />
                      Video
                    </Badge>
                  )}
                </div>

                {/* Video expiry warning in modal */}
                {selectedAd.generated_video_url && (() => {
                  const expiryInfo = getVideoExpiryInfo(selectedAd.completed_at);
                  if (expiryInfo) {
                    return (
                      <div className={cn(
                        "flex items-center gap-2 p-3 rounded-lg text-sm",
                        expiryInfo.isExpiringSoon 
                          ? "bg-destructive/10 text-destructive border border-destructive/20" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>
                          {expiryInfo.daysLeft > 0 
                            ? `Video expires in ${expiryInfo.daysLeft} day${expiryInfo.daysLeft !== 1 ? 's' : ''} ${expiryInfo.hoursLeft}h`
                            : expiryInfo.hoursLeft > 0 
                              ? `Video expires in ${expiryInfo.hoursLeft} hour${expiryInfo.hoursLeft !== 1 ? 's' : ''}`
                              : "Video expiring very soon!"
                          }
                          {" — download to keep it forever"}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                 {selectedAd.ad_copy && (
                  <div className="space-y-3 text-sm">
                    {/* Render UGC fields if present */}
                    {selectedAd.ad_copy.headline && (
                      <div>
                        <p className="text-xs text-muted-foreground">Headline</p>
                        <p className="font-medium">{selectedAd.ad_copy.headline}</p>
                      </div>
                    )}
                    {selectedAd.ad_copy.cta && (
                      <div>
                        <p className="text-xs text-muted-foreground">CTA</p>
                        <p>{selectedAd.ad_copy.cta}</p>
                      </div>
                    )}
                    {selectedAd.ad_copy.caption && (
                      <div>
                        <p className="text-xs text-muted-foreground">Caption</p>
                        <p className="text-sm">{selectedAd.ad_copy.caption}</p>
                      </div>
                    )}
                    {selectedAd.ad_copy.hashtags && Array.isArray(selectedAd.ad_copy.hashtags) && selectedAd.ad_copy.hashtags.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Hashtags</p>
                        <p className="text-sm text-primary">
                          {selectedAd.ad_copy.hashtags.join(" ")}
                        </p>
                      </div>
                    )}

                    {/* Render Lyric Video fields if present */}
                    {selectedAd.ad_copy.title && (
                      <div>
                        <p className="text-xs text-muted-foreground">Song Title</p>
                        <p className="font-medium text-foreground">{selectedAd.ad_copy.title}</p>
                      </div>
                    )}
                    {selectedAd.ad_copy.artist && (
                      <div>
                        <p className="text-xs text-muted-foreground">Artist</p>
                        <p className="font-medium text-foreground">{selectedAd.ad_copy.artist}</p>
                      </div>
                    )}
                    {selectedAd.ad_copy.lyricsPreview && (
                      <div>
                        <p className="text-xs text-muted-foreground">Lyrics / Script Preview</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono mt-1 bg-muted/30 p-2 rounded-lg leading-relaxed">
                          {selectedAd.ad_copy.lyricsPreview}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-4">
                  {selectedAd.generated_image_url && (
                    <Button
                      onClick={() =>
                        handleDownload(
                          selectedAd.generated_image_url!,
                          `ugc-ad-${selectedAd.id}.jpg`
                        )
                      }
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Image
                    </Button>
                  )}
                  {selectedAd.generated_video_url && (
                    <Button
                      onClick={() => {
                        const title = selectedAd.ad_copy?.title || "Music Video";
                        const artist = selectedAd.ad_copy?.artist || "AI Creator";
                        handleDownload(
                          selectedAd.generated_video_url!,
                          `${title} - ${artist}.mp4`
                        );
                      }}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Video
                    </Button>
                  )}
                  {selectedAd.generated_video_url && onEditStoryboard && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onEditStoryboard(selectedAd);
                        setSelectedAd(null);
                      }}
                      className="flex-1 gap-2"
                    >
                      <Scissors className="h-4 w-4" />
                      Storyboard
                    </Button>
                  )}
                  {/* Make Video button in modal */}
                  {selectedAd.generated_image_url && !selectedAd.generated_video_url && !isVideoProcessing(selectedAd) && onMakeVideo && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onMakeVideo(selectedAd);
                        setSelectedAd(null);
                      }}
                      className="flex-1"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Make Video
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete(selectedAd.id);
                      setSelectedAd(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OutputGallery;
