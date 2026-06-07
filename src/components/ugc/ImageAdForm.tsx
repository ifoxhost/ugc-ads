import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductUploader from "./ProductUploader";

export interface ImageAdFormData {
  productDescription: string;
  adCopy: string;
  characters: string;
  watermark: string;
  imageCount: number;
}

interface ImageAdFormProps {
  formData: ImageAdFormData;
  onFormChange: (data: ImageAdFormData) => void;
  imagePreview: string | null;
  onImageChange: (file: File | null, url?: string) => void;
  isSubmitting?: boolean;
}

const ImageAdForm = ({
  formData,
  onFormChange,
  imagePreview,
  onImageChange,
  isSubmitting,
}: ImageAdFormProps) => {
  const updateField = <K extends keyof ImageAdFormData>(
    field: K,
    value: ImageAdFormData[K]
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

      {/* Ad Details */}
      <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
        <h2 className="text-lg font-semibold mb-4">2. Ad Details</h2>
        
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
          <p className="text-xs text-muted-foreground">
            Helps AI understand your product better for more relevant ads
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adCopy">Ad Copy / Script (Optional)</Label>
          <Textarea
            id="adCopy"
            placeholder="Custom ad copy or text you want featured..."
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
          <p className="text-xs text-muted-foreground">
            Type of person to feature in your ad
          </p>
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
            Text to overlay on your generated images
          </p>
        </div>
      </div>

      {/* Generation Settings */}
      <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
        <h2 className="text-lg font-semibold mb-4">3. Generation Settings</h2>

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
            AI will generate {formData.imageCount} unique ad variation{formData.imageCount > 1 ? 's' : ''} from your product
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageAdForm;
