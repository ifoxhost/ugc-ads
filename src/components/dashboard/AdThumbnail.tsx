import { useState } from "react";
import { Video, ImageIcon, Play } from "lucide-react";

interface AdThumbnailProps {
  imageUrl: string | null;
  videoUrl: string | null;
  status: string;
  styleTemplate: string;
}

export const AdThumbnail = ({ imageUrl, videoUrl, status, styleTemplate }: AdThumbnailProps) => {
  const [imageError, setImageError] = useState(false);
  const isVideo = !!videoUrl;
  const thumbnailUrl = imageUrl || videoUrl;

  if (status === "processing" || !thumbnailUrl || imageError) {
    return (
      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {status === "processing" ? (
          <div className="animate-pulse w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground">
            {isVideo ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted group">
      <img
        src={thumbnailUrl}
        alt={`${styleTemplate} ad`}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
      {isVideo && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-3 w-3 text-black fill-black ml-0.5" />
          </div>
        </div>
      )}
      {isVideo && (
        <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
          <Video className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
};
