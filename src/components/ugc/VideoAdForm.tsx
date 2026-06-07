import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductUploader from "./ProductUploader";

export interface VideoAdFormData {
  productDescription: string;
  adCopy: string;
  characters: string;
  watermark: string;
  imageCount: number;
  videoDuration: "short" | "medium";
  aspectRatio: "1:1" | "4:5" | "9:16";
}

interface VideoAdFormProps {
  formData: VideoAdFormData;
  onFormChange: (data: VideoAdFormData) => void;
  imagePreview: string | null;
  onImageChange: (file: File | null, url?: string) => void;
  isSubmitting?: boolean;
}

const VideoAdForm = ({
  formData,
  onFormChange,
  imagePreview,
  onImageChange,
  isSubmitting,
}: VideoAdFormProps) => {
  const updateField = <K extends keyof VideoAdFormData>(
    field: K,
    value: VideoAdFormData[K]
  ) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Product Image Upload */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h2 className="text-lg font-semibold mb-4">1. Upload Product</h2>
        <ProductUploader
          onImageChange={onImageChange}
          imagePreview={imagePreview}
          isUploading={isSubmitting}
        />
      </div>

      {/* Product Description */}
      <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
        <h2 className="text-lg font-semibold mb-4">2. Video Details</h2>
        
        <div className="space-y-2">
          <Label htmlFor="productDescription">Product Description (Optional)</Label>
          <Textarea
            id="productDescription"
            placeholder="Describe your product, its key features and benefits..."
            value={formData.productDescription}
            onChange={(e) => updateField("productDescription", e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adCopy">Ad Copy (Optional)</Label>
          <Textarea
            id="adCopy"
            placeholder="Custom ad copy or script for the video..."
            value={formData.adCopy}
            onChange={(e) => updateField("adCopy", e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="characters">Characters / Personas (Optional)</Label>
          <Input
            id="characters"
            placeholder="e.g., Young professional, fitness enthusiast..."
            value={formData.characters}
            onChange={(e) => updateField("characters", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="watermark">Text Watermark (Optional)</Label>
          <Input
            id="watermark"
            placeholder="e.g., Your brand name or tagline..."
            value={formData.watermark}
            onChange={(e) => updateField("watermark", e.target.value)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Text to overlay on your video ad
          </p>
        </div>
      </div>

      {/* Video Settings */}
      <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
        <h2 className="text-lg font-semibold mb-4">3. Video Settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Number of Images</Label>
            <Select
              value={String(formData.imageCount)}
              onValueChange={(value) => updateField("imageCount", parseInt(value))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Image</SelectItem>
                <SelectItem value="2">2 Images</SelectItem>
                <SelectItem value="3">3 Images</SelectItem>
                <SelectItem value="4">4 Images</SelectItem>
                <SelectItem value="5">5 Images</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              AI-generated ad variations
            </p>
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
                <SelectValue placeholder="Select ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 (Stories/Reels)</SelectItem>
                <SelectItem value="4:5">4:5 (Feed)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Video Duration</Label>
          <Select
            value={formData.videoDuration}
            onValueChange={(value: "short" | "medium") =>
              updateField("videoDuration", value)
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (5-10s)</SelectItem>
              <SelectItem value="medium">Medium (15-30s)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default VideoAdForm;
