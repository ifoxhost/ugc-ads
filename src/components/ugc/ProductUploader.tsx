import { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProductUploaderProps {
  onImageChange: (file: File | null, url?: string) => void;
  imagePreview: string | null;
  isUploading?: boolean;
}

const ProductUploader = ({ onImageChange, imagePreview, isUploading }: ProductUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onImageChange(file);
      }
    }
  }, [onImageChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageChange(e.target.files[0]);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onImageChange(null, urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  const handleRemove = () => {
    onImageChange(null);
    setUrlInput("");
  };

  if (imagePreview) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border">
        <img
          src={imagePreview}
          alt="Product preview"
          className="w-full aspect-square object-contain bg-muted/30"
        />
        <Button
          onClick={handleRemove}
          variant="destructive"
          size="icon"
          className="absolute top-3 right-3 rounded-full"
          disabled={isUploading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-200 bg-card/50",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
      >
        <label className="flex flex-col items-center justify-center py-16 cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <p className="text-foreground font-medium mb-1">
            Drop your product image here
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WEBP up to 10MB
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image URL..."
            className="flex-1"
          />
          <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => setShowUrlInput(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowUrlInput(true)}
          className="w-full"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Paste image URL
        </Button>
      )}
    </div>
  );
};

export default ProductUploader;
