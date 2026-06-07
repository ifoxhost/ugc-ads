import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Video, Sparkles } from "lucide-react";

interface MakeVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  adId: string;
  onSubmit: (data: VideoConversionData) => Promise<void>;
}

export interface VideoConversionData {
  productDescription: string;
  adCopy: string;
  characters: string;
  watermark: boolean;
  videoDuration: "short" | "medium";
  aspectRatio: "1:1" | "4:5" | "9:16";
}

const MakeVideoModal = ({
  open,
  onOpenChange,
  imageUrl,
  adId,
  onSubmit,
}: MakeVideoModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<VideoConversionData>({
    productDescription: "",
    adCopy: "",
    characters: "",
    watermark: false,
    videoDuration: "short",
    aspectRatio: "9:16",
  });

  const updateField = <K extends keyof VideoConversionData>(
    field: K,
    value: VideoConversionData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Modal will be closed by the parent on success
    } catch (error) {
      console.error("Video conversion error:", error);
      // Error handling is done in parent, just stop the loading state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Make this a Video Ad
          </DialogTitle>
          <DialogDescription>
            Convert your image ad into an engaging UGC video ad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview image */}
          <div className="rounded-xl overflow-hidden border border-border">
            <img
              src={imageUrl}
              alt="Source image"
              className="w-full h-32 object-cover"
            />
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="modal-description">Product Description (Optional)</Label>
              <Textarea
                id="modal-description"
                placeholder="Brief product description..."
                value={formData.productDescription}
                onChange={(e) => updateField("productDescription", e.target.value)}
                className="min-h-[60px] resize-none"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-copy">Ad Copy (Optional)</Label>
              <Input
                id="modal-copy"
                placeholder="Custom ad script..."
                value={formData.adCopy}
                onChange={(e) => updateField("adCopy", e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-characters">Characters (Optional)</Label>
              <Input
                id="modal-characters"
                placeholder="e.g., Young professional..."
                value={formData.characters}
                onChange={(e) => updateField("characters", e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={formData.videoDuration}
                  onValueChange={(value: "short" | "medium") =>
                    updateField("videoDuration", value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select
                  value={formData.aspectRatio}
                  onValueChange={(value: "1:1" | "4:5" | "9:16") =>
                    updateField("aspectRatio", value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="4:5">4:5</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="modal-watermark">Add Watermark</Label>
              <Switch
                id="modal-watermark"
                checked={formData.watermark}
                onCheckedChange={(checked) => updateField("watermark", checked)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create Video Ad
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MakeVideoModal;
