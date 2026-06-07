import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import RenderProgressBar from "@/components/lyric/RenderProgressBar";
import { 
  Download, Loader2, Trash2, AlertCircle, Image, Video, Play, X, 
  LayoutGrid, Mail, Copy, Check, RefreshCw, Search, Filter, 
  CheckSquare, Square, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Undo2,
  User, Users, Music2, Share2, RotateCcw, Clock, Scissors, Film
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StoryboardManager from "@/components/lyric/StoryboardManager";
import { parseISO, differenceInDays, differenceInHours } from "date-fns";

// Format a duration in seconds → "m:ss" / "h:mm:ss" (mirrors OutputGallery card).
const formatVideoDuration = (seconds: number | null | undefined): string | null => {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

// 14-day retention countdown (mirrors OutputGallery card).
const getVideoExpiryInfo = (completedAt: string | null | undefined) => {
  if (!completedAt) return null;
  try {
    const completedDate = parseISO(completedAt);
    const expiryDate = new Date(completedDate);
    expiryDate.setDate(expiryDate.getDate() + 14);
    const now = new Date();
    const daysLeft = differenceInDays(expiryDate, now);
    const hoursLeft = differenceInHours(expiryDate, now) % 24;
    if (daysLeft < 0) return { daysLeft: 0, hoursLeft: 0, isExpiringSoon: true };
    return { daysLeft, hoursLeft, isExpiringSoon: daysLeft <= 3 };
  } catch { return null; }
};
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { AdminStatsPanel } from "@/components/library/AdminStatsPanel";

interface StitchValidation {
  stitcher?: string;
  requestedDurationSec?: number | null;
  measuredDurationSec?: number | null;
  driftSec?: number | null;
  toleranceSec?: number | null;
  withinTolerance?: boolean | null;
  attempts?: number | null;
  falAttempts?: number | null;
  falLastDriftSec?: number | null;
  validatedAt?: string | null;
}

interface StitchAuditEntry {
  stitcher: string;
  attempt: number;
  startedAt?: string;
  endedAt?: string;
  outcome?: string;
  measuredDurationSec?: number | null;
  driftSec?: number | null;
  withinTolerance?: boolean | null;
  requestedDurationSec?: number | null;
  tolerance?: number | null;
  error?: string;
  redactionApplied?: boolean;
}

interface StitchAudit {
  version?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  finalStitcher?: string;
  tolerance?: number | null;
  requestedDurationSec?: number | null;
  entries?: StitchAuditEntry[];
  redactionApplied?: boolean;
}

interface AdCopy {
  headline?: string;
  cta?: string;
  caption?: string;
  hashtags?: string[];
  // Lyric video fields
  title?: string;
  artist?: string;
  lyricsPreview?: string;
  fontTheme?: string;
  colorPalette?: string;
  pexelsBackgroundUrl?: string;
  pexelsBackgroundThumbnail?: string;
  stitchedBy?: string;
  stitchValidation?: StitchValidation;
  stitchAudit?: StitchAudit;
  sceneAudioSlices?: Array<{
    sceneId: string;
    index?: number;
    startSec: number;
    durationSec: number;
    url: string;
  }>;
  sceneAudioSliceErrors?: Array<{
    sceneId: string;
    index: number;
    reason: string;
    durationSec: number;
  }>;
  sceneAudioSlicesGeneratedAt?: string;
  cloudinaryAudio?: { publicId: string; durationSec: number; format: string };
  sceneAudioJobValidation?: {
    valid: boolean;
    totalFiles: number;
    totalDurationSec: number;
    limits: { maxFiles: number; maxTotalSec: number; maxPerSliceSec: number };
    errors: Array<{ sceneId: string; index: number; reason: string; durationSec: number; scope: "scene" | "job" }>;
  };
  sliceStatus?: {
    phase: "queued" | "uploading" | "slicing" | "validating" | "done" | "failed";
    at?: string;
    sliceCount?: number;
    errorCount?: number;
    error?: string;
    jobValid?: boolean;
  };
}

interface GeneratedAd {
  id: string;
  user_id: string;
  product_image_url: string;
  generated_image_url: string | null;
  generated_video_url: string | null;
  video_status: string | null;
  video_progress: number | null;
  ad_copy: AdCopy | null;
  style_template: string;
  aspect_ratio: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  email: string;
  prompt_used: string | null;
}

/** Returns true if this is a SongDoe music video record */
function isLyricVideo(ad: GeneratedAd): boolean {
  return !!(ad.prompt_used?.startsWith("SongDoe music video"));
}

const STYLE_LABELS: Record<string, string> = {
  kinetic: "Kinetic",
  minimal: "Minimal",
  neon: "Neon",
  cinematic: "Cinematic",
  waveform: "Waveform",
  karaoke: "Karaoke",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "style", label: "Style" },
  { value: "status", label: "Status" },
];

type SortDirection = "asc" | "desc";

const Library = () => {
  const { user, isAdmin } = useAuth();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedSliceKey, setCopiedSliceKey] = useState<string | null>(null);
  const [editingStoryboardAd, setEditingStoryboardAd] = useState<any | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  
  // Undo delete state
  const [pendingDeletes, setPendingDeletes] = useState<Map<string, { ad: GeneratedAd; timeoutId: ReturnType<typeof setTimeout> }>>(new Map());
  const UNDO_TIMEOUT = 8000; // 8 seconds to undo
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [emailFilter, setEmailFilter] = useState("all"); // Admin only
  
  // Sort states
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateFilter, setDateFilter] = useState("all");
  
  // Get unique emails for admin filter
  const uniqueEmails = useMemo(() => {
    if (!isAdmin) return [];
    const emails = [...new Set(ads.map(ad => ad.email))].sort();
    return emails;
  }, [ads, isAdmin]);
  
  const [mediaViewer, setMediaViewer] = useState<{
    isOpen: boolean;
    type: 'image' | 'video' | null;
    url: string | null;
    title: string | null;
    ad: GeneratedAd | null;
  }>({
    isOpen: false,
    type: null,
    url: null,
    title: null,
    ad: null,
  });

  // Dedicated AI music video player modal state
  const [lyricPlayer, setLyricPlayer] = useState<{
    isOpen: boolean;
    ad: GeneratedAd | null;
  }>({ isOpen: false, ad: null });

  const { toast } = useToast();

  // Filter and sort logic
  const filteredAndSortedAds = useMemo(() => {
    // First filter (exclude pending deletes)
    const filtered = ads.filter(ad => {
      // Exclude ads pending deletion
      if (pendingDeletes.has(ad.id)) return false;
      
      // Impersonation filter - show only the impersonated user's ads
      if (isAdmin && impersonatedUserId && ad.user_id !== impersonatedUserId) return false;
      
      // Status filter
      if (statusFilter !== "all" && ad.status !== statusFilter) return false;
      
      // Style filter
      if (styleFilter !== "all" && ad.style_template !== styleFilter) return false;
      
      // Email filter (admin only, skip if impersonating)
      if (isAdmin && !impersonatedUserId && emailFilter !== "all" && ad.email !== emailFilter) return false;
      
      // Date filter
      if (dateFilter !== "all") {
        const adDate = new Date(ad.created_at);
        const now = new Date();
        
        if (dateFilter === "today") {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (adDate < today) return false;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (adDate < weekAgo) return false;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (adDate < monthAgo) return false;
        }
      }
      
      // Search filter (search in style label, ad copy, and email for admins)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const styleLabel = getStyleLabel(ad.style_template).toLowerCase();
        const headline = ad.ad_copy?.headline?.toLowerCase() || "";
        const caption = ad.ad_copy?.caption?.toLowerCase() || "";
        const email = isAdmin ? ad.email.toLowerCase() : "";
        
        if (!styleLabel.includes(query) && !headline.includes(query) && !caption.includes(query) && !email.includes(query)) {
          return false;
        }
      }
      
      return true;
    });

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "date") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "style") {
        comparison = getStyleLabel(a.style_template).localeCompare(getStyleLabel(b.style_template));
      } else if (sortBy === "status") {
        const statusOrder = { completed: 0, processing: 1, failed: 2 };
        comparison = (statusOrder[a.status as keyof typeof statusOrder] || 3) - 
                     (statusOrder[b.status as keyof typeof statusOrder] || 3);
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [ads, statusFilter, styleFilter, emailFilter, dateFilter, searchQuery, sortBy, sortDirection, pendingDeletes, isAdmin, impersonatedUserId]);

  const openMediaViewer = (type: 'image' | 'video', url: string, title: string, ad: GeneratedAd) => {
    setMediaViewer({ isOpen: true, type, url, title, ad });
  };

  const closeMediaViewer = () => {
    setMediaViewer({ isOpen: false, type: null, url: null, title: null, ad: null });
  };

  // Keep the open job-details ad in sync with realtime updates (so the
  // Re-slice audio status panel re-renders as ad_copy.sliceStatus changes).
  useEffect(() => {
    if (!mediaViewer.isOpen || !mediaViewer.ad) return;
    const fresh = ads.find(a => a.id === mediaViewer.ad!.id);
    if (fresh && fresh !== mediaViewer.ad) {
      setMediaViewer(mv => mv.ad ? { ...mv, ad: fresh } : mv);
    }
  }, [ads, mediaViewer.isOpen, mediaViewer.ad]);

  // Realtime subscription dedicated to the currently-open job's slice status.
  // Replaces the previous 2s polling fallback; UPDATE events on this row
  // propagate instantly into ads → mediaViewer.ad via the sync effect above.
  useEffect(() => {
    if (!mediaViewer.isOpen || !mediaViewer.ad?.id) return;
    const adId = mediaViewer.ad.id;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;

    const subscribe = () => {
      if (cancelled) return;
      // Tear down any previous instance before creating a new one.
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* ignore */ }
        channel = null;
      }
      channel = supabase
        .channel(`reslice-${adId}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "generated_ads", filter: `id=eq.${adId}` },
          () => { fetchAds(); },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            attempt = 0;
            // Snap state on (re)connect so we don't miss events fired while offline.
            fetchAds();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (cancelled) return;
            attempt += 1;
            const delay = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5));
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(subscribe, delay);
          }
        });
    };

    subscribe();

    // Resume on tab focus / network back online (channel may have gone stale).
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchAds();
        subscribe();
      }
    };
    const onOnline = () => { fetchAds(); subscribe(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (channel) { try { supabase.removeChannel(channel); } catch { /* ignore */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaViewer.isOpen, mediaViewer.ad?.id]);

  // Per-job transition toast — fires at most once per terminal (done/failed)
  // state, even if duplicate or out-of-order realtime events arrive.
  useEffect(() => {
    if (!mediaViewer.isOpen || !mediaViewer.ad) return;
    const adId = mediaViewer.ad.id;
    const phase = mediaViewer.ad.ad_copy?.sliceStatus?.phase ?? null;
    const prev = lastSlicePhaseByAdRef.current.get(adId) ?? null;
    lastSlicePhaseByAdRef.current.set(adId, phase);
    if (phase !== "done" && phase !== "failed") return;

    const terminalKey = `${adId}:${phase}`;
    if (firedTerminalToastsRef.current.has(terminalKey)) return; // already toasted
    // Only fire when we actually transition into this terminal state during
    // this session (skip if the viewer opened with the state already set).
    if (prev === phase) return;
    firedTerminalToastsRef.current.add(terminalKey);

    if (phase === "done") {
      const count = mediaViewer.ad.ad_copy?.sliceStatus?.sliceCount ?? 0;
      sonner.success("Audio re-slice complete", {
        description: `${count} scene slice${count === 1 ? "" : "s"} ready.`,
      });
    } else {
      const err = mediaViewer.ad.ad_copy?.sliceStatus?.error ?? "Unknown error";
      sonner.error("Audio re-slice failed", { description: err });
    }
  }, [mediaViewer.isOpen, mediaViewer.ad?.id, mediaViewer.ad?.ad_copy?.sliceStatus?.phase]);


  // Track which ad IDs were "processing" so we can detect transitions → completed
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  // Last-seen slice phase per ad-id — prevents duplicate transition toasts.
  const lastSlicePhaseByAdRef = useRef<Map<string, string | null>>(new Map());
  // Terminal toast guard — keys like `${adId}:done` / `${adId}:failed`.
  const firedTerminalToastsRef = useRef<Set<string>>(new Set());



  useEffect(() => {
    fetchAds();

    const channel = supabase
      .channel('generated-ads-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'generated_ads' },
        (payload) => {
          const updated = payload.new as GeneratedAd;
          const prevStatus = prevStatusMapRef.current.get(updated.id);
          // Fire toast when a AI music video transitions to completed
          if (
            isLyricVideo(updated) &&
            prevStatus === 'processing' &&
            updated.status === 'completed'
          ) {
            const title  = (updated.ad_copy as AdCopy | null)?.title || "Your AI music video";
            const artist = (updated.ad_copy as AdCopy | null)?.artist;
            toast({
              title: "🎬 Video ready!",
              description: `"${title}"${artist ? ` by ${artist}` : ""} has finished rendering.`,
              duration: 8000,
            });
          }
          fetchAds();
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generated_ads' }, fetchAds)
      .subscribe();

    const pollInterval = setInterval(() => {
      const hasProcessing = ads.some(a => a.status === 'processing');
      if (hasProcessing) fetchAds();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      pendingDeletes.forEach(({ timeoutId }) => clearTimeout(timeoutId));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads]);

  const fetchAds = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(ad => ({
        ...ad,
        ad_copy: ad.ad_copy as AdCopy | null,
      }));

      // Update prevStatusMap so we can detect transitions in the realtime handler
      prevStatusMapRef.current = new Map(mapped.map(a => [a.id, a.status]));

      setAds(mapped);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch your ads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string): Promise<boolean> => {
    try {
      const isSupabaseStorage = url.includes('supabase.co/storage');
      
      if (isSupabaseStorage) {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } else if (url.includes('drive.google.com')) {
        const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
          const fileId = driveMatch[1];
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          window.open(downloadUrl, '_blank');
        } else {
          window.open(url, '_blank');
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return true;
    } catch (error) {
      console.error('Download error:', error);
      window.open(url, '_blank');
      return false;
    }
  };

  const handleBatchDownload = async () => {
    const selectedAds = ads.filter(ad => selectedIds.has(ad.id));
    const downloadableAds = selectedAds.filter(ad => ad.generated_image_url || ad.generated_video_url);
    
    if (downloadableAds.length === 0) {
      toast({
        title: "No downloadable ads",
        description: "Selected ads don't have any generated content yet",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingBatch(true);
    let successCount = 0;

    for (const ad of downloadableAds) {
      const url = ad.generated_video_url || ad.generated_image_url!;
      const ext = ad.generated_video_url ? 'mp4' : 'jpg';
      const filename = `ugc-ad-${ad.id.slice(0, 8)}.${ext}`;
      
      const success = await handleDownload(url, filename);
      if (success) successCount++;
      
      // Small delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsDownloadingBatch(false);
    setSelectedIds(new Set());
    
    toast({
      title: "Batch Download Complete",
      description: `Downloaded ${successCount} of ${downloadableAds.length} ads`,
    });
  };

  // Soft delete function (moves to trash after undo timeout)
  const moveToTrash = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('generated_ads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Remove from local state (will appear in trash)
      setAds(prev => prev.filter(ad => ad.id !== id));
    } catch (error) {
      console.error('Move to trash error:', error);
    } finally {
      setPendingDeletes(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  }, []);

  // Undo delete function
  const undoDelete = useCallback((id: string) => {
    const pending = pendingDeletes.get(id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      setPendingDeletes(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      toast({
        title: "Restored",
        description: "Ad has been restored",
      });
    }
  }, [pendingDeletes, toast]);

  // Soft delete with undo capability
  const softDeleteAd = useCallback((ad: GeneratedAd) => {
    const timeoutId = setTimeout(() => {
      moveToTrash(ad.id);
    }, UNDO_TIMEOUT);

    setPendingDeletes(prev => {
      const newMap = new Map(prev);
      newMap.set(ad.id, { ad, timeoutId });
      return newMap;
    });

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(ad.id);
      return newSet;
    });

    toast({
      title: "Ad deleted",
      description: "Click undo to restore",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => undoDelete(ad.id)}
          className="gap-1"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </Button>
      ),
      duration: UNDO_TIMEOUT,
    });
  }, [moveToTrash, undoDelete, toast, UNDO_TIMEOUT]);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const adsToDelete = ads.filter(ad => selectedIds.has(ad.id));
    const count = adsToDelete.length;
    
    // Soft delete all selected ads
    adsToDelete.forEach(ad => {
      const timeoutId = setTimeout(() => {
        moveToTrash(ad.id);
      }, UNDO_TIMEOUT);

      setPendingDeletes(prev => {
        const newMap = new Map(prev);
        newMap.set(ad.id, { ad, timeoutId });
        return newMap;
      });
    });
    
    setSelectedIds(new Set());
    
    toast({
      title: `${count} ad${count > 1 ? 's' : ''} deleted`,
      description: "Click undo to restore all",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            adsToDelete.forEach(ad => undoDelete(ad.id));
          }}
          className="gap-1"
        >
          <Undo2 className="h-3 w-3" />
          Undo All
        </Button>
      ),
      duration: UNDO_TIMEOUT,
    });
  };

  const confirmSingleDelete = (id: string) => {
    setSingleDeleteId(id);
  };

  const handleDelete = async () => {
    if (!singleDeleteId) return;
    
    const adToDelete = ads.find(ad => ad.id === singleDeleteId);
    if (!adToDelete) {
      setSingleDeleteId(null);
      return;
    }
    
    // Soft delete with undo
    softDeleteAd(adToDelete);
    closeMediaViewer();
    setSingleDeleteId(null);
  };

  const handleRetry = async (ad: GeneratedAd) => {
    setRetryingIds(prev => new Set(prev).add(ad.id));
    
    try {
      // Update status back to processing
      const { error: updateError } = await supabase
        .from('generated_ads')
        .update({ 
          status: 'processing',
          completed_at: null,
          generated_image_url: null,
          generated_video_url: null,
          ad_copy: null,
        })
        .eq('id', ad.id);

      if (updateError) throw updateError;

      // Call the edge function to reprocess
      const { error: functionError } = await supabase.functions.invoke('submit-ugc-request', {
        body: {
          adId: ad.id,
          productImageUrl: ad.product_image_url,
          styleTemplate: ad.style_template,
          aspectRatio: ad.aspect_ratio || '1:1',
          email: ad.email,
          isRetry: true,
        }
      });

      if (functionError) throw functionError;

      toast({
        title: "Retry Initiated",
        description: "Your ad is being regenerated. Check back shortly.",
      });
    } catch (error) {
      console.error('Retry error:', error);
      toast({
        title: "Retry Failed",
        description: "Failed to retry the generation. Please try again.",
        variant: "destructive",
      });
      
      // Revert status back to failed
      await supabase
        .from('generated_ads')
        .update({ status: 'failed' })
        .eq('id', ad.id);
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ad.id);
        return newSet;
      });
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  /** Copy a direct MP4 URL to clipboard with toast */
  const shareVideoUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Direct video URL copied to clipboard." });
    } catch {
      toast({ title: "Error", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  /** Robust clipboard write with fallback for blocked / non-secure contexts */
  const writeToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const [copyFallbacks, setCopyFallbacks] = useState<Record<string, { value: string; label: string }>>({});

  const copySliceField = useCallback(async (value: string, label: string, key: string) => {
    const ok = await writeToClipboard(value);
    if (ok) {
      sonner.success(`${label} copied`, {
        description: value.length > 80 ? `${value.slice(0, 80)}…` : value,
      });
      setCopiedSliceKey(key);
      setTimeout(() => setCopiedSliceKey((prev) => (prev === key ? null : prev)), 2000);
      // Clear any prior fallback for this key on success
      setCopyFallbacks((prev) => {
        if (!(key in prev)) return prev;
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
    } else {
      sonner.error("Copy failed", {
        description: "Clipboard access is blocked. Select the text below and press Ctrl/Cmd+C.",
      });
      setCopyFallbacks((prev) => ({ ...prev, [key]: { value, label } }));
    }
  }, []);

  const dismissCopyFallback = useCallback((key: string) => {
    setCopyFallbacks((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);


  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [restitchingIds, setRestitchingIds] = useState<Set<string>>(new Set());
  const [reslicingIds, setReslicingIds] = useState<Set<string>>(new Set());

  const handleReslice = async (ad: GeneratedAd) => {
    setReslicingIds(prev => new Set(prev).add(ad.id));
    // Allow toasts to fire again for this ad's next terminal state.
    firedTerminalToastsRef.current.delete(`${ad.id}:done`);
    firedTerminalToastsRef.current.delete(`${ad.id}:failed`);

    try {
      const res = await supabase.functions.invoke("slice-suno-audio", {
        body: { adId: ad.id, force: true },
      });
      if (res.error) throw res.error;
      const data = res.data as { count?: number; errorCount?: number } | null;
      toast({
        title: "Audio re-sliced",
        description: `${data?.count ?? 0} scene slice${data?.count === 1 ? "" : "s"} generated${
          data?.errorCount ? ` • ${data.errorCount} violation${data.errorCount === 1 ? "" : "s"}` : ""
        }.`,
        variant: data?.errorCount ? "destructive" : "default",
      });
      fetchAds();
    } catch (err: any) {
      console.error("Re-slice error:", err);
      toast({
        title: "Re-slice failed",
        description: err?.message ?? "Could not re-slice audio.",
        variant: "destructive",
      });
    } finally {
      setReslicingIds(prev => { const s = new Set(prev); s.delete(ad.id); return s; });
    }
  };
  const [isBatchRegenerating, setIsBatchRegenerating] = useState(false);

  /** Estimated duration in seconds from lyric line count */
  function estimateDuration(lyricsPreview: string | undefined): string | null {
    if (!lyricsPreview) return null;
    const lines = lyricsPreview.split("\n").filter(l => l.trim().length > 0);
    const seconds = Math.round(lines.length * 3);
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs === 0 ? `~${mins}m` : `~${mins}m ${secs}s`;
  }

  const handleBatchRegenerate = async () => {
    const failedLyricAds = ads.filter(
      a => isLyricVideo(a) && (a.status === 'failed' || a.status === 'video_failed') && a.ad_copy
    );
    if (failedLyricAds.length === 0) return;
    setIsBatchRegenerating(true);
    let queued = 0;
    for (const ad of failedLyricAds) {
      try {
        const res = await supabase.functions.invoke("submit-lyric-video", {
          body: {
            songTitle:    ad.ad_copy!.title        || "",
            artist:       ad.ad_copy!.artist       || "",
            lyrics:       ad.ad_copy!.lyricsPreview|| "",
            template:     ad.style_template,
            aspectRatio:  ad.aspect_ratio          || "9:16",
            fontTheme:    ad.ad_copy!.fontTheme    || "bold",
            colorPalette: ad.ad_copy!.colorPalette || "dark",
            variationCount: 1,
          },
        });
        if (!res.error) queued++;
      } catch { /* continue */ }
    }
    setIsBatchRegenerating(false);
    toast({
      title: `${queued} video${queued !== 1 ? "s" : ""} re-queued`,
      description: "Failed renders have been resubmitted to Shotstack.",
    });
    fetchAds();
  };

  const handleRegenerate = async (ad: GeneratedAd) => {
    if (!ad.ad_copy) return;
    setRegeneratingIds(prev => new Set(prev).add(ad.id));
    try {
      const res = await supabase.functions.invoke("submit-lyric-video", {
        body: {
          songTitle:      ad.ad_copy.title         || "",
          artist:         ad.ad_copy.artist        || "",
          lyrics:         ad.ad_copy.lyricsPreview || "",
          template:       ad.style_template,
          aspectRatio:    ad.aspect_ratio          || "9:16",
          fontTheme:      ad.ad_copy.fontTheme     || "bold",
          colorPalette:   ad.ad_copy.colorPalette  || "dark",
          variationCount: 1,
          pexelsBackgroundUrl:       ad.ad_copy.pexelsBackgroundUrl       ?? null,
          pexelsBackgroundThumbnail: ad.ad_copy.pexelsBackgroundThumbnail ?? null,
        },
      });
      if (res.error) throw res.error;
      toast({ title: "Regenerating!", description: "A new render has been queued." });
    } catch (err) {
      console.error("Regenerate error:", err);
      toast({ title: "Failed", description: "Could not start regeneration.", variant: "destructive" });
    } finally {
      setRegeneratingIds(prev => { const s = new Set(prev); s.delete(ad.id); return s; });
    }
  };

  const handleRestitch = async (
    ad: GeneratedAd,
    overrides?: { falMaxAttempts?: number; toleranceSec?: number },
  ) => {
    setRestitchingIds(prev => new Set(prev).add(ad.id));
    try {
      const res = await supabase.functions.invoke("stitch-lyric-video", {
        body: { adId: ad.id, overrides },
      });
      if (res.error) throw res.error;
      const via = (res.data as any)?.via ?? "unknown";
      const drift = (res.data as any)?.drift?.delta;
      if (via === "fal") {
        toast({
          title: "Re-stitch succeeded",
          description: `fal.ai compose accepted${drift != null ? ` (drift ${Number(drift).toFixed(2)}s)` : ""}.`,
        });
      } else if (via === "shotstack") {
        toast({
          title: "Fell back to Shotstack",
          description: `fal.ai exhausted retries${drift != null ? `; Shotstack drift ${Number(drift).toFixed(2)}s` : ""}.`,
        });
      } else {
        toast({
          title: "Re-stitch could not produce a clean cut",
          description: "Published the first clip as a safety net. Check the audit trail.",
          variant: "destructive",
        });
      }
      fetchAds();
    } catch (err: any) {
      console.error("Re-stitch error:", err);
      toast({
        title: "Re-stitch failed",
        description: err?.message ?? "Could not start re-stitch.",
        variant: "destructive",
      });
    } finally {
      setRestitchingIds(prev => { const s = new Set(prev); s.delete(ad.id); return s; });
    }
  };

  const downloadStitchAudit = (ad: GeneratedAd) => {
    const audit = ad.ad_copy?.stitchAudit ?? null;
    const validation = ad.ad_copy?.stitchValidation ?? null;
    const payload = {
      adId: ad.id,
      exportedAt: new Date().toISOString(),
      finalStitcher: ad.ad_copy?.stitchedBy ?? validation?.stitcher ?? null,
      stitchValidation: validation,
      stitchAudit: audit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stitch-audit-${ad.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStyleLabel = (styleId: string) => STYLE_LABELS[styleId] || styleId;

  const toggleSelectAll = () => {
    const selectableAds = filteredAndSortedAds.filter(ad => ad.status !== 'processing');
    if (selectedIds.size === selectableAds.length && selectableAds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableAds.map(ad => ad.id)));
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
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

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setStyleFilter("all");
    setDateFilter("all");
    setEmailFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || styleFilter !== "all" || dateFilter !== "all" || (isAdmin && emailFilter !== "all");

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const imageAds = filteredAndSortedAds.filter(a => a.generated_image_url && !a.generated_video_url);
  const videoAds = filteredAndSortedAds.filter(a => a.generated_video_url && !isLyricVideo(a));
  const lyricAds = filteredAndSortedAds.filter(a => isLyricVideo(a));
  const selectableAds = filteredAndSortedAds.filter(a => a.status !== 'processing');
  
  // Get all downloadable video ads for "Download All Videos" button
  const downloadableVideoAds = ads.filter(a => a.generated_video_url && a.status === 'video_completed');
  
  const handleDownloadAllVideos = async () => {
    if (downloadableVideoAds.length === 0) {
      toast({
        title: "No videos to download",
        description: "You don't have any completed video ads yet",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingBatch(true);
    let successCount = 0;

    for (const ad of downloadableVideoAds) {
      if (ad.generated_video_url) {
        const filename = `ugc-video-${ad.id.slice(0, 8)}.mp4`;
        const success = await handleDownload(ad.generated_video_url, filename);
        if (success) successCount++;
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsDownloadingBatch(false);
    
    toast({
      title: "Download Complete",
      description: `Downloaded ${successCount} of ${downloadableVideoAds.length} video ads`,
    });
  };

  if (editingStoryboardAd) {
    return (
      <StoryboardManager
        ad={editingStoryboardAd}
        onClose={() => setEditingStoryboardAd(null)}
        onSave={(updatedAd) => {
          setAds((prev) =>
            prev.map((ad) => (ad.id === updatedAd.id ? updatedAd : ad))
          );
          setEditingStoryboardAd(updatedAd);
          fetchAds();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Admin Stats Panel */}
      {isAdmin && ads.length > 0 && (
        <AdminStatsPanel
          ads={ads}
          impersonatedUserId={impersonatedUserId}
          onImpersonate={setImpersonatedUserId}
          currentUserId={user?.id}
        />
      )}

      {/* Impersonation Banner */}
      {isAdmin && impersonatedUserId && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between">
          <span className="text-sm text-primary font-medium">
            👁️ You are viewing the library as this user would see it
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setImpersonatedUserId(null)}
            className="text-primary border-primary/30 hover:bg-primary/10"
          >
            Exit Impersonation
          </Button>
        </div>
      )}

      {/* Render progress bar — shows when AI music video jobs are active */}
      <RenderProgressBar pollInterval={5000} className="mb-6" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-tight font-bold">
          {isAdmin && impersonatedUserId 
            ? `${ads.find(a => a.user_id === impersonatedUserId)?.email}'s Library`
            : "Your Library"
          }
        </h1>
        
        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
            <span className="text-sm font-medium px-2">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={handleBatchDownload}
              disabled={isDownloadingBatch || isDeletingBatch}
            >
              {isDownloadingBatch ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDownloadingBatch || isDeletingBatch}
            >
              {isDeletingBatch ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
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

      {/* Filters */}
      {ads.length > 0 && (
        <div className="flex flex-col md:flex-row gap-3 mb-6 max-w-6xl flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isAdmin ? "Search by style, headline, email..." : "Search by style, headline..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Email Filter (Admin Only) */}
          {isAdmin && uniqueEmails.length > 0 && (
            <Select value={emailFilter} onValueChange={setEmailFilter}>
              <SelectTrigger className="w-[200px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users ({uniqueEmails.length})</SelectItem>
                {uniqueEmails.map(email => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Style Filter */}
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Styles</SelectItem>
              {Object.entries(STYLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sorting */}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortDirection}
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              {sortDirection === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {ads.length === 0 ? (
        <div className="text-center py-20">
          <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground text-lg">No videos yet</p>
          <p className="text-muted-foreground text-sm mt-2">Create your first AI music video to see it here</p>
        </div>
      ) : filteredAndSortedAds.length === 0 ? (
        <div className="text-center py-20">
          <Filter className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground text-lg">No ads match your filters</p>
          <Button variant="outline" onClick={clearFilters} className="mt-4">
            Clear Filters
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="all" className="max-w-6xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="all">
                <LayoutGrid className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">All ({filteredAndSortedAds.length})</span>
              </TabsTrigger>
              <TabsTrigger value="lyric">
                <Music2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">AI Music Videos ({lyricAds.length})</span>
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Images ({imageAds.length})</span>
              </TabsTrigger>
              <TabsTrigger value="videos">
                <Video className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Videos ({videoAds.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Select All */}
            {selectableAds.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedIds.size === selectableAds.length && selectableAds.length > 0 ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Select All
                </Button>
                
                {/* Download All Videos Button */}
                {downloadableVideoAds.length > 0 && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleDownloadAllVideos}
                    disabled={isDownloadingBatch}
                    className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:from-primary/20 hover:to-primary/10"
                  >
                    {isDownloadingBatch ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4 mr-2" />
                    )}
                    Download All Videos ({downloadableVideoAds.length})
                  </Button>
                )}

                {/* Batch Regenerate Failed AI Music Videos */}
                {(() => {
                  const failedLyricCount = ads.filter(
                    a => isLyricVideo(a) && (a.status === 'failed' || a.status === 'video_failed') && a.ad_copy
                  ).length;
                  return failedLyricCount > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchRegenerate}
                      disabled={isBatchRegenerating}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {isBatchRegenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Re-queue Failed ({failedLyricCount})
                    </Button>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedAds.map((ad) => renderAdCard(ad))}
            </div>
          </TabsContent>

          <TabsContent value="lyric" className="space-y-4">
            {lyricAds.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No AI music videos yet</p>
                <p className="text-xs mt-1">Create your first AI music video on the Create page</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lyricAds.map((ad) => renderAdCard(ad))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            {imageAds.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No image ads match your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageAds.map((ad) => renderAdCard(ad))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-4">
            {videoAds.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No video ads match your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videoAds.map((ad) => renderAdCard(ad))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected ad{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeletingBatch}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteConfirm(false);
                handleBatchDelete();
              }}
              disabled={isDeletingBatch}
            >
              {isDeletingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedIds.size} Ad{selectedIds.size > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <Dialog open={!!singleDeleteId} onOpenChange={(open) => !open && setSingleDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ad? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSingleDeleteId(null)}
              disabled={isDeletingSingle}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeletingSingle}
            >
              {isDeletingSingle ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Ad
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Viewer Dialog */}
      <Dialog open={mediaViewer.isOpen} onOpenChange={closeMediaViewer}>
        <DialogContent className="max-w-4xl w-full p-0 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">{mediaViewer.title}</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={closeMediaViewer}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {mediaViewer.type === 'image' && mediaViewer.url && (
              <div className="p-4">
                <img 
                  src={mediaViewer.url} 
                  alt={mediaViewer.title || 'Generated ad'}
                  className="w-full h-auto max-h-[50vh] object-contain rounded-lg"
                />
              </div>
            )}
            
            {mediaViewer.type === 'video' && mediaViewer.url && (
              <div className="p-4">
                <video 
                  src={mediaViewer.url}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[50vh] rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Ad Copy Section */}
            {mediaViewer.ad?.ad_copy && (
              <div className="p-4 border-t space-y-4">
                <h3 className="font-semibold text-lg">Ad Copy</h3>
                
                {mediaViewer.ad.ad_copy.headline && (
                  <CopyableField 
                    label="Headline" 
                    value={mediaViewer.ad.ad_copy.headline} 
                    field="Headline"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                )}
                
                {mediaViewer.ad.ad_copy.cta && (
                  <CopyableField 
                    label="Call to Action" 
                    value={mediaViewer.ad.ad_copy.cta} 
                    field="CTA"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                )}
                
                {mediaViewer.ad.ad_copy.caption && (
                  <CopyableField 
                    label="Caption" 
                    value={mediaViewer.ad.ad_copy.caption} 
                    field="Caption"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                )}
                
                {mediaViewer.ad.ad_copy.hashtags && mediaViewer.ad.ad_copy.hashtags.length > 0 && (
                  <CopyableField 
                    label="Hashtags" 
                    value={mediaViewer.ad.ad_copy.hashtags.join(' ')} 
                    field="Hashtags"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                )}
              </div>
            )}

            {/* Render diagnostics (AI music videos) */}
            {mediaViewer.ad && isLyricVideo(mediaViewer.ad) && mediaViewer.ad.ad_copy?.stitchValidation && (
              <div className="p-4 border-t space-y-2">
                <h3 className="font-semibold text-lg">Render details</h3>
                {(() => {
                  const v = mediaViewer.ad!.ad_copy!.stitchValidation!;
                  const fmt = (n: number | null | undefined, unit = "s") =>
                    n == null ? "—" : `${Number(n).toFixed(2)}${unit}`;
                  const within = v.withinTolerance;
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Stitcher</span>
                      <span className="font-mono">{v.stitcher ?? mediaViewer.ad!.ad_copy!.stitchedBy ?? "—"}</span>
                      <span className="text-muted-foreground">Requested duration</span>
                      <span className="font-mono">{fmt(v.requestedDurationSec)}</span>
                      <span className="text-muted-foreground">Final duration</span>
                      <span className="font-mono">{fmt(v.measuredDurationSec)}</span>
                      <span className="text-muted-foreground">Drift</span>
                      <span className={`font-mono ${within === false ? "text-destructive" : within ? "text-primary" : ""}`}>
                        {fmt(v.driftSec)} {within === true ? "✓" : within === false ? "⚠" : ""}
                      </span>
                      <span className="text-muted-foreground">Tolerance</span>
                      <span className="font-mono">±{fmt(v.toleranceSec)}</span>
                      {v.attempts != null && (
                        <>
                          <span className="text-muted-foreground">Attempts</span>
                          <span className="font-mono">{v.attempts}</span>
                        </>
                      )}
                      {v.falAttempts != null && v.falAttempts > 0 && v.stitcher !== "fal.ai/compose" && (
                        <>
                          <span className="text-muted-foreground">fal.ai attempts</span>
                          <span className="font-mono">
                            {v.falAttempts} (last drift {fmt(v.falLastDriftSec)})
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Audit trail with per-attempt diff highlighting */}
                {mediaViewer.ad!.ad_copy!.stitchAudit?.entries?.length ? (
                  <details className="mt-3 text-sm" open>
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Decision audit trail ({mediaViewer.ad!.ad_copy!.stitchAudit!.entries!.length} attempt{mediaViewer.ad!.ad_copy!.stitchAudit!.entries!.length === 1 ? "" : "s"})
                      {mediaViewer.ad!.ad_copy!.stitchAudit!.redactionApplied === false && (
                        <span className="ml-2 text-destructive">• secrets NOT redacted</span>
                      )}
                    </summary>
                    <ol className="mt-2 space-y-1 pl-4 list-decimal">
                      {mediaViewer.ad!.ad_copy!.stitchAudit!.entries!.map((e, i, arr) => {
                        const prev = i > 0 ? arr[i - 1] : null;
                        const fmt = (n: number | null | undefined) =>
                          n == null ? "—" : `${Number(n).toFixed(2)}s`;
                        const tone =
                          e.outcome === "accepted" ? "text-primary" :
                          e.outcome === "accepted_with_drift" ? "text-amber-500" :
                          e.outcome === "drift_rejected" || e.outcome === "error" ? "text-destructive" :
                          "text-muted-foreground";
                        const diff = (cur: number | null | undefined, old: number | null | undefined) => {
                          if (cur == null || old == null) return null;
                          const d = cur - old;
                          if (Math.abs(d) < 0.005) return <span className="text-muted-foreground"> =</span>;
                          const arrow = d > 0 ? "▲" : "▼";
                          const col = d > 0 ? "text-amber-500" : "text-primary";
                          return <span className={`${col} ml-1`}>{arrow}{Math.abs(d).toFixed(2)}s</span>;
                        };
                        const stitcherChanged = prev && prev.stitcher !== e.stitcher;
                        return (
                          <li key={i} className={`font-mono text-xs ${tone}`}>
                            <span className={stitcherChanged ? "underline decoration-amber-500" : ""}>
                              [{e.stitcher} #{e.attempt}]
                            </span>{" "}
                            {e.outcome ?? "—"}
                            {e.driftSec != null && (
                              <>
                                {" • drift "}{fmt(e.driftSec)}{diff(e.driftSec, prev?.driftSec)}
                              </>
                            )}
                            {e.measuredDurationSec != null && (
                              <>
                                {" • measured "}{fmt(e.measuredDurationSec)}{diff(e.measuredDurationSec, prev?.measuredDurationSec)}
                              </>
                            )}
                            {e.error && ` • ${e.error}`}
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                ) : null}

                {/* Re-stitch (with per-job overrides) + audit export */}
                <RestitchControls
                  ad={mediaViewer.ad!}
                  busy={restitchingIds.has(mediaViewer.ad!.id)}
                  onRestitch={handleRestitch}
                  onDownloadAudit={downloadStitchAudit}
                />
              </div>
            )}

            {/* Seedance audio slices (Cloudinary) */}
            {mediaViewer.ad && isLyricVideo(mediaViewer.ad) && (
              (() => {
                const ac = mediaViewer.ad!.ad_copy;
                const slices = ac?.sceneAudioSlices ?? [];
                const errors = ac?.sceneAudioSliceErrors ?? [];
                const hasAny = slices.length > 0 || errors.length > 0 || !!ac?.cloudinaryAudio || !!ac?.sliceStatus;
                if (!hasAny) return null;
                const errorBySceneId = new Map<string, typeof errors>();
                errors.forEach((e) => {
                  const list = errorBySceneId.get(e.sceneId) ?? [];
                  list.push(e);
                  errorBySceneId.set(e.sceneId, list);
                });
                const adId = mediaViewer.ad!.id;
                const reslicing = reslicingIds.has(adId);
                const status = ac?.sliceStatus;
                const jobVal = ac?.sceneAudioJobValidation;
                const isActivePhase =
                  status?.phase === "queued" ||
                  status?.phase === "uploading" ||
                  status?.phase === "slicing" ||
                  status?.phase === "validating";
                const phaseLabel: Record<string, string> = {
                  queued: "Queued",
                  uploading: "Uploading audio to Cloudinary…",
                  slicing: "Generating per-scene slices…",
                  validating: "Validating against Seedance limits…",
                  done: "Slicing finished",
                  failed: "Slicing failed",
                };
                const phasePct: Record<string, number> = {
                  queued: 10, uploading: 35, slicing: 65, validating: 85, done: 100, failed: 100,
                };
                const copyMeta = (sl: typeof slices[number]) => {
                  const payload = JSON.stringify(
                    { startSec: sl.startSec, durationSec: sl.durationSec, url: sl.url }, null, 2,
                  );
                  copySliceField(payload, `Scene ${Number(sl.index ?? 0) + 1} metadata`, `json-${sl.sceneId}`);
                };
                return (
                  <div className="p-4 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Scissors className="h-4 w-4" />
                        Seedance audio slices
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reslicing || isActivePhase}
                        onClick={() => handleReslice(mediaViewer.ad!)}
                      >
                        {(reslicing || isActivePhase) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {isActivePhase
                          ? (phaseLabel[status!.phase] ?? "Re-slicing…")
                          : reslicing
                            ? "Re-slicing…"
                            : "Re-slice audio"}
                      </Button>

                    </div>

                    {/* Real-time status indicator for Re-slice */}
                    {status && (
                      <div className={`rounded-md border p-2 text-xs ${
                        status.phase === "failed" ? "border-destructive/50 bg-destructive/10" :
                        status.phase === "done" ? "border-primary/40 bg-primary/5" :
                        "border-amber-500/40 bg-amber-500/5"
                      }`}>
                        <div className="flex items-center gap-2">
                          {isActivePhase ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           status.phase === "failed" ? <AlertCircle className="h-3 w-3 text-destructive" /> :
                           <Check className="h-3 w-3 text-primary" />}
                          <span className="font-medium">{phaseLabel[status.phase] ?? status.phase}</span>
                          {status.at && (
                            <span className="text-muted-foreground ml-auto">
                              {new Date(status.at).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <Progress value={phasePct[status.phase] ?? 0} className="h-1 mt-2" />
                        {status.phase === "done" && (
                          <div className="mt-1 text-muted-foreground">
                            {status.sliceCount ?? 0} slices • {status.errorCount ?? 0} violations
                            {status.jobValid === false && " • job invalid"}
                          </div>
                        )}
                        {status.phase === "failed" && status.error && (
                          <div className="mt-1 text-destructive font-mono">{status.error}</div>
                        )}
                      </div>
                    )}

                    {ac?.sceneAudioSlicesGeneratedAt && (
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(ac.sceneAudioSlicesGeneratedAt).toLocaleString()}
                        {ac.cloudinaryAudio?.publicId && (
                          <> • source <span className="font-mono">{ac.cloudinaryAudio.publicId}</span> ({Number(ac.cloudinaryAudio.durationSec ?? 0).toFixed(1)}s)</>
                        )}
                      </p>
                    )}

                    {/* Job-level validation summary (server-side) */}
                    {jobVal && (
                      <div className={`text-xs rounded-md border p-2 ${jobVal.valid ? "border-primary/30 bg-primary/5" : "border-destructive/50 bg-destructive/10"}`}>
                        <div className="flex items-center gap-2">
                          {jobVal.valid
                            ? <Check className="h-3 w-3 text-primary" />
                            : <AlertCircle className="h-3 w-3 text-destructive" />}
                          <span className="font-medium">
                            Job validation: {jobVal.valid ? "passes" : "fails"} Seedance limits
                          </span>
                          <span className="text-muted-foreground ml-auto font-mono">
                            {jobVal.totalFiles}/{jobVal.limits.maxFiles} files • {jobVal.totalDurationSec.toFixed(2)}/{jobVal.limits.maxTotalSec}s total
                          </span>
                        </div>
                        {!jobVal.valid && (
                          <ul className="mt-1 pl-4 list-disc">
                            {jobVal.errors.filter(e => e.scope === "job").map((e, i) => (
                              <li key={`j${i}`} className="text-destructive">{e.reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {errors.length > 0 && (
                      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
                        <div className="text-sm font-medium text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {errors.length} per-scene {errors.length === 1 ? "violation" : "violations"} (max 15s each)
                        </div>
                        <ul className="text-xs space-y-1 pl-6 list-disc">
                          {errors.map((e, i) => (
                            <li key={i} className="font-mono">
                              Scene {Number(e.index) + 1} • {e.durationSec.toFixed(2)}s — {e.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {slices.length > 0 ? (
                      <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                        {slices.map((sl) => {
                          const sErrs = errorBySceneId.get(sl.sceneId) ?? [];
                          const bad = sErrs.length > 0;
                          const startStr = `${Number(sl.startSec).toFixed(2)}`;
                          const durStr = `${Number(sl.durationSec).toFixed(2)}`;
                          return (
                            <div key={sl.sceneId} className={`p-2 text-xs ${bad ? "bg-destructive/5" : ""}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  Scene {Number(sl.index ?? 0) + 1}
                                  <span className="text-muted-foreground ml-2 font-mono">
                                    start {startStr}s • dur {durStr}s
                                  </span>
                                </span>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px]"
                                    title="Copy start (seconds)"
                                    onClick={() => copySliceField(startStr, `Scene ${Number(sl.index ?? 0) + 1} start`, `start-${sl.sceneId}`)}
                                  >
                                    {copiedSliceKey === `start-${sl.sceneId}` ? <Check className="h-3 w-3 mr-1 text-primary" /> : <Clock className="h-3 w-3 mr-1" />}
                                    start
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px]"
                                    title="Copy duration (seconds)"
                                    onClick={() => copySliceField(durStr, `Scene ${Number(sl.index ?? 0) + 1} duration`, `dur-${sl.sceneId}`)}
                                  >
                                    {copiedSliceKey === `dur-${sl.sceneId}` ? <Check className="h-3 w-3 mr-1 text-primary" /> : <Clock className="h-3 w-3 mr-1" />}
                                    dur
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    title="Copy slice URL"
                                    onClick={() => copySliceField(sl.url, `Scene ${Number(sl.index ?? 0) + 1} URL`, `url-${sl.sceneId}`)}
                                  >
                                    {copiedSliceKey === `url-${sl.sceneId}` ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px]"
                                    title="Copy {startSec, durationSec, url} as JSON"
                                    onClick={() => copyMeta(sl)}
                                  >
                                    {copiedSliceKey === `json-${sl.sceneId}` ? <Check className="h-3 w-3 mr-1 text-primary" /> : null}
                                    {copiedSliceKey === `json-${sl.sceneId}` ? "Copied!" : "JSON"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    title="Open slice"
                                    asChild
                                  >
                                    <a href={sl.url} target="_blank" rel="noreferrer">
                                      <Play className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </div>
                              </div>
                              <a
                                href={sl.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block mt-1 font-mono text-[10px] text-muted-foreground hover:text-foreground truncate"
                                title={sl.url}
                              >
                                {sl.url}
                              </a>
                              {(() => {
                                const keys = [
                                  `start-${sl.sceneId}`,
                                  `dur-${sl.sceneId}`,
                                  `url-${sl.sceneId}`,
                                  `json-${sl.sceneId}`,
                                ].filter((k) => copyFallbacks[k]);
                                if (keys.length === 0) return null;
                                return (
                                  <div className="mt-2 space-y-1.5 rounded border border-destructive/30 bg-destructive/5 p-2">
                                    {keys.map((k) => {
                                      const fb = copyFallbacks[k];
                                      const isMulti = fb.value.length > 80 || fb.value.includes("\n");
                                      return (
                                        <div key={k} className="space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-medium text-destructive">
                                              Copy failed — select and copy {fb.label.split("•").pop()?.trim() || fb.label}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => dismissCopyFallback(k)}
                                              className="text-[10px] text-muted-foreground hover:text-foreground underline"
                                            >
                                              dismiss
                                            </button>
                                          </div>
                                          {isMulti ? (
                                            <textarea
                                              readOnly
                                              value={fb.value}
                                              onFocus={(e) => e.currentTarget.select()}
                                              rows={Math.min(6, fb.value.split("\n").length + 1)}
                                              className="w-full font-mono text-[10px] rounded border bg-background px-2 py-1 resize-y"
                                            />
                                          ) : (
                                            <input
                                              type="text"
                                              readOnly
                                              value={fb.value}
                                              onFocus={(e) => e.currentTarget.select()}
                                              className="w-full font-mono text-[10px] rounded border bg-background px-2 py-1"
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              {bad && (
                                <ul className="mt-1 pl-3 text-[11px] text-destructive list-disc">
                                  {sErrs.map((e, i) => <li key={i}>{e.reason}</li>)}
                                </ul>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No slices yet. Click <span className="font-medium">Re-slice audio</span> to generate them from this job's scene timings.
                      </p>
                    )}
                  </div>
                );
              })()
            )}



            {/* Actions */}
            <div className="p-4 border-t flex gap-2 justify-end">
              {mediaViewer.url && (
                <Button
                  onClick={() => handleDownload(
                    mediaViewer.url!, 
                    `ugc-ad-${mediaViewer.ad?.id?.slice(0, 8)}.${mediaViewer.type === 'video' ? 'mp4' : 'jpg'}`
                  )}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              {mediaViewer.ad && (
                <Button
                  onClick={() => confirmSingleDelete(mediaViewer.ad!.id)}
                  variant="destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Music Video Player Modal */}
      <LyricVideoPlayerModal
        isOpen={lyricPlayer.isOpen}
        ad={lyricPlayer.ad}
        onClose={() => setLyricPlayer({ isOpen: false, ad: null })}
        onDownload={handleDownload}
        onDelete={confirmSingleDelete}
        onShare={shareVideoUrl}
        onRegenerate={(ad) => handleRegenerate(ad)}
        isRegenerating={lyricPlayer.ad ? regeneratingIds.has(lyricPlayer.ad.id) : false}
        onEditStoryboard={(ad) => setEditingStoryboardAd(ad)}
      />
    </div>
  );

  function renderAdCard(ad: GeneratedAd) {
    const isProcessing = ad.status === 'processing';
    const isFailed = ad.status === 'failed' || ad.status === 'video_failed';
    const isRetrying = retryingIds.has(ad.id);
    const isSelected = selectedIds.has(ad.id);
    const hasVideo = !!ad.generated_video_url;
    const displayUrl = ad.generated_video_url || ad.generated_image_url;
    const mediaType = hasVideo ? 'video' : 'image';
    const isCompleted = ad.status === 'completed';
    const isOwnAd = user?.id === ad.user_id;
    const isLyric = isLyricVideo(ad);

    // Lyric videos in progress show song title + Shotstack progress
    const lyricProgress = isLyric ? (ad.video_progress ?? 5) : 0;
    const lyricStatusLabel: Record<string, string> = {
      queued: "Queued…", processing: "Rendering…", fetching: "Preparing…",
      rendering: "Rendering…", saving: "Saving…",
    };
    const lyricStatus = isLyric
      ? (lyricStatusLabel[ad.video_status ?? "queued"] ?? "Processing…")
      : "";

    const handleThumbnailClick = () => {
      if (!displayUrl) return;
      if (isLyric && hasVideo) {
        setLyricPlayer({ isOpen: true, ad });
      } else {
        openMediaViewer(mediaType, displayUrl, getStyleLabel(ad.style_template), ad);
      }
    };

    return (
      <Card key={ad.id} className={`overflow-hidden group relative ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        {/* Selection checkbox for non-processing ads */}
        {!isProcessing && (
          <div 
            className="absolute top-2 right-2 z-10"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(ad.id);
            }}
          >
            <div className={`h-6 w-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
              isSelected 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'bg-background/80 border-muted-foreground/50 hover:border-primary'
            }`}>
              {isSelected && <Check className="h-4 w-4" />}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {isProcessing ? (
            <div className="aspect-square bg-muted flex flex-col items-center justify-center p-6">
              {isLyric ? (
                <Music2 className="h-10 w-10 text-primary mb-3 animate-pulse" />
              ) : (
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              )}
              <p className="text-sm font-medium text-center">
                {isLyric
                  ? `${lyricStatus} ${lyricProgress}%`
                  : "Generating your UGC ad..."}
              </p>
              {isLyric && ad.ad_copy?.title && (
                <p className="text-xs text-muted-foreground mt-1 text-center truncate max-w-full px-2">
                  "{ad.ad_copy.title}"
                  {ad.ad_copy.artist ? ` — ${ad.ad_copy.artist}` : ""}
                </p>
              )}
              <Progress value={isLyric ? lyricProgress : 66} className="h-2 w-3/4 mt-4" />
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(ad.created_at).toLocaleString()}
              </p>
            </div>
          ) : isFailed ? (
            <div className="aspect-square bg-destructive/10 flex flex-col items-center justify-center p-6">
              <AlertCircle className="h-10 w-10 text-destructive mb-4" />
              <p className="text-sm font-medium text-destructive text-center">
                {isLyric ? "Render Failed" : "Generation Failed"}
              </p>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {new Date(ad.created_at).toLocaleString()}
              </p>
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                {!isLyric && (
                  <Button
                    onClick={() => handleRetry(ad)}
                    variant="outline"
                    size="sm"
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Retry
                  </Button>
                )}
                {isLyric && (
                  <Button
                    onClick={() => setEditingStoryboardAd(ad)}
                    variant="outline"
                    size="sm"
                  >
                    <Film className="h-4 w-4 mr-2" />
                    Open Storyboard
                  </Button>
                )}
                <Button
                  onClick={() => confirmSingleDelete(ad.id)}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : displayUrl ? (
            <div 
              className="relative aspect-square cursor-pointer"
              onClick={handleThumbnailClick}
            >
              {hasVideo ? (
                <video 
                  src={ad.generated_video_url!}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => { void e.currentTarget.play().catch(() => {}); }}
                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                />
              ) : (
                <img 
                  src={ad.generated_image_url!}
                  alt={`UGC Ad - ${getStyleLabel(ad.style_template)}`}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Hover Overlay — waveform bars for AI music videos, play icon for others */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {isLyric ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* Animated music bars */}
                    <div className="flex items-end gap-[3px] h-10">
                      {[0.4, 0.75, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.7, 0.95, 0.55, 0.85].map((h, i) => (
                        <div
                          key={i}
                          className="w-[3px] rounded-full bg-white"
                          style={{
                            height: `${h * 100}%`,
                            animation: `musicBar 0.8s ease-in-out ${(i * 0.07).toFixed(2)}s infinite alternate`,
                            opacity: 0.9,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-white text-xs font-semibold tracking-wide bg-black/40 rounded-full px-3 py-1">
                      Watch Video
                    </span>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                    <Play className="h-7 w-7 text-white fill-white ml-0.5" />
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[calc(100%-3rem)]">
                {isLyric ? (
                  <Badge className="text-xs bg-primary/90 text-primary-foreground gap-1">
                    <Music2 className="h-3 w-3" />
                    AI Music Video
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {getStyleLabel(ad.style_template)}
                  </Badge>
                )}
                {hasVideo && !isLyric && (
                  <Badge variant="secondary" className="text-xs">
                    <Video className="h-3 w-3 mr-1" />
                    Video
                  </Badge>
                )}
                {isAdmin && (
                  <Badge 
                    variant={isOwnAd ? "default" : "outline"} 
                    className={`text-xs ${isOwnAd ? 'bg-primary' : 'bg-background/90 border-amber-500 text-amber-600'}`}
                  >
                    {isOwnAd ? (
                      <>
                        <User className="h-3 w-3 mr-1" />
                        Mine
                      </>
                    ) : (
                      <>
                        <Users className="h-3 w-3 mr-1" />
                        Other
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {/* Quick Actions */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {isLyric && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    title="Open storyboard"
                    onClick={(e) => { e.stopPropagation(); setEditingStoryboardAd(ad); }}
                  >
                    <Film className="h-4 w-4" />
                  </Button>
                )}
                {isLyric && isCompleted && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    title="Regenerate"
                    onClick={(e) => { e.stopPropagation(); handleRegenerate(ad); }}
                    disabled={regeneratingIds.has(ad.id)}
                  >
                    {regeneratingIds.has(ad.id)
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RotateCcw className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLyric && hasVideo) {
                      const title = ad.ad_copy?.title || "Music Video";
                      const artist = ad.ad_copy?.artist || "AI Creator";
                      handleDownload(displayUrl, `${title} - ${artist}.mp4`);
                    } else {
                      handleDownload(displayUrl, `ugc-ad-${ad.id.slice(0, 8)}.${hasVideo ? 'mp4' : 'jpg'}`);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmSingleDelete(ad.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="aspect-square bg-muted flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No preview available</p>
            </div>
          )}

          {/* Card Footer */}
          <div className="p-3 border-t">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {new Date(ad.created_at).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-1">
                {/* Duration badge for completed AI music videos */}
                {isLyric && isCompleted && (() => {
                  const dur = estimateDuration(ad.ad_copy?.lyricsPreview);
                  return dur ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {dur}
                    </Badge>
                  ) : null;
                })()}
                {ad.aspect_ratio && (
                  <Badge variant="outline" className="text-xs">
                    {ad.aspect_ratio}
                  </Badge>
                )}
              </div>
            </div>
            {/* Lyric video metadata + regenerate */}
            {isLyric && ad.ad_copy?.title && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium truncate flex-1">
                  {ad.ad_copy.title}
                  {ad.ad_copy.artist && (
                    <span className="text-muted-foreground font-normal"> — {ad.ad_copy.artist}</span>
                  )}
                </p>
                {isCompleted && isOwnAd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    title="Regenerate with same settings"
                    onClick={(e) => { e.stopPropagation(); handleRegenerate(ad); }}
                    disabled={regeneratingIds.has(ad.id)}
                  >
                    {regeneratingIds.has(ad.id)
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RotateCcw className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            )}
            {/* Show email for admins viewing other users' ads */}
            {isAdmin && !isOwnAd && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate" title={ad.email}>{ad.email}</span>
              </div>
            )}
            {ad.status === 'completed' && isOwnAd && isLyric && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span>Ready · email sent</span>
              </div>
            )}
            {ad.status === 'completed' && isOwnAd && !isLyric && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span>Sent to your email</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
};

// ─── AI Music Video Player Modal ────────────────────────────────────────────────
interface LyricVideoPlayerModalProps {
  isOpen: boolean;
  ad: GeneratedAd | null;
  onClose: () => void;
  onDownload: (url: string, filename: string) => void;
  onDelete: (id: string) => void;
  onShare: (url: string) => void;
  onRegenerate: (ad: GeneratedAd) => void;
  isRegenerating: boolean;
  onEditStoryboard?: (ad: any) => void;
}

function LyricVideoPlayerModal({ isOpen, ad, onClose, onDownload, onDelete, onShare, onRegenerate, isRegenerating, onEditStoryboard }: LyricVideoPlayerModalProps) {
  const [lyricsCopied, setLyricsCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  if (!ad) return null;

  const title    = ad.ad_copy?.title  || ad.style_template;
  const artist   = ad.ad_copy?.artist || "";
  const videoUrl = ad.generated_video_url!;
  const isPortrait = ad.aspect_ratio === "9:16";
  const lyricsPreview = ad.ad_copy?.lyricsPreview || "";

  /** Build timeline: each lyric line gets an estimated start timestamp (~3.2s per line) */
  const lyricLines = lyricsPreview
    .split("\n")
    .filter(l => l.trim().length > 0);

  const SECS_PER_LINE = 3.2;
  const timelineItems = lyricLines.map((line, i) => ({
    line,
    startSec: i * SECS_PER_LINE,
    endSec: (i + 1) * SECS_PER_LINE,
  }));

  /** Active line index based on video currentTime */
  const activeIndex = (() => {
    let idx = -1;
    for (let i = 0; i < timelineItems.length; i++) {
      if (currentTime >= timelineItems[i].startSec) idx = i;
    }
    return idx;
  })();

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  /** Seek video to a line's estimated start time */
  const seekToLine = (startSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startSec;
      videoRef.current.play().catch(() => {/* ignore autoplay block */});
    }
  };

  const formatTs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopyLyrics = async () => {
    try {
      await navigator.clipboard.writeText(lyricsPreview);
      setLyricsCopied(true);
      setTimeout(() => setLyricsCopied(false), 2000);
    } catch {
      // silently fail
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-[hsl(var(--background))]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex flex-col md:flex-row">
          {/* Video player */}
          <div className={`bg-black flex items-center justify-center ${isPortrait ? "md:w-[45%]" : "w-full"}`}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              playsInline
              onTimeUpdate={handleTimeUpdate}
              className={`${isPortrait ? "h-[60vh] max-h-[500px]" : "w-full max-h-[50vh]"} object-contain`}
            />
          </div>

          {/* Metadata + Actions */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Music2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  AI Music Video
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight">{title}</h2>
              {artist && <p className="text-sm text-muted-foreground mt-0.5">{artist}</p>}
            </div>

            {/* Tabs: Details / Lyrics / Timeline */}
            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mb-0 justify-start rounded-none border-b border-border/50 bg-transparent h-auto pb-0 gap-0">
                <TabsTrigger
                  value="details"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-sm"
                >
                  Details
                </TabsTrigger>
                {lyricsPreview && (
                  <TabsTrigger
                    value="lyrics"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-sm"
                  >
                    Lyrics
                  </TabsTrigger>
                )}
                {timelineItems.length > 0 && (
                  <TabsTrigger
                    value="timeline"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-sm"
                  >
                    Timeline
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-y-auto p-6 pt-4 m-0 flex flex-col gap-4">
                {/* Pexels background preview */}
                {ad.ad_copy?.pexelsBackgroundThumbnail && (
                  <div className="rounded-lg overflow-hidden border border-border/60 relative">
                    <img
                      src={ad.ad_copy.pexelsBackgroundThumbnail}
                      alt="Pexels background"
                      className="w-full h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                      <span className="text-[10px] text-white/80 font-medium">Pexels Background</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Template</p>
                    <p className="font-medium capitalize">{ad.style_template}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Format</p>
                    <p className="font-medium">{ad.aspect_ratio || "9:16"}</p>
                  </div>
                  {ad.ad_copy?.fontTheme && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Font</p>
                      <p className="font-medium capitalize">{ad.ad_copy.fontTheme}</p>
                    </div>
                  )}
                  {ad.ad_copy?.colorPalette && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Palette</p>
                      <p className="font-medium capitalize">{ad.ad_copy.colorPalette}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(ad.created_at).toLocaleDateString()}
                </p>
              </TabsContent>

              {lyricsPreview && (
                <TabsContent value="lyrics" className="flex-1 overflow-y-auto p-6 pt-4 m-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Full Lyrics</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 gap-1.5 text-xs"
                      onClick={handleCopyLyrics}
                    >
                      {lyricsCopied ? (
                        <><Check className="h-3 w-3 text-primary" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy</>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-4 max-h-[28vh] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
                      {lyricsPreview}
                    </pre>
                  </div>
                </TabsContent>
              )}

              {/* ── Timeline tab ── */}
              {timelineItems.length > 0 && (
                <TabsContent value="timeline" className="flex-1 overflow-hidden p-0 m-0 flex flex-col">
                  <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Lyric Pacing · ~{SECS_PER_LINE}s per line
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTs(currentTime)}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-0.5">
                    {timelineItems.map((item, i) => {
                      const isActive = i === activeIndex;
                      const isPast = i < activeIndex;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => seekToLine(item.startSec)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150",
                            isActive
                              ? "bg-primary/15 border border-primary/30"
                              : "hover:bg-muted/60 border border-transparent",
                          )}
                        >
                          {/* Timestamp */}
                          <span className={cn(
                            "font-mono text-[10px] flex-shrink-0 w-9",
                            isActive ? "text-primary font-bold" : isPast ? "text-muted-foreground/50" : "text-muted-foreground",
                          )}>
                            {formatTs(item.startSec)}
                          </span>
                          {/* Active indicator bar */}
                          <span className={cn(
                            "w-0.5 h-4 rounded-full flex-shrink-0 transition-all",
                            isActive ? "bg-primary" : "bg-border",
                          )} />
                          {/* Lyric text */}
                          <span className={cn(
                            "text-xs flex-1 min-w-0 truncate",
                            isActive ? "text-foreground font-semibold" : isPast ? "text-muted-foreground/60" : "text-foreground/80",
                          )}>
                            {item.line}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <div className="flex gap-2 p-6 pt-2 border-t border-border/40 mt-auto">
              <Button
                className="flex-1"
                onClick={() => {
                  const songTitle = ad.ad_copy?.title || "Music Video";
                  const songArtist = ad.ad_copy?.artist || "AI Creator";
                  onDownload(videoUrl, `${songTitle} - ${songArtist}.mp4`);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download MP4
              </Button>
              {onEditStoryboard && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onEditStoryboard(ad);
                    onClose();
                  }}
                  className="gap-2"
                >
                  <Scissors className="h-4 w-4" />
                  Storyboard
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                title="Copy direct link"
                onClick={() => onShare(videoUrl)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Regenerate"
                onClick={() => { onRegenerate(ad); onClose(); }}
                disabled={isRegenerating}
              >
                {isRegenerating
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RotateCcw className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => { onDelete(ad.id); onClose(); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CopyableFieldProps {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

function CopyableField({ label, value, field, copiedField, onCopy }: CopyableFieldProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => onCopy(value, field)}
        >
          {copiedField === field ? (
            <Check className="h-3 w-3 text-primary" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <p className="text-sm">{value}</p>
    </div>
  );
}

interface RestitchControlsProps {
  ad: GeneratedAd;
  busy: boolean;
  onRestitch: (ad: GeneratedAd, overrides?: { falMaxAttempts?: number; toleranceSec?: number }) => void;
  onDownloadAudit: (ad: GeneratedAd) => void;
}

function RestitchControls({ ad, busy, onRestitch, onDownloadAudit }: RestitchControlsProps) {
  const currentTol = ad.ad_copy?.stitchValidation?.toleranceSec ?? 1.5;
  const [attempts, setAttempts] = useState<number>(2);
  const [tolerance, setTolerance] = useState<number>(Number(currentTol) || 1.5);
  const [useOverride, setUseOverride] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 pt-2 items-end">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            <Filter className="h-4 w-4 mr-2" />
            {useOverride ? `Override: ${attempts} × ±${tolerance}s` : "Override defaults"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Per-job overrides</label>
            <Checkbox checked={useOverride} onCheckedChange={(v) => setUseOverride(!!v)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">fal.ai max attempts (1–5)</label>
            <Input
              type="number" min={1} max={5} value={attempts}
              disabled={!useOverride}
              onChange={(e) => setAttempts(Math.min(5, Math.max(1, parseInt(e.target.value || "2", 10))))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Drift tolerance (seconds, 0.1–30)</label>
            <Input
              type="number" min={0.1} max={30} step={0.1} value={tolerance}
              disabled={!useOverride}
              onChange={(e) => setTolerance(Math.min(30, Math.max(0.1, parseFloat(e.target.value || "1.5"))))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave unchecked to use the project-wide env defaults.
          </p>
        </PopoverContent>
      </Popover>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRestitch(ad, useOverride ? { falMaxAttempts: attempts, toleranceSec: tolerance } : undefined)}
        disabled={busy}
      >
        {busy
          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          : <Scissors className="h-4 w-4 mr-2" />}
        Re-stitch
      </Button>
      <Button size="sm" variant="outline" onClick={() => onDownloadAudit(ad)}>
        <Download className="h-4 w-4 mr-2" />
        Download audit (JSON)
      </Button>
    </div>
  );
}

export default Library;

