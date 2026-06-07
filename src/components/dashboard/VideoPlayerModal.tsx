import { useRef, useEffect, useState, useCallback } from "react";
import { X, Maximize, Minimize, Download, Share2, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  title?: string;
}

export const VideoPlayerModal = ({ isOpen, onClose, videoUrl, title }: VideoPlayerModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (!videoUrl) return;

    const shareData = {
      title: title || "Check out this video ad!",
      text: "I created this amazing UGC video ad",
      url: videoUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared successfully!" });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  }, [videoUrl, title]);

  const copyToClipboard = async () => {
    if (!videoUrl) return;
    
    try {
      await navigator.clipboard.writeText(videoUrl);
      toast({ 
        title: "Link copied!", 
        description: "Video link has been copied to your clipboard." 
      });
    } catch (error) {
      toast({ 
        title: "Could not copy link", 
        description: "Please copy the video URL manually.", 
        variant: "destructive" 
      });
    }
  };

  const handleDownload = useCallback(async () => {
    if (!videoUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title ? `${title.replace(/\s+/g, "-").toLowerCase()}.mp4` : "video-ad.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Your video is being downloaded." });
    } catch (error) {
      toast({ title: "Download failed", description: "Could not download the video.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }, [videoUrl, title]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      setDuration(total);
      setProgress(total > 0 ? (current / total) * 100 : 0);
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    videoRef.current.currentTime = percentage * videoRef.current.duration;
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, togglePlayPause, toggleFullscreen, toggleMute]);

  if (!videoUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black border-none">
        <VisuallyHidden>
          <DialogTitle>{title || "Video Player"}</DialogTitle>
        </VisuallyHidden>
        <div 
          ref={containerRef} 
          className="relative bg-black"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Top Controls */}
          <div className={`absolute top-2 right-2 z-10 flex gap-2 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={handleShare}
              title="Share video"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={handleDownload}
              disabled={isDownloading}
              title="Download video"
            >
              <Download className={`h-5 w-5 ${isDownloading ? 'animate-pulse' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Video Element */}
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            className="w-full max-h-[80vh] object-contain"
            onClick={togglePlayPause}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
          >
            Your browser does not support the video tag.
          </video>

          {/* Progress Bar & Volume Overlay */}
          <div 
            className={`absolute bottom-0 left-0 right-0 px-4 pb-14 pt-8 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-white text-xs font-mono min-w-[40px]">{formatTime(currentTime)}</span>
              <div 
                className="flex-1 h-1.5 bg-white/30 rounded-full cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-primary rounded-full relative transition-all group-hover:h-2 group-hover:-mt-0.5"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                </div>
              </div>
              <span className="text-white text-xs font-mono min-w-[40px] text-right">{formatTime(duration)}</span>
              
              {/* Volume Control */}
              <div 
                className="relative flex items-center"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <div 
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/90 rounded-lg transition-all duration-200 ${
                    showVolumeSlider ? 'opacity-100 visible' : 'opacity-0 invisible'
                  }`}
                >
                  <Slider
                    orientation="vertical"
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="h-20 w-1.5"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {title && (
          <div className="p-4 bg-background border-t">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Space: play/pause • F: fullscreen • M: mute • Esc: close
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
