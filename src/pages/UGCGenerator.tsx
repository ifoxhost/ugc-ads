import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useCreateSubmit } from "@/hooks/useCreateSubmit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  Check,
  Clock,
  Music2,
  Zap,
  AlertTriangle,
  RefreshCw,
  Eye,
  Edit2,
  Play,
  ChevronRight,
  FileText,
  Save,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Film,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import OutputGallery from "@/components/ugc/OutputGallery";
import SubscriptionPlansDialog from "@/components/SubscriptionPlansDialog";
import LyricVideoForm, { LyricVideoFormData, DEFAULT_LYRIC_FORM } from "@/components/lyric/LyricVideoForm";
import StoryboardStage from "@/components/lyric/StoryboardStage";
import RenderProgressBar from "@/components/lyric/RenderProgressBar";
import StoryboardEditor from "@/components/lyric/StoryboardEditor";

interface GeneratedAd {
  id: string;
  product_image_url: string;
  generated_image_url: string | null;
  generated_video_url: string | null;
  style_template: string;
  ad_copy: {
    title?: string;
    artist?: string;
    lyricsPreview?: string;
    fontTheme?: string;
    colorPalette?: string;
    storyboard?: any[];
  } | null;
  aspect_ratio: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  video_status?: string | null;
  video_progress?: number | null;
  video_duration?: number | null;
}

const autoAdjustClips = (
  targetClips: any[],
  targetDuration: number,
  lockedClipId?: string
): any[] => {
  if (targetClips.length === 0) return [];
  if (targetClips.length === 1) {
    return [{ ...targetClips[0], duration: targetDuration, start_time: 0, end_time: targetDuration }];
  }

  const minDuration = 0.5;
  let adjusted = [...targetClips];

  if (lockedClipId) {
    const lockedClip = adjusted.find(c => c.id === lockedClipId);
    if (lockedClip) {
      const maxLockedDuration = targetDuration - (adjusted.length - 1) * minDuration;
      const lockedDuration = Math.max(minDuration, Math.min(lockedClip.duration, maxLockedDuration));
      
      const otherClips = adjusted.filter(c => c.id !== lockedClipId);
      const otherCurrentSum = otherClips.reduce((sum, c) => sum + c.duration, 0);
      const otherTargetSum = targetDuration - lockedDuration;

      const ratio = otherTargetSum / (otherCurrentSum || 1);
      const adjustedOthers = otherClips.map((clip, idx) => {
        if (idx === otherClips.length - 1) {
          const precedingSum = otherClips
            .slice(0, -1)
            .reduce((sum, c) => sum + Math.max(minDuration, Number((c.duration * ratio).toFixed(1))), 0);
          return {
            ...clip,
            duration: Number((otherTargetSum - precedingSum).toFixed(1)),
          };
        }
        return {
          ...clip,
          duration: Math.max(minDuration, Number((clip.duration * ratio).toFixed(1))),
        };
      });

      adjusted = adjusted.map(c => {
        if (c.id === lockedClipId) {
          return { ...c, duration: Number(lockedDuration.toFixed(1)) };
        }
        const adj = adjustedOthers.find(o => o.id === c.id);
        return adj ? adj : c;
      });
    }
  } else {
    const totalCurrentSum = adjusted.reduce((sum, c) => sum + c.duration, 0);
    const ratio = targetDuration / (totalCurrentSum || 1);

    adjusted = adjusted.map((clip, idx) => {
      if (idx === adjusted.length - 1) {
        const precedingSum = adjusted
          .slice(0, -1)
          .reduce((sum, c) => sum + Math.max(minDuration, Number((c.duration * ratio).toFixed(1))), 0);
        return {
          ...clip,
          duration: Number((targetDuration - precedingSum).toFixed(1)),
        };
      }
      return {
        ...clip,
        duration: Math.max(minDuration, Number((clip.duration * ratio).toFixed(1))),
      };
    });
  }

  // Recalculate timeline starts/ends
  let accumTime = 0;
  return adjusted.map((c) => {
    const start = accumTime;
    accumTime = Number((accumTime + c.duration).toFixed(1));
    return {
      ...c,
      start_time: start,
      end_time: accumTime
    };
  });
};

const UGCGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const { registerSubmit, unregisterSubmit } = useCreateSubmit();

  const [formData, setFormData] = useState<LyricVideoFormData>(DEFAULT_LYRIC_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"form" | "progress">("form");
  const [activeAdId, setActiveAdId] = useState<string | null>(null);
  const [editingStoryboardAd, setEditingStoryboardAd] = useState<any | null>(null);

  // Active Project & Pipeline Tracking
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [activeScript, setActiveScript] = useState<any | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Script Modal state
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptConcept, setScriptConcept] = useState("");
  const [scriptNarrative, setScriptNarrative] = useState("");
  const [scriptEnrichmentView, setScriptEnrichmentView] = useState(false);

  // Stepper Substep Pipeline states
  const [pipelineSubStep, setPipelineSubStep] = useState<"script" | "images" | "videos">("script");
  const [activeScenes, setActiveScenes] = useState<any[]>([]);
  const [activeCompiling, setActiveCompiling] = useState(false);
  const [activeCompileProgress, setActiveCompileProgress] = useState(0);

  const prevProgressRef = useRef(0);
  const [recentlyCompleted, setRecentlyCompleted] = useState({ lyrics: false, subscription: false });

  const hasLyrics = formData.lyrics.trim().length > 2 || formData.songTitle.trim().length > 0;
  const hasAudio = formData.inputMode === "suno" || !!formData.audioFileUrl;
  const stepsList = formData.inputMode === "upload" 
    ? [hasLyrics, hasAudio, hasActiveSubscription]
    : [hasLyrics, hasActiveSubscription];
  const completedSteps = stepsList.filter(Boolean).length;
  const progressPercentage = Math.round((completedSteps / stepsList.length) * 100);

  const handleMobileSubmit = useCallback(() => {
    document.getElementById("generate-lyric-button")?.click();
  }, []);

  useEffect(() => {
    registerSubmit(handleMobileSubmit);
    return () => unregisterSubmit();
  }, [registerSubmit, unregisterSubmit, handleMobileSubmit]);

  useEffect(() => {
    checkUser();
    fetchGeneratedAds();
    fetchProjects();

    const channel = supabase
      .channel("generated-ads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "generated_ads" }, () => {
        fetchGeneratedAds();
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll for pipeline progress if project is rendering
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const isProcessing = activeProject && activeProject.status === "processing";
    
    if (isProcessing) {
      timer = setInterval(() => {
        fetchProjects();
        fetchGeneratedAds();
        if (activeProject?.id) {
          fetchScript(activeProject.id);
          fetchActiveScenes(activeProject.id);
        }
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) {
      fetchScript(activeProject.id);
      fetchActiveScenes(activeProject.id);
    } else {
      setActiveScript(null);
      setActiveScenes([]);
    }
  }, [activeProject]);

  useEffect(() => {
    if (progressPercentage === 100 && prevProgressRef.current < 100) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#8b5cf6", "#6d28d9", "#a78bfa", "#c4b5fd"] });
    }
    prevProgressRef.current = progressPercentage;
  }, [progressPercentage]);

  useEffect(() => {
    if (hasLyrics) {
      setRecentlyCompleted((prev) => ({ ...prev, lyrics: true }));
      const t = setTimeout(() => setRecentlyCompleted((prev) => ({ ...prev, lyrics: false })), 1000);
      return () => clearTimeout(t);
    }
  }, [hasLyrics]);

  useEffect(() => {
    if (hasActiveSubscription) {
      setRecentlyCompleted((prev) => ({ ...prev, subscription: true }));
      const t = setTimeout(() => setRecentlyCompleted((prev) => ({ ...prev, subscription: false })), 1000);
      return () => clearTimeout(t);
    }
  }, [hasActiveSubscription]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) navigate("/login");
  };

  const fetchProjects = async () => {
    try {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        setProjects(data);
        const active = data.find((p: any) => p.status === "processing");
        if (active) {
          setActiveProject(active);
        } else {
          setActiveProject(null);
        }
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

  const fetchScript = async (projId: string) => {
    const { data } = await supabase
      .from("scripts")
      .select("*")
      .eq("project_id", projId)
      .maybeSingle();
    if (data) {
      setActiveScript(data);
      setScriptConcept(data.story_concept || "");
      setScriptNarrative(data.visual_narrative || "");
    }
  };

  const fetchActiveScenes = async (projId: string) => {
    const { data, error } = await supabase
      .from("storyboard_scenes")
      .select("*")
      .eq("project_id", projId)
      .order("scene_number", { ascending: true });
    if (!error && data) {
      setActiveScenes(data.map((d: any) => ({
        ...d,
        videoUrl: d.videoUrl || d.video_url || null,
        status: d.videoUrl ? "completed" : d.status || "idle",
      })));
    }
  };

  const fetchGeneratedAds = async () => {
    try {
      const { data, error } = await supabase
        .from("generated_ads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGeneratedAds((data || []).map((ad) => ({
        ...ad,
        ad_copy: ad.ad_copy as GeneratedAd["ad_copy"],
      })));
    } catch (error) {
      console.error("Error fetching ads:", error);
    } finally {
      setLoadingAds(false);
    }
  };

  const updateActiveScene = async (sceneId: string, partial: Partial<any>) => {
    setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...partial } : s));
    
    const dbFields: any = {};
    if (partial.prompt !== undefined) dbFields.prompt = partial.prompt;
    if (partial.duration !== undefined) dbFields.duration = partial.duration;
    if (partial.start_reference_image !== undefined) dbFields.start_reference_image = partial.start_reference_image;
    if (partial.videoUrl !== undefined) {
      dbFields.videoUrl = partial.videoUrl;
      dbFields.video_url = partial.videoUrl;
    }
    
    await supabase.from("storyboard_scenes").update(dbFields).eq("id", sceneId);
  };

  const handleRegenerateActiveSceneImage = async (sceneId: string) => {
    const scene = activeScenes.find(s => s.id === sceneId);
    if (!scene) return;

    setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "processing", progress: 20 } : s));
    
    try {
      console.log(`[Pexels Regen] Searching reference image for: "${scene.prompt}"`);
      const res = await fetch("http://localhost:3000/api/pexels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: scene.prompt || "cinematic background", perPage: 5 })
      });
      const pexelsData = await res.json();
      const results = pexelsData?.results || [];
      
      if (results.length > 0) {
        const randomIndex = Math.floor(Math.random() * results.length);
        const newImg = results[randomIndex].url;
        console.log(`[Pexels Regen] Found reference image: ${newImg}`);
        
        setActiveScenes(prev => prev.map(s => s.id === sceneId ? {
          ...s, status: "idle", progress: 100, start_reference_image: newImg
        } : s));
        await supabase.from("storyboard_scenes").update({ start_reference_image: newImg }).eq("id", sceneId);
        toast({ title: "Reference Image Updated", description: "New Pexels frame selected for scene." });
      } else {
        throw new Error("No images found on Pexels");
      }
    } catch (err) {
      console.error("[Pexels Regen] Error:", err);
      toast({
        title: "Regeneration failed",
        description: err instanceof Error ? err.message : "Failed to fetch reference image.",
        variant: "destructive"
      });
      setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "idle" } : s));
    }
  };

  const handleRegenerateStoryboardAIImage = async (sceneId: string) => {
    const scene = activeScenes.find(s => s.id === sceneId);
    if (!scene) return;

    setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "processing", progress: 20 } : s));
    
    try {
      const cinematicPrompt = `Cinematic storyboard frame, ${activeProject?.visual_theme || 'dramatic'} style. ${scene.prompt}. ${activeProject?.camera_instructions || 'Wide establishing shot'}. Professional film photography, rich depth of field.`;
      console.log(`[Kie.ai Regen] Submitting nano-banana-pro: "${cinematicPrompt.substring(0, 80)}..."`);
      
      const genRes = await fetch("http://localhost:3000/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cinematicPrompt,
          aspectRatio: activeProject?.aspect_ratio === '9:16' ? '9:16' : '16:9'
        })
      });
      const genData = await genRes.json();
      const taskId = genData?.data?.taskId;
      if (!taskId) throw new Error("No task ID returned");
      
      toast({ title: "Generating AI Storyboard Image", description: "nano-banana-pro is rendering..." });
      
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`http://localhost:3000/api/image/status/${taskId}`);
          const statusData = await statusRes.json();
          const state = statusData?.data?.state;
          
          setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, progress: Math.min(90, 20 + attempts * 8) } : s));
          
          if (state === 'success') {
            clearInterval(pollInterval);
            const parsedUrl = statusData?.data?.parsedImageUrl;
            const resultJson = statusData?.data?.resultJson;
            let newImg = parsedUrl;
            if (!newImg && resultJson) {
              try { newImg = JSON.parse(resultJson)?.resultUrls?.[0]; } catch {}
            }
            if (!newImg) throw new Error("Image URL not in response");
            
            setActiveScenes(prev => prev.map(s => s.id === sceneId ? {
              ...s, status: "idle", progress: 100, start_reference_image: newImg, storyboard_image_url: newImg
            } : s));
            await supabase.from("storyboard_scenes").update({ start_reference_image: newImg }).eq("id", sceneId);
            toast({ title: "AI Storyboard Image Ready", description: "Scene rendered via nano-banana-pro." });
          } else if (state === 'fail' || attempts >= 20) {
            clearInterval(pollInterval);
            throw new Error(state === 'fail' ? 'Generation failed' : 'Timed out');
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "idle" } : s));
          toast({ title: "AI Image failed", description: String(pollErr), variant: "destructive" });
        }
      }, 3000);
    } catch (err) {
      console.error("[Kie.ai Regen] Error:", err);
      setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "idle" } : s));
      toast({ title: "Failed", description: String(err), variant: "destructive" });
    }
  };

  const handleRegenerateActiveSceneVideo = async (sceneId: string) => {
    const scene = activeScenes.find(s => s.id === sceneId);
    if (!scene) return;

    setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "processing", progress: 10 } : s));
    
    try {
      console.log(`[Video Scene Generate] Submitting prompt: "${scene.prompt}"`);
      const response = await fetch("http://localhost:3000/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.prompt,
          model: activeProject?.video_model || "kling",
          aspectRatio: activeProject?.aspect_ratio || "16:9"
        })
      });
      
      const resData = await response.json();
      if (!response.ok || resData.error) {
        throw new Error(resData.error || "Failed to submit video task");
      }
      
      const taskId = resData.data?.taskId;
      if (!taskId) throw new Error("No task ID returned from video generator");
      console.log(`[Video Scene Generate] Submitted successfully. Task ID: ${taskId}`);
      
      let progress = 10;
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:3000/api/video/status/${taskId}`);
          const statusData = await statusRes.json();
          
          if (!statusRes.ok || statusData.error) {
            throw new Error(statusData.error || "Failed to query task status");
          }
          
          // Support both old format (data.record[0].videoUrl) and new kie.ai format (data.state + data.parsedVideoUrl)
          const taskState = statusData.data?.state || statusData.data?.status;
          const parsedVideoUrl = statusData.data?.parsedVideoUrl;
          const oldVideoUrl = statusData.data?.record?.[0]?.videoUrl;
          const videoUrl = parsedVideoUrl || oldVideoUrl;
          console.log(`[Video Scene Polling] Task ${taskId} state: ${taskState}`);
          
          if ((taskState === "success") && videoUrl) {
            clearInterval(interval);
            
            setActiveScenes(prev => prev.map(s => s.id === sceneId ? {
              ...s,
              status: "completed",
              videoUrl: videoUrl,
              video_url: videoUrl
            } : s));
            
            await supabase.from("storyboard_scenes").update({
              videoUrl: videoUrl,
              video_url: videoUrl
            }).eq("id", sceneId);
            
            toast({ title: "Video Scene Rendered", description: "Scene clip is ready." });
          } else if (taskState === "failed") {
            clearInterval(interval);
            throw new Error("Video generation failed on server");
          } else {
            progress = Math.min(95, progress + 10);
            setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, progress } : s));
          }
        } catch (pollErr) {
          clearInterval(interval);
          console.error("Video polling error:", pollErr);
          setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "idle" } : s));
          toast({
            title: "Video generation failed",
            description: pollErr instanceof Error ? pollErr.message : "Failed to compile video scene.",
            variant: "destructive"
          });
        }
      }, 3000);
      
    } catch (err) {
      console.error("Video submission error:", err);
      toast({
        title: "Video generation failed",
        description: err instanceof Error ? err.message : "Failed to trigger video generation.",
        variant: "destructive"
      });
      setActiveScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: "idle" } : s));
    }
  };

  const handleAutoFitActiveScenes = () => {
    if (!activeProject) return;
    const songDuration = activeProject.video_duration || activeProject.duration || 60;
    const adjusted = autoAdjustClips(activeScenes, songDuration);
    setActiveScenes(adjusted);
    
    supabase.from("storyboard_scenes").delete().eq("project_id", activeProject.id).then(() => {
      const inserts = adjusted.map((c, i) => ({
        id: c.id,
        project_id: activeProject.id,
        scene_number: i + 1,
        start_time: c.start_time,
        end_time: c.end_time,
        duration: c.duration,
        prompt: c.prompt,
        start_reference_image: c.start_reference_image,
        end_reference_image: c.end_reference_image,
        camera_setting: c.camera_setting,
        motion_setting: c.motion_setting,
        environment_setting: c.environment_setting,
        lighting_setting: c.lighting_setting,
        character_setting: c.character_setting,
        videoUrl: c.videoUrl || null,
      }));
      supabase.from("storyboard_scenes").insert(inserts).then(() => {
        toast({ title: "Timeline Auto-Fitted", description: "Scene durations synced to timeline." });
      });
    });
  };

  const handleCompileActiveProject = async () => {
    if (!activeProject) return;
    
    const videoUrls = activeScenes.map(s => s.videoUrl || s.video_url).filter(Boolean);
    const audioUrl = activeProject.audio_url || "https://cdn1.suno.ai/7b879f5c-21d0-4922-89ea-fa5bdcd372d1.mp3";
    
    if (videoUrls.length === 0) {
      toast({
        title: "Cannot compile",
        description: "No rendered video scenes found. Please click 'Render Video' for at least one scene.",
        variant: "destructive"
      });
      return;
    }

    setActiveCompiling(true);
    setActiveCompileProgress(15);
    
    try {
      console.log(`[Video Compilation] Merging ${videoUrls.length} clips with audio: ${audioUrl}`);
      setActiveCompileProgress(40);
      
      const response = await fetch("http://localhost:3000/api/video/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls,
          audioUrl
        })
      });
      
      const resData = await response.json();
      if (!response.ok || resData.error) {
        throw new Error(resData.error || "Failed to compile/merge video clips");
      }
      
      setActiveCompileProgress(80);
      
      const finalVidUrl = resData.data?.mergedVideoUrl || videoUrls[0];
      console.log(`[Video Compilation] Master video complete: ${finalVidUrl}`);
      
      const cleanClips = activeScenes.map((c, i) => ({
        id: c.id,
        index: i + 1,
        prompt: c.prompt,
        duration: c.duration,
        referenceImageUrl: c.start_reference_image,
        referenceImageName: "Start Frame Consistency",
        videoUrl: c.videoUrl || null,
        status: c.videoUrl ? "completed" : "idle"
      }));

      const { data: ads } = await supabase.from("generated_ads").select("*").eq("id", activeProject.id).maybeSingle();
      const adCopy = {
        ...(ads?.ad_copy || {}),
        storyboard: cleanClips,
        aiModel: activeProject.video_model || "kling",
        resolution: "1080p",
        fps: 30,
      };

      const newExport = {
        id: "exp_" + Math.random().toString(36).substring(2, 15),
        project_id: activeProject.id,
        video_url: finalVidUrl,
        song_title: activeProject.title || "Song",
        artist: activeProject.artist || "Artist",
        resolution: "1080p",
        fps: 30,
        status: "completed",
        created_at: new Date().toISOString()
      };
      await supabase.from("exports").insert(newExport);

      await supabase
        .from("generated_ads")
        .update({
          generated_video_url: finalVidUrl,
          status: "completed",
          video_status: "idle",
          video_progress: 100,
          ad_copy: adCopy
        })
        .eq("id", activeProject.id);

      await supabase
        .from("projects")
        .update({
          status: "completed",
          video_url: finalVidUrl
        })
        .eq("id", activeProject.id);

      setActiveCompileProgress(100);
      setActiveCompiling(false);
      
      toast({
        title: "Compilation Complete!",
        description: `Master Video compiled: "${activeProject.title} - ${activeProject.artist}.mp4"`
      });
      
      fetchProjects();
      fetchGeneratedAds();
      setWorkspaceTab("form");
    } catch (err) {
      console.error("Compilation save error:", err);
      setActiveCompiling(false);
      toast({
        title: "Compilation failed",
        description: err instanceof Error ? err.message : "Failed to compile project.",
        variant: "destructive"
      });
    }
  };

  const handleGenerate = async () => {
    if (formData.inputMode === "upload" && !formData.audioFileUrl) {
      toast({ title: "Missing audio track", description: "Please upload an audio file first.", variant: "destructive" });
      return;
    }
    if (!hasLyrics) {
      toast({ title: "Missing details", description: "Please add song metadata or story details.", variant: "destructive" });
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    if (!hasActiveSubscription) {
      setShowSubscriptionDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-lyric-video", {
        body: {
          songTitle: formData.songTitle || "New Creation",
          artist: formData.artist || "VibeSync AI",
          albumName: formData.albumName || "",
          genre: formData.genre || "Gospel",
          videoStyle: formData.videoStyle,
          visualTheme: formData.visualTheme,
          mainCharacterDescription: formData.mainCharacterDescription,
          additionalCharacterImages: formData.additionalCharacterImages,
          lyrics: formData.lyrics,
          template: formData.template,
          aspectRatio: formData.aspectRatio,
          fontTheme: formData.fontTheme,
          colorPalette: formData.colorPalette,
          variationCount: formData.variationCount,
          pexelsBackgroundUrl: null,
          pexelsBackgroundThumbnail: null,
          audioUrl: formData.audioFileUrl ?? null,
          audioFileName: formData.audioFileName ?? null,
          bpm: formData.bpm || 128,
          referenceImageUrl: formData.referenceImageUrl ?? null,
          referenceImageName: formData.referenceImageName ?? null,
          aiModel: formData.aiModel,
          aiImageModel: formData.aiImageModel,
          resolution: formData.resolution,
          quality: formData.quality,
          fps: formData.fps,
          duration: formData.duration || 60,
          
          storyDescription: formData.storyDescription,
          characterInstructions: formData.characterInstructions,
          cameraInstructions: formData.cameraInstructions,
          environmentInstructions: formData.environmentInstructions,
          colorGradingInstructions: formData.colorGradingInstructions,
          visualEffectsInstructions: formData.visualEffectsInstructions,
        },
      });

      if (error) throw error;

      const firstAdId = (data as { adIds?: string[] } | null)?.adIds?.[0] ?? null;
      if (firstAdId) setActiveAdId(firstAdId);

      toast({
        title: "AI Production Pipeline Started!",
        description: "Script → transcription → storyboard frames are generating now.",
      });

      setFormData(DEFAULT_LYRIC_FORM);
      setPipelineSubStep("script"); // Reset stepper to script
      setWorkspaceTab("progress");
      fetchProjects();
      fetchGeneratedAds();
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAd = async (id: string) => {
    try {
      await supabase.from("generated_ads").delete().eq("id", id);
      await supabase.from("projects").delete().eq("id", id);
      toast({ title: "Deleted", description: "Project deleted." });
      fetchGeneratedAds();
      fetchProjects();
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  const handleSaveScript = async () => {
    if (!activeProject || !activeScript) return;
    try {
      const { error } = await supabase.from("scripts").update({
        story_concept: scriptConcept,
        visual_narrative: scriptNarrative
      }).eq("project_id", activeProject.id);
      
      if (error) throw error;
      toast({ title: "Script Updated", description: "Your script changes were autosaved." });
      setIsEditingScript(false);
      fetchScript(activeProject.id);
    } catch (err) {
      console.error(err);
      toast({ title: "Update Failed", description: "Could not save script modifications.", variant: "destructive" });
    }
  };

  const handleRegenerateScript = async () => {
    if (!activeProject) return;
    toast({ title: "Regenerating Script", description: "Rewriting narrative storyboard frames..." });
    setShowScriptDialog(false);

    const projs = JSON.parse(localStorage.getItem("db_projects") || "[]");
    const idx = projs.findIndex((p: any) => p.id === activeProject.id);
    if (idx !== -1) {
      projs[idx].current_stage = "script_generation";
      projs[idx].stage_progress = 10;
      projs[idx].stage_logs.push("[REGEN] Requesting alternative story layout from model...");
      localStorage.setItem("db_projects", JSON.stringify(projs));
      fetchProjects();

      let progress = 10;
      const interval = setInterval(() => {
        const pList = JSON.parse(localStorage.getItem("db_projects") || "[]");
        const curIdx = pList.findIndex((p: any) => p.id === activeProject.id);
        if (curIdx !== -1) {
          progress += 30;
          if (progress >= 100) {
            clearInterval(interval);
            pList[curIdx].current_stage = "script_enrichment";
            pList[curIdx].stage_progress = 100;
            pList[curIdx].stage_logs.push("[REGEN] Alternative script successfully drafted and cached.");
            
            const scripts = JSON.parse(localStorage.getItem("db_scripts") || "[]");
            const sIdx = scripts.findIndex((s: any) => s.project_id === activeProject.id);
            if (sIdx !== -1) {
              scripts[sIdx].story_concept = "Concept (V2): Journey into the neon sunrise";
              scripts[sIdx].visual_narrative = "The main character races past high-contrast holographic billboards in search of peace, with blue rain dissolving to gold beams.";
              localStorage.setItem("db_scripts", JSON.stringify(scripts));
            }
          } else {
            pList[curIdx].stage_progress = progress;
          }
          localStorage.setItem("db_projects", JSON.stringify(pList));
          fetchProjects();
        } else {
          clearInterval(interval);
        }
      }, 1000);
    }
  };

  const getStageDetail = (stageName: string, project: any) => {
    const currentStage = project?.current_stage || "";
    const isActive = currentStage === stageName;
    const isCompleted = isStageCompleted(stageName, currentStage);

    if (isActive) {
      return {
        label: "Processing...",
        percentage: project?.stage_progress || 15,
        status: "processing",
        color: "text-primary border-primary bg-primary/5"
      };
    }
    if (isCompleted) {
      return {
        label: "Completed",
        percentage: 100,
        status: "completed",
        color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
      };
    }
    return {
      label: "Queued",
      percentage: 0,
      status: "queued",
      color: "text-muted-foreground border-border bg-transparent"
    };
  };

  const isStageCompleted = (stage: string, currentStage: string): boolean => {
    const order = ["audio_analysis", "lyric_extraction", "script_generation", "script_enrichment", "storyboard_generation"];
    return order.indexOf(stage) < order.indexOf(currentStage || "");
  };

  const isFailedAd = (ad: any) =>
    ad.status === "video_failed" ||
    ad.status === "failed" ||
    ad.video_status === "failed";

  const inProgressAds = generatedAds.filter((ad) =>
    !isFailedAd(ad) && (ad.status === "processing" || ad.video_status === "queued" || ad.video_status === "processing")
  );
  const activeRenders = generatedAds.filter((ad) =>
    !isFailedAd(ad) && (
      ad.status === "processing" ||
      ad.video_status === "queued" ||
      ad.video_status === "processing" ||
      ad.video_status === "fetching" ||
      ad.video_status === "rendering" ||
      ad.video_status === "saving"
    )
  );
  const completedAds = generatedAds.filter((ad) => !inProgressAds.includes(ad) && !isFailedAd(ad));

  if (editingStoryboardAd) {
    return (
      <StoryboardEditor
        ad={editingStoryboardAd}
        onClose={() => setEditingStoryboardAd(null)}
        onSave={(updatedAd) => {
          setGeneratedAds((prev) =>
            prev.map((ad) => (ad.id === updatedAd.id ? updatedAd : ad))
          );
          setEditingStoryboardAd(updatedAd);
          fetchGeneratedAds();
          fetchProjects();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Music2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">Music Video Creator Studio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-tight font-bold mb-3">
            Create Your Music Video
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Build a professional AI movie production pipeline. Synchronize storyboard clips, configure frames, and export chronologically.
          </p>
        </div>

        {/* Main Workspace Tabs */}
        <Tabs value={workspaceTab} onValueChange={(v) => setWorkspaceTab(v as any)} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="h-10 p-1 bg-muted/20 border border-border/40 rounded-xl">
              <TabsTrigger value="form" className="gap-2 px-5 text-sm rounded-lg">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                1. Setup Video Project
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2 px-5 text-sm rounded-lg">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                2. Live Production Pipeline
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab 1: Customize Video ── */}
          <TabsContent value="form" className="space-y-8 mt-0 animate-fade-in max-w-4xl mx-auto">
            {/* Progress Indicator */}
            <div className="max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {progressPercentage === 100 ? "Ready to generate!" : `${completedSteps}/${stepsList.length} steps completed`}
                </span>
                <span className={cn("text-sm font-semibold", progressPercentage === 100 ? "text-primary" : "text-muted-foreground")}>
                  {progressPercentage}%
                </span>
              </div>
              <Progress
                value={progressPercentage}
                className={cn("h-2", progressPercentage === 100 && "[&>div]:bg-primary")}
              />
              <div className="flex justify-between mt-2">
                <div className={cn(
                  "flex items-center gap-1.5 text-xs transition-all duration-300",
                  hasLyrics ? "text-primary" : "text-muted-foreground",
                  recentlyCompleted.lyrics && "scale-110"
                )}>
                  <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all duration-300",
                    hasLyrics ? "bg-primary/20" : "bg-muted",
                    recentlyCompleted.lyrics && "animate-[pulse_0.5s_ease-in-out_2] ring-2 ring-primary/50"
                  )}>
                    {hasLyrics ? <Check className="h-2.5 w-2.5" /> : "1"}
                  </div>
                  Script Setup
                </div>
                {formData.inputMode === "upload" && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs transition-all duration-300",
                    hasAudio ? "text-primary" : "text-muted-foreground"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all duration-300",
                      hasAudio ? "bg-primary/20" : "bg-muted"
                    )}>
                      {hasAudio ? <Check className="h-2.5 w-2.5" /> : "2"}
                    </div>
                    Audio Track
                  </div>
                )}
                <div className={cn(
                  "flex items-center gap-1.5 text-xs transition-all duration-300",
                  hasActiveSubscription ? "text-primary" : "text-muted-foreground",
                  recentlyCompleted.subscription && "scale-110"
                )}>
                  <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all duration-300",
                    hasActiveSubscription ? "bg-primary/20" : "bg-muted",
                    recentlyCompleted.subscription && "animate-[pulse_0.5s_ease-in-out_2] ring-2 ring-primary/50"
                  )}>
                    {hasActiveSubscription ? <Check className="h-2.5 w-2.5" /> : formData.inputMode === "upload" ? "3" : "2"}
                  </div>
                  Credits Available
                </div>
              </div>
            </div>

            {/* Customizer Panel */}
            <div className="bg-card/30 border border-border p-6 rounded-2xl space-y-6">
              <LyricVideoForm formData={formData} onChange={setFormData} disabled={isSubmitting} />

              {/* Generate Button */}
              {!hasLyrics || (formData.inputMode === "upload" && !formData.audioFileUrl) || subscriptionLoading ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <Button disabled className="w-full h-12 text-base rounded-xl">
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate Music Video
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs p-4">
                    <p className="font-medium text-sm">
                      {formData.inputMode === "upload" && !formData.audioFileUrl
                        ? "Upload an audio file to get started"
                        : "Add character specifications or story prompt to start"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  id="generate-lyric-button"
                  onClick={handleGenerate}
                  className={cn(
                    "w-full h-12 text-base rounded-xl transition-all",
                    progressPercentage === 100 && "animate-[pulse_2s_ease-in-out_infinite] shadow-lg shadow-primary/25"
                  )}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Queuing Pipeline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Music Video
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ── Tab 2: Live Processing & Pipeline ── */}
          <TabsContent value="progress" className="space-y-8 mt-0 animate-fade-in max-w-5xl mx-auto">
            {activeAdId && (
              <StoryboardStage adId={activeAdId} onClose={() => setActiveAdId(null)} />
            )}
            {activeProject && activeProject.status === "processing" ? (
              <div className="space-y-6">
                {/* Master Timeline Banner */}
                <div className="p-5 border border-border/80 bg-card/45 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        Processing: "{activeProject?.title || 'Project'}"
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Artist: {activeProject?.artist || 'Unknown'} • Aspect Ratio: {activeProject?.aspect_ratio || '16:9'} • Stage: {activeProject?.current_stage?.replace("_", " ").toUpperCase() || 'PROCESSING'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Estimated Remaining: </span>
                      <span className="text-xs font-semibold text-primary">{activeProject?.stage_time_estimate || "30s"}</span>
                    </div>
                  </div>
                  
                  {/* Visual stages grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                    {[
                      { key: "audio_analysis", label: "Audio Analysis", est: "10s" },
                      { key: "lyric_extraction", label: "Lyrics Transcription", est: "10s" },
                      { key: "script_generation", label: "Script Drafting", est: "10s" },
                      { key: "script_enrichment", label: "Script Enrichment", est: "10s" },
                      { key: "storyboard_generation", label: "Storyboard Layout", est: "5s" }
                    ].map((st, i) => {
                      const details = getStageDetail(st.key, activeProject);
                      return (
                        <div key={st.key} className={cn("p-3 border rounded-xl flex flex-col justify-between h-24 transition-all", details.color)}>
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Stage {i+1}</span>
                              {details.status === "completed" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                              {details.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                            </div>
                            <span className="text-xs font-bold text-foreground block mt-1 leading-tight">{st.label}</span>
                          </div>
                          <div>
                            <Progress value={details.percentage} className="h-1 mt-2" />
                            <span className="text-[9px] text-muted-foreground mt-1 block text-right font-medium">{details.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {activeScenes.length === 0 ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column: Operations */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="p-8 border border-border bg-card/30 rounded-2xl text-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <div>
                          <h4 className="text-sm font-bold">Drafting Script and Scenes...</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Please wait. Our AI agents are analyzing your song and preparing the cinematic scene prompts.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Stage Log Console */}
                    <div className="space-y-4">
                      <div className="p-4 border border-border bg-black/80 rounded-xl font-mono text-[10px] text-emerald-400 space-y-2 h-[220px] overflow-y-auto leading-relaxed shadow-inner">
                        <div className="text-[9px] text-muted-foreground uppercase border-b border-border/20 pb-1 flex justify-between font-sans">
                          <span>Logs Console Output</span>
                          <span>Stage Live updates</span>
                        </div>
                        {activeProject?.stage_logs && activeProject.stage_logs.map((log: string, idx: number) => (
                          <div key={idx} className="truncate">{log}</div>
                        ))}
                        <div className="flex items-center gap-1.5 pt-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>listening for pipeline events...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Compile Progress Overlay */}
                    {activeCompiling && (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl space-y-2 animate-fade-in">
                        <div className="max-w-xl mx-auto space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-primary">
                            <span>Stitching storyboard scenes and syncing audio track...</span>
                            <span>{activeCompileProgress}%</span>
                          </div>
                          <Progress value={activeCompileProgress} className="h-2 [&>div]:bg-primary" />
                        </div>
                      </div>
                    )}

                    {/* Progression Stepper Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-card/30 border border-border p-4 rounded-2xl gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Pipeline Steps:</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={pipelineSubStep === "script" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPipelineSubStep("script")}
                            className={cn(
                              "text-xs font-semibold rounded-lg h-8",
                              pipelineSubStep === "script" && "bg-primary text-white"
                            )}
                          >
                            1. Script Preview
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                          <Button
                            variant={pipelineSubStep === "images" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPipelineSubStep("images")}
                            disabled={!activeScript}
                            className={cn(
                              "text-xs font-semibold rounded-lg h-8",
                              pipelineSubStep === "images" && "bg-primary text-white"
                            )}
                          >
                            2. Generated Images
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                          <Button
                            variant={pipelineSubStep === "videos" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPipelineSubStep("videos")}
                            disabled={activeScenes.length === 0}
                            className={cn(
                              "text-xs font-semibold rounded-lg h-8",
                              pipelineSubStep === "videos" && "bg-primary text-white"
                            )}
                          >
                            3. Video Storyboard
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto justify-end">
                        {pipelineSubStep === "script" && activeScript && (
                          <Button
                            size="sm"
                            onClick={() => setPipelineSubStep("images")}
                            className="bg-primary hover:bg-primary/95 text-white text-xs h-8"
                          >
                            Next Step: Generated Images <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        )}
                        {pipelineSubStep === "images" && activeScenes.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => setPipelineSubStep("videos")}
                            className="bg-primary hover:bg-primary/95 text-white text-xs h-8"
                          >
                            Next Step: Video Storyboard <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        )}
                        {pipelineSubStep === "videos" && activeScenes.length > 0 && (
                          <Button
                            size="sm"
                            onClick={handleCompileActiveProject}
                            disabled={activeCompiling || activeScenes.some(s => !s.videoUrl)}
                            className="bg-primary hover:bg-primary/95 text-white gap-1.5 text-xs h-8"
                          >
                            {activeCompiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Compile Master Video
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Timeline Sync Health Bar (Only in Images/Videos step) */}
                    {pipelineSubStep !== "script" && (
                      <div className="space-y-3">
                        <Card className={cn("border border-border", !(() => {
                          const songDuration = activeProject?.video_duration || activeProject?.duration || 60;
                          const totalClipsDuration = Number(activeScenes.reduce((sum, c) => sum + (c.duration || 0), 0).toFixed(1));
                          return Math.abs(totalClipsDuration - songDuration) < 0.2;
                        })() && "border-amber-500/50 bg-amber-500/5")}>
                          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                                {Math.abs(Number(activeScenes.reduce((sum, c) => sum + (c.duration || 0), 0).toFixed(1)) - (activeProject?.video_duration || activeProject?.duration || 60)) >= 0.2 ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                ) : (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                                Timeline Synchronizer
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Song length: <span className="font-semibold text-foreground">{activeProject?.video_duration || activeProject?.duration || 60}s</span> • Scenes total:{" "}
                                <span className={cn("font-semibold", Math.abs(Number(activeScenes.reduce((sum, c) => sum + (c.duration || 0), 0).toFixed(1)) - (activeProject?.video_duration || activeProject?.duration || 60)) >= 0.2 ? "text-amber-500 font-bold" : "text-primary")}>
                                  {Number(activeScenes.reduce((sum, c) => sum + (c.duration || 0), 0).toFixed(1))}s
                                </span>
                              </p>
                            </div>

                            {Math.abs(Number(activeScenes.reduce((sum, c) => sum + (c.duration || 0), 0).toFixed(1)) - (activeProject?.video_duration || activeProject?.duration || 60)) >= 0.2 && (
                              <div className="flex items-center gap-3">
                                <p className="text-[11px] text-amber-500 font-medium">
                                  Scene clip lengths must be fitted to match audio length.
                                </p>
                                <Button variant="outline" size="sm" onClick={handleAutoFitActiveScenes} className="h-8 border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                                  <Scissors className="h-3.5 w-3.5 mr-1.5" />
                                  Auto-Fit Clip Lengths
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Visual Timeline strip */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Chronological Sequence Timeline</Label>
                          <div className="h-10 rounded-xl bg-muted/20 border border-border/60 overflow-hidden flex">
                            {activeScenes.map((clip) => {
                              const songDuration = activeProject?.video_duration || activeProject?.duration || 60;
                              const width = ((clip.duration || 0) / songDuration) * 100;
                              return (
                                <div
                                  key={clip.id}
                                  className="border-r border-border h-full flex flex-col justify-center items-center text-[10px] truncate hover:bg-primary/10 transition-colors cursor-pointer select-none px-1"
                                  style={{ width: `${width}%` }}
                                  title={`Scene ${clip.scene_number} (${clip.duration}s)`}
                                >
                                  <span className="font-bold">S{clip.scene_number}</span>
                                  <span className="text-[8px] text-muted-foreground">{clip.duration}s</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Storyboard Cards list */}
                    <div className="space-y-6">
                      {activeScenes.map((clip) => (
                        <Card key={clip.id} className="overflow-hidden border border-border/85 bg-card/25 shadow-md">
                          <CardContent className="p-5">
                            {pipelineSubStep === "script" && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                  <div>
                                    <span className="text-xs font-bold text-primary mr-2">SCENE {clip.scene_number}</span>
                                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                                      {(clip.start_time ?? 0).toFixed(1)}s - {(clip.end_time ?? 0).toFixed(1)}s (Duration: {clip.duration || 0}s)
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Script Breakdown</span>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Visual Prompt Directive</Label>
                                  <textarea
                                    value={clip.prompt}
                                    onChange={(e) => updateActiveScene(clip.id, { prompt: e.target.value })}
                                    placeholder="Describe what visual action is occurring in this scene..."
                                    className="w-full h-20 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none font-mono"
                                  />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] text-muted-foreground">
                                  <div>Camera: <span className="text-foreground">{clip.camera_setting || "Dynamic Tracking"}</span></div>
                                  <div>Motion: <span className="text-foreground">{clip.motion_setting || "Medium Flow"}</span></div>
                                  <div>Lighting: <span className="text-foreground">{clip.lighting_setting || "Neon Glow"}</span></div>
                                  <div>Outfit: <span className="text-foreground">{clip.character_setting || "Reflective Jacket"}</span></div>
                                  <div>Environment: <span className="text-foreground">{clip.environment_setting || "Wet Streets"}</span></div>
                                </div>
                              </div>
                            )}

                            {pipelineSubStep === "images" && (
                              <div className="flex flex-col md:flex-row items-center gap-4">
                                {/* Left Column: Script details */}
                                <div className="flex-1 w-full space-y-3">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="text-xs font-bold text-primary">SCENE {clip.scene_number}</span>
                                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                                      {clip.duration}s
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground font-mono bg-background/40 p-2.5 rounded-lg border border-border/40 min-h-[60px]">
                                    {clip.prompt}
                                  </p>
                                </div>

                                <ChevronRight className="hidden md:block h-6 w-6 text-muted-foreground shrink-0" />

                                {/* Right Column: Generated Image */}
                                <div className="flex-1 w-full space-y-3">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="text-xs font-bold text-primary">Generated Image Storyboard</span>
                                    <span className="text-[10px] text-muted-foreground">Widescreen Frame</span>
                                  </div>

                                  <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black/40 relative flex items-center justify-center group">
                                    {clip.status === "processing" ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                                        <span className="text-[10px] text-white">Generating frame...</span>
                                      </div>
                                    ) : clip.start_reference_image ? (
                                      <>
                                        <img src={clip.start_reference_image} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRegenerateActiveSceneImage(clip.id)}
                                            className="h-7 text-[9px] border-white/60 text-white hover:bg-white/10"
                                          >
                                            <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                            Pexels Ref
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRegenerateStoryboardAIImage(clip.id)}
                                            className="h-7 text-[9px] border-primary/60 text-primary hover:bg-primary/10"
                                          >
                                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                                            AI Generate
                                          </Button>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-center p-4 text-muted-foreground">
                                        <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground/35 mb-1" />
                                        <p className="text-[9px]">No image generated</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {pipelineSubStep === "videos" && (
                              <div className="flex flex-col lg:flex-row items-center gap-4">
                                {/* Col 1: Script details */}
                                <div className="flex-1 w-full space-y-2">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="text-xs font-bold text-primary">SCENE {clip.scene_number}</span>
                                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                                      {clip.duration}s
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground font-mono bg-background/40 p-2.5 rounded-lg border border-border/40 min-h-[60px] leading-relaxed">
                                    {clip.prompt}
                                  </p>
                                </div>

                                <ChevronRight className="hidden lg:block h-5 w-5 text-muted-foreground shrink-0" />

                                {/* Col 2: Image Storyboard */}
                                <div className="flex-1 w-full space-y-2">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="text-xs font-bold text-primary">Reference Frame</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRegenerateActiveSceneImage(clip.id)}
                                      className="h-6 text-[9px] text-muted-foreground hover:text-foreground"
                                    >
                                      <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                      New Ref (Pexels)
                                    </Button>
                                  </div>
                                  <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black/40 relative">
                                    {clip.start_reference_image ? (
                                      <img src={clip.start_reference_image} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-[10px]">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <ChevronRight className="hidden lg:block h-5 w-5 text-muted-foreground shrink-0" />

                                {/* Col 3: Video Storyboard */}
                                <div className="flex-1 w-full space-y-2">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="text-xs font-bold text-primary">Video Clip</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRegenerateActiveSceneVideo(clip.id)}
                                      disabled={clip.status === "processing"}
                                      className="h-6 text-[9px] text-primary hover:text-primary/90"
                                    >
                                      {clip.videoUrl ? "Regenerate" : "Generate Video"}
                                    </Button>
                                  </div>
                                  <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black relative flex items-center justify-center">
                                    {clip.status === "processing" ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                                        <span className="text-[9px] text-white">Rendering: {clip.progress || 10}%</span>
                                        <Progress value={clip.progress || 10} className="h-1 mt-1.5 w-3/4" />
                                      </div>
                                    ) : clip.videoUrl ? (
                                      <video src={clip.videoUrl} controls className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="text-center p-4 text-muted-foreground">
                                        <Film className="h-6 w-6 mx-auto text-muted-foreground/35 mb-1" />
                                        <p className="text-[9px]">Video not generated</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleRegenerateActiveSceneVideo(clip.id)}
                                          className="h-6 text-[9px] mt-1.5"
                                        >
                                          Generate Video Scene
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {loadingAds ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading your library...</p>
              </div>
            ) : (
              <>
                {/* Standard backup progress loader if active ad rendering but project is empty */}
                {!activeProject && activeRenders.length > 0 && (
                  <div className="space-y-4">
                    <RenderProgressBar renders={activeRenders} />
                  </div>
                )}

                {/* Blank state */}
                {(!activeProject || activeProject.status !== "processing") && activeRenders.length === 0 && completedAds.length === 0 && (
                  <div className="h-full flex items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 min-h-[300px]">
                    <div className="text-center p-8">
                      <Music2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground font-medium">Your music video will appear here</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Fill out the form and hit generate to trigger the pipeline</p>
                    </div>
                  </div>
                )}

                {/* Library Section Capped at 4 items */}
                {(completedAds.length > 0 || inProgressAds.length > 0) && (
                  <div className="space-y-4 pt-6 border-t border-border mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground">Library Projects</h2>
                        <p className="text-xs text-muted-foreground font-medium">Open any completed project to view and edit its Storyboard timeline</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="text-xs">
                        <Link to="/library">
                          Go to Library &rarr;
                        </Link>
                      </Button>
                    </div>
                    
                    <OutputGallery
                      ads={[
                        ...inProgressAds,
                        ...completedAds.filter((ad) => !inProgressAds.includes(ad)),
                      ].slice(0, 4) as any}
                      onDelete={handleDeleteAd}
                      onEditStoryboard={(ad) => setEditingStoryboardAd(ad)}
                      isLoading={loadingAds}
                    />

                    {completedAds.length > 4 && (
                      <div className="flex justify-center pt-4">
                        <Button variant="outline" asChild className="h-10 px-6 font-semibold">
                          <Link to="/library">
                            View All Videos ({completedAds.length})
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Script View/Edit Dialog ── */}
      <Dialog open={showScriptDialog} onOpenChange={() => {
        setShowScriptDialog(false);
        setIsEditingScript(false);
      }}>
        <DialogContent className="max-w-2xl bg-card border-border p-6 rounded-2xl space-y-4 text-foreground text-xs">
          <DialogHeader className="border-b border-border/50 pb-2">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {scriptEnrichmentView ? "Enriched Cinematic Script Breakdown" : "Project Music Video Script"}
            </DialogTitle>
          </DialogHeader>

          {activeScript ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-1 bg-muted/10 p-3 rounded-lg">
                <p className="font-semibold text-foreground">Story Concept</p>
                {isEditingScript ? (
                  <textarea
                    value={scriptConcept}
                    onChange={(e) => setScriptConcept(e.target.value)}
                    className="w-full h-16 rounded border bg-card p-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="text-muted-foreground italic">"{activeScript.story_concept}"</p>
                )}
              </div>

              <div className="space-y-1 bg-muted/10 p-3 rounded-lg">
                <p className="font-semibold text-foreground">Visual Narrative Arc</p>
                {isEditingScript ? (
                  <textarea
                    value={scriptNarrative}
                    onChange={(e) => setScriptNarrative(e.target.value)}
                    className="w-full h-24 rounded border bg-card p-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="text-muted-foreground leading-relaxed">{activeScript.visual_narrative}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-bold text-foreground border-b border-border/30 pb-1 uppercase text-[10px]">Scene Timelines Breakdown</p>
                {activeScript.scene_breakdown && activeScript.scene_breakdown.map((sc: any, idx: number) => (
                  <div key={idx} className="p-3 border border-border/50 rounded-lg bg-card/65 space-y-1.5">
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>Scene {sc.scene || (idx + 1)} ({sc.duration}s)</span>
                      {scriptEnrichmentView && <span className="text-[10px] text-primary">{sc.emotion || "Contemplative"}</span>}
                    </div>
                    <p className="text-muted-foreground leading-normal">{sc.prompt}</p>
                    
                    {scriptEnrichmentView && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1.5 border-t border-border/20">
                        <div>Camera: <span className="text-foreground">{sc.camera || "Dynamic Pushes"}</span></div>
                        <div>Lighting: <span className="text-foreground">{sc.lighting || "Neon Glow"}</span></div>
                        <div>Wardrobe: <span className="text-foreground">{sc.wardrobe || "Reflective Techwear"}</span></div>
                        <div>Environment: <span className="text-foreground">{sc.environment || "Wet alleys"}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No script generated yet. Pipeline is processing.
            </div>
          )}

          <DialogFooter className="border-t border-border/50 pt-3 flex justify-between items-center">
            {isEditingScript ? (
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => setIsEditingScript(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveScript} className="gap-1">
                  <Save className="h-3.5 w-3.5" /> Save Changes
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => setShowScriptDialog(false)}>Close</Button>
                {activeScript && !scriptEnrichmentView && (
                  <Button size="sm" onClick={() => setIsEditingScript(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Script
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubscriptionPlansDialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog} />
    </div>
  );
};

export default UGCGenerator;
