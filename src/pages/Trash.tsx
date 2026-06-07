import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Trash2, Loader2, Image, Video, RotateCcw, AlertCircle, 
  Clock, X, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
  DialogHeader, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface AdCopy {
  headline?: string;
  cta?: string;
  caption?: string;
  hashtags?: string[];
}

interface DeletedAd {
  id: string;
  product_image_url: string;
  generated_image_url: string | null;
  generated_video_url: string | null;
  ad_copy: AdCopy | null;
  style_template: string;
  aspect_ratio: string | null;
  status: string;
  created_at: string;
  deleted_at: string;
  email: string;
}

const STYLE_LABELS: Record<string, string> = {
  lifestyle: "Lifestyle",
  handheld: "Handheld Review",
  unboxing: "Unboxing",
  beforeafter: "Before & After",
  testimonial: "Testimonial",
  flatlay: "Flat Lay",
};

// Ads are permanently deleted after 14 days
const RETENTION_DAYS = 14;

const Trash = () => {
  const [deletedAds, setDeletedAds] = useState<DeletedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"single" | "bulk" | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDeletedAds();
  }, []);

  const fetchDeletedAds = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_ads')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      setDeletedAds((data || []).map(ad => ({
        ...ad,
        ad_copy: ad.ad_copy as AdCopy | null
      })));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch deleted ads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setIsRestoring(true);
    try {
      const { error } = await supabase
        .from('generated_ads')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;

      setDeletedAds(prev => prev.filter(ad => ad.id !== id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });

      toast({
        title: "Restored",
        description: "Ad has been restored to your library",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore ad",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return;
    
    setIsRestoring(true);
    let successCount = 0;

    for (const id of selectedIds) {
      try {
        const { error } = await supabase
          .from('generated_ads')
          .update({ deleted_at: null })
          .eq('id', id);

        if (!error) successCount++;
      } catch (error) {
        console.error('Restore error:', error);
      }
    }

    setDeletedAds(prev => prev.filter(ad => !selectedIds.has(ad.id)));
    setSelectedIds(new Set());
    setIsRestoring(false);

    toast({
      title: "Restored",
      description: `${successCount} ad${successCount > 1 ? 's' : ''} restored to your library`,
    });
  };

  const confirmPermanentDelete = (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget("single");
    setShowPermanentDeleteConfirm(true);
  };

  const confirmBulkPermanentDelete = () => {
    setDeleteTarget("bulk");
    setShowPermanentDeleteConfirm(true);
  };

  const handlePermanentDelete = async () => {
    setIsPermanentlyDeleting(true);

    if (deleteTarget === "single" && singleDeleteId) {
      try {
        const { error } = await supabase
          .from('generated_ads')
          .delete()
          .eq('id', singleDeleteId);

        if (error) throw error;

        setDeletedAds(prev => prev.filter(ad => ad.id !== singleDeleteId));
        toast({
          title: "Permanently Deleted",
          description: "Ad has been permanently deleted",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete ad",
          variant: "destructive",
        });
      }
    } else if (deleteTarget === "bulk") {
      let successCount = 0;

      for (const id of selectedIds) {
        try {
          const { error } = await supabase
            .from('generated_ads')
            .delete()
            .eq('id', id);

          if (!error) successCount++;
        } catch (error) {
          console.error('Delete error:', error);
        }
      }

      setDeletedAds(prev => prev.filter(ad => !selectedIds.has(ad.id)));
      setSelectedIds(new Set());

      toast({
        title: "Permanently Deleted",
        description: `${successCount} ad${successCount > 1 ? 's' : ''} permanently deleted`,
      });
    }

    setIsPermanentlyDeleting(false);
    setShowPermanentDeleteConfirm(false);
    setSingleDeleteId(null);
    setDeleteTarget(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === deletedAds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedAds.map(ad => ad.id)));
    }
  };

  const getStyleLabel = (styleId: string) => STYLE_LABELS[styleId] || styleId;

  const getDaysRemaining = (deletedAt: string) => {
    const deleteDate = new Date(deletedAt);
    const expiryDate = new Date(deleteDate.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysRemaining);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-tight font-bold flex items-center gap-3">
            <Trash2 className="h-8 w-8" />
            Trash
          </h1>
          <p className="text-muted-foreground mt-2">
            Deleted ads are kept for {RETENTION_DAYS} days before permanent deletion
          </p>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
            <span className="text-sm font-medium px-2">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={handleBulkRestore}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Restore
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmBulkPermanentDelete}
              disabled={isPermanentlyDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Forever
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {deletedAds.length === 0 ? (
        <div className="text-center py-20">
          <Trash2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground text-lg">Trash is empty</p>
          <p className="text-muted-foreground text-sm mt-2">Deleted ads will appear here</p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className="flex items-center justify-end mb-4">
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selectedIds.size === deletedAds.length ? (
                <X className="h-4 w-4 mr-2" />
              ) : (
                <Checkbox className="h-4 w-4 mr-2" checked={false} />
              )}
              {selectedIds.size === deletedAds.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {deletedAds.map((ad) => {
              const daysRemaining = getDaysRemaining(ad.deleted_at);
              const hasVideo = !!ad.generated_video_url;
              const displayUrl = ad.generated_video_url || ad.generated_image_url || ad.product_image_url;

              return (
                <Card 
                  key={ad.id} 
                  className={`overflow-hidden group relative opacity-75 hover:opacity-100 transition-opacity ${
                    selectedIds.has(ad.id) ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Selection Checkbox */}
                    <div 
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(ad.id);
                      }}
                    >
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                        selectedIds.has(ad.id) 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'bg-background/80 border-muted-foreground/50 hover:border-primary'
                      }`}>
                        {selectedIds.has(ad.id) && <span className="text-xs">✓</span>}
                      </div>
                    </div>

                    {/* Days Remaining Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <Badge 
                        variant={daysRemaining <= 7 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {daysRemaining} days left
                      </Badge>
                    </div>

                    {/* Preview */}
                    <div className="relative aspect-square">
                      {ad.status === 'failed' ? (
                        <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                          <span className="text-sm text-destructive">Failed</span>
                        </div>
                      ) : displayUrl ? (
                        <>
                          {hasVideo ? (
                            <video 
                              src={ad.generated_video_url!}
                              className="w-full h-full object-cover grayscale"
                              muted
                            />
                          ) : (
                            <img 
                              src={displayUrl}
                              alt={`Deleted Ad - ${getStyleLabel(ad.style_template)}`}
                              className="w-full h-full object-cover grayscale"
                            />
                          )}
                          
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleRestore(ad.id)}
                              disabled={isRestoring}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => confirmPermanentDelete(ad.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>

                          {/* Video indicator */}
                          {hasVideo && (
                            <div className="absolute bottom-2 left-2">
                              <Badge variant="secondary" className="text-xs">
                                <Video className="h-3 w-3 mr-1" />
                                Video
                              </Badge>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="p-3 border-t">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {getStyleLabel(ad.style_template)}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Deleted {new Date(ad.deleted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={showPermanentDeleteConfirm} onOpenChange={setShowPermanentDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently Delete?</DialogTitle>
            <DialogDescription>
              {deleteTarget === "bulk" 
                ? `Are you sure you want to permanently delete ${selectedIds.size} ad${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`
                : "Are you sure you want to permanently delete this ad? This cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPermanentDeleteConfirm(false);
                setSingleDeleteId(null);
                setDeleteTarget(null);
              }}
              disabled={isPermanentlyDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={isPermanentlyDeleting}
            >
              {isPermanentlyDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Forever
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Trash;
