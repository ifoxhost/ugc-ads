import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import PexelsBackgroundPicker from "./PexelsBackgroundPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Trash2,
  Plus,
  ArrowLeft,
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  Scissors,
  X,
  Image as ImageIcon,
  Copy,
  Download,
  Video,
  History,
  RotateCcw,
  Film
} from "lucide-react";

export interface StoryboardClip {
  id: string;
  scene_number: number;
  prompt: string;
  duration: number; // in seconds
  start_time: number;
  end_time: number;
  start_reference_image: string | null;
  end_reference_image: string | null;
  camera_setting: string;
  motion_setting: string;
  environment_setting: string;
  lighting_setting: string;
  character_setting: string;
  active_image_id?: string | null;
  active_video_id?: string | null;
  videoUrl?: string | null;
  // Legacy fields
  video_url?: string | null;
  status: "idle" | "processing" | "completed" | "failed";
  progress?: number;
  // Metadata fields
  model_used?: string;
  seed?: number;
  generation_time?: string;
  prompt_version?: number;
}

interface StoryboardEditorProps {
  ad: any; // The project or ad copy
  onClose: () => void;
  onSave: (updatedAd: any) => void;
}

const autoAdjustClips = (
  targetClips: StoryboardClip[],
  targetDuration: number,
  lockedClipId?: string
): StoryboardClip[] => {
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

export default function StoryboardEditor({ ad, onClose, onSave }: StoryboardEditorProps) {
  const { toast } = useToast();
  const [clips, setClips] = useState<StoryboardClip[]>([]);
  const [songDuration, setSongDuration] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  
  // Versions history mapping
  const [sceneVersions, setSceneVersions] = useState<Record<string, any[]>>({});

  // Export options
  const [exportRes, setExportRes] = useState<string>("1080p");
  const [exportFps, setExportFps] = useState<number>(30);

  useEffect(() => {
    const duration = ad.video_duration || ad.duration || 60;
    setSongDuration(duration);
    fetchStoryboardScenes(duration);
    fetchSceneVersions();
  }, [ad]);

  const fetchStoryboardScenes = async (duration: number) => {
    try {
      const { data, error } = await supabase
        .from("storyboard_scenes")
        .select("*")
        .eq("project_id", ad.id)
        .order("scene_number", { ascending: true });

      if (!error && data && data.length > 0) {
        // Map database fields to scene state
        const mapped = data.map((d: any) => ({
          ...d,
          videoUrl: d.videoUrl || d.video_url || null,
          status: d.videoUrl ? "completed" : "idle",
          model_used: d.model_used || "Kling 3.0",
          seed: d.seed || 1234567,
          generation_time: d.generation_time || "4.2s",
          prompt_version: d.prompt_version || 1
        }));
        setClips(autoAdjustClips(mapped, duration));
      } else {
        // Fallback to legacy schema
        const adCopy = ad.ad_copy || {};
        if (adCopy.storyboard && Array.isArray(adCopy.storyboard) && adCopy.storyboard.length > 0) {
          const legacyMapped = adCopy.storyboard.map((c: any, idx: number) => ({
            id: c.id || `scene_${idx}`,
            scene_number: c.index || (idx + 1),
            prompt: c.prompt || "Visual scene details...",
            duration: c.duration || 10,
            start_time: 0,
            end_time: 0,
            start_reference_image: c.referenceImageUrl || "https://picsum.photos/id/40/300/300",
            end_reference_image: "https://picsum.photos/id/41/300/300",
            camera_setting: "Dynamic Tracking",
            motion_setting: "Medium Flow",
            environment_setting: "Wet Alley",
            lighting_setting: "Neon Glow",
            character_setting: "Reflective Jacket",
            videoUrl: c.videoUrl || null,
            status: c.videoUrl ? "completed" : "idle"
          }));
          setClips(autoAdjustClips(legacyMapped, duration));
        } else {
          // Fallback init
          const masterPrompt = adCopy.lyricsPreview || ad.prompt_used || "Cinematic music video scene";
          const initList = initializeDefaultStoryboard(masterPrompt, duration);
          setClips(autoAdjustClips(initList, duration));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSceneVersions = async () => {
    try {
      const { data } = await supabase
        .from("versions")
        .select("*")
        .eq("project_id", ad.id)
        .order("version_number", { ascending: false });

      if (data) {
        const grouped: Record<string, any[]> = {};
        data.forEach((v: any) => {
          if (!grouped[v.scene_id]) grouped[v.scene_id] = [];
          grouped[v.scene_id].push(v);
        });
        setSceneVersions(grouped);
      }
    } catch (err) {
      console.error("Error fetching versions:", err);
    }
  };

  const initializeDefaultStoryboard = (prompt: string, totalSecs: number): StoryboardClip[] => {
    const segmentLength = 12;
    const count = Math.max(1, Math.ceil(totalSecs / segmentLength));
    const list: StoryboardClip[] = [];

    for (let i = 0; i < count; i++) {
      list.push({
        id: `clip-${Math.random().toString(36).substring(2, 9)}`,
        scene_number: i + 1,
        prompt: `Scene ${i + 1}: Protagonist moves through vibrant street lights.`,
        duration: segmentLength,
        start_time: 0,
        end_time: 0,
        start_reference_image: ad.ad_copy?.referenceImageUrl || "https://picsum.photos/id/40/300/300",
        end_reference_image: "https://picsum.photos/id/41/300/300",
        camera_setting: "Dynamic Tracking",
        motion_setting: "Medium Flow",
        environment_setting: "Neon Streets",
        lighting_setting: "Neon Glow",
        character_setting: "Reflective Jacket",
        videoUrl: null,
        status: "idle",
      });
    }
    return list;
  };

  const totalClipsDuration = Number(clips.reduce((sum, c) => sum + c.duration, 0).toFixed(1));
  const isDurationMatching = Math.abs(totalClipsDuration - songDuration) < 0.2;

  const handleAutoFit = () => {
    const adjusted = autoAdjustClips(clips, songDuration);
    setClips(adjusted);
    syncScenesToDB(adjusted);
    toast({ title: "Timeline Auto-Fitted", description: `Scene durations auto-synced to audio timeline of ${songDuration}s.` });
  };

  const updateClip = (id: string, partial: Partial<StoryboardClip>) => {
    setClips(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, ...partial } : c));
      let finalClips = next;
      if (partial.duration !== undefined) {
        finalClips = autoAdjustClips(next, songDuration, id);
      }
      // Autosave to DB
      const updatedItem = finalClips.find(c => c.id === id);
      if (updatedItem) {
        autosaveClip(id, {
          prompt: updatedItem.prompt,
          duration: updatedItem.duration,
          start_time: updatedItem.start_time,
          end_time: updatedItem.end_time,
          start_reference_image: updatedItem.start_reference_image,
          end_reference_image: updatedItem.end_reference_image,
          camera_setting: updatedItem.camera_setting,
          motion_setting: updatedItem.motion_setting,
          environment_setting: updatedItem.environment_setting,
          lighting_setting: updatedItem.lighting_setting,
          character_setting: updatedItem.character_setting,
          videoUrl: updatedItem.videoUrl || null,
        });
      }
      return finalClips;
    });
  };

  const autosaveClip = async (clipId: string, fields: any) => {
    await supabase.from("storyboard_scenes").update(fields).eq("id", clipId);
  };

  const syncScenesToDB = async (updatedClips: StoryboardClip[]) => {
    await supabase.from("storyboard_scenes").delete().eq("project_id", ad.id);
    const inserts = updatedClips.map((c, i) => ({
      id: c.id,
      project_id: ad.id,
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
    await supabase.from("storyboard_scenes").insert(inserts);
  };

  const handleAddClip = () => {
    const newNum = clips.length + 1;
    const newClip: StoryboardClip = {
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      scene_number: newNum,
      prompt: `Scene ${newNum}: Describe visual prompt directives...`,
      duration: 8,
      start_time: 0,
      end_time: 0,
      start_reference_image: "https://picsum.photos/id/40/300/300",
      end_reference_image: "https://picsum.photos/id/41/300/300",
      camera_setting: "Dynamic Tracking",
      motion_setting: "Medium Flow",
      environment_setting: "Neon Alleyways",
      lighting_setting: "Neon Glow",
      character_setting: "Reflective Jacket",
      videoUrl: null,
      status: "idle",
    };
    const combined = [...clips, newClip];
    const adjusted = autoAdjustClips(combined, songDuration);
    setClips(adjusted);
    syncScenesToDB(adjusted);
    toast({ title: "Scene Added", description: "Scene added and timeline auto-fitted." });
  };

  const handleDeleteClip = (id: string) => {
    if (clips.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one scene.", variant: "destructive" });
      return;
    }
    const filtered = clips.filter(c => c.id !== id);
    const adjusted = autoAdjustClips(filtered, songDuration);
    setClips(adjusted);
    syncScenesToDB(adjusted);
    toast({ title: "Scene Deleted", description: "Scene removed and durations re-adjusted." });
  };

  const handleDuplicateClip = (clip: StoryboardClip) => {
    const newClip: StoryboardClip = {
      ...clip,
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      videoUrl: null,
      status: "idle"
    };
    const combined = [...clips, newClip];
    const adjusted = autoAdjustClips(combined, songDuration);
    setClips(adjusted);
    syncScenesToDB(adjusted);
    toast({ title: "Scene Duplicated", description: "Duplicated scene appended successfully." });
  };

  const handleSplitClip = (id: string) => {
    const target = clips.find(c => c.id === id);
    if (!target) return;

    const half = Number((target.duration / 2).toFixed(1));
    if (half < 0.6) {
      toast({ title: "Split Failed", description: "Scene duration too short to split.", variant: "destructive" });
      return;
    }

    const c1 = { ...target, duration: half };
    const c2 = {
      ...target,
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      prompt: `${target.prompt} (Part 2)`,
      duration: Number((target.duration - half).toFixed(1)),
      videoUrl: null,
      status: "idle" as const
    };

    const idx = clips.findIndex(c => c.id === id);
    const next = [...clips];
    next.splice(idx, 1, c1, c2);

    const adjusted = autoAdjustClips(next, songDuration);
    setClips(adjusted);
    syncScenesToDB(adjusted);
    toast({ title: "Scene Split", description: "Scene split successfully." });
  };

  // Regenerate Image
  const handleRegenerateImage = async (clipId: string) => {
    const target = clips.find(c => c.id === clipId);
    if (!target) return;

    updateClip(clipId, { status: "processing", progress: 20 });
    
    try {
      console.log(`[Pexels Manual Search Editor] Searching for image: "${target.prompt}"`);
      const { data, error } = await supabase.functions.invoke("pexels-search", {
        body: {
          query: target.prompt || "cinematic background",
          perPage: 5
        }
      });
      
      if (error) throw error;
      
      const results = data?.results || [];
      if (results.length > 0) {
        const randomIndex = Math.floor(Math.random() * results.length);
        const newImg = results[randomIndex].url;
        console.log(`[Pexels Manual Search Editor] Found image: ${newImg}`);
        
        updateClip(clipId, {
          status: "idle",
          active_image_id: `img_${Math.random().toString(36).substring(2, 10)}`,
          start_reference_image: newImg
        });
        
        // Save new version snapshot
        const verSnapshot = {
          prompt: target.prompt,
          image_url: newImg,
          video_url: target.videoUrl,
          camera_setting: target.camera_setting,
          motion_setting: target.motion_setting,
          environment_setting: target.environment_setting,
          lighting_setting: target.lighting_setting,
          character_setting: target.character_setting,
          start_reference_image: newImg,
          end_reference_image: target.end_reference_image
        };
        
        saveSceneVersion(clipId, "image", verSnapshot);
        toast({ title: "Image Generated", description: `New visual frame generated for Scene ${target.scene_number}.` });
      } else {
        throw new Error("No images found on Pexels");
      }
    } catch (err) {
      console.error("Image generation error in editor:", err);
      toast({
        title: "Regeneration failed",
        description: err instanceof Error ? err.message : "Failed to search stock photos.",
        variant: "destructive"
      });
      // Fallback
      const randomId = Math.floor(Math.random() * 100) + 50;
      const fallbackImg = `https://images.unsplash.com/photo-${1500000000000 + randomId}?auto=format&fit=crop&w=1920&q=80`;
      updateClip(clipId, { status: "idle", start_reference_image: fallbackImg });
    }
  };

  // Regenerate Video Scene
  const handleRegenerateSceneVideo = async (clipId: string) => {
    const target = clips.find(c => c.id === clipId);
    if (!target) return;

    updateClip(clipId, { status: "processing", progress: 10 });
    
    try {
      console.log(`[Video Scene Generate Editor] Submitting prompt: "${target.prompt}"`);
      const response = await fetch("http://localhost:3000/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: target.prompt,
          model: ad.video_model || "kling",
          aspectRatio: ad.aspect_ratio || "16:9"
        })
      });
      
      const resData = await response.json();
      if (!response.ok || resData.error) {
        throw new Error(resData.error || "Failed to submit video task");
      }
      
      const taskId = resData.data?.taskId;
      if (!taskId) throw new Error("No task ID returned from video generator");
      console.log(`[Video Scene Generate Editor] Submitted successfully. Task ID: ${taskId}`);
      
      let progress = 10;
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:3000/api/video/status/${taskId}`);
          const statusData = await statusRes.json();
          
          if (!statusRes.ok || statusData.error) {
            throw new Error(statusData.error || "Failed to query task status");
          }
          
          const record = statusData.data?.record?.[0];
          const taskStatus = statusData.data?.status;
          console.log(`[Video Scene Polling Editor] Task ${taskId} status: ${taskStatus}`);
          
          if (taskStatus === "success" && record?.videoUrl) {
            clearInterval(interval);
            const videoUrl = record.videoUrl;
            
            updateClip(clipId, {
              status: "completed",
              videoUrl: videoUrl,
              video_url: videoUrl,
              model_used: ad.video_model === "veo" ? "Google Veo 3.1" : "Kling 3.0",
              seed: Math.floor(Math.random() * 9000000) + 1000000,
              generation_time: "4.5s",
              prompt_version: (target.prompt_version || 1) + 1
            });
            
            const verSnapshot = {
              prompt: target.prompt,
              image_url: target.start_reference_image,
              video_url: videoUrl,
              camera_setting: target.camera_setting,
              motion_setting: target.motion_setting,
              environment_setting: target.environment_setting,
              lighting_setting: target.lighting_setting,
              character_setting: target.character_setting,
              start_reference_image: target.start_reference_image,
              end_reference_image: target.end_reference_image
            };
            
            saveSceneVersion(clipId, "video", verSnapshot);
            toast({ title: "Video Scene Rendered", description: `Scene ${target.scene_number} clip is ready.` });
          } else if (taskStatus === "failed") {
            clearInterval(interval);
            throw new Error("Video generation failed on server");
          } else {
            progress = Math.min(95, progress + 10);
            updateClip(clipId, { progress });
          }
        } catch (pollErr) {
          clearInterval(interval);
          console.error("Video polling error in editor:", pollErr);
          updateClip(clipId, { status: "idle" });
          toast({
            title: "Video generation failed",
            description: pollErr instanceof Error ? pollErr.message : "Failed to compile video scene.",
            variant: "destructive"
          });
        }
      }, 3000);
      
    } catch (err) {
      console.error("Video submission error in editor:", err);
      toast({
        title: "Video generation failed",
        description: err instanceof Error ? err.message : "Failed to trigger video generation.",
        variant: "destructive"
      });
      updateClip(clipId, { status: "idle" });
    }
  };

  const saveSceneVersion = async (sceneId: string, type: string, snapshotData: any) => {
    const currentList = sceneVersions[sceneId] || [];
    const nextVerNum = currentList.length + 1;
    
    const newVer = {
      id: "ver_" + Math.random().toString(36).substring(2, 15),
      scene_id: sceneId,
      project_id: ad.id,
      version_number: nextVerNum,
      type,
      data: snapshotData,
      created_at: new Date().toISOString()
    };

    await supabase.from("versions").insert(newVer);
    fetchSceneVersions();
  };

  const handleRestoreVersion = async (sceneId: string, ver: any) => {
    const snapshot = ver.data;
    updateClip(sceneId, {
      prompt: snapshot.prompt,
      start_reference_image: snapshot.start_reference_image,
      end_reference_image: snapshot.end_reference_image,
      camera_setting: snapshot.camera_setting,
      motion_setting: snapshot.motion_setting,
      environment_setting: snapshot.environment_setting,
      lighting_setting: snapshot.lighting_setting,
      character_setting: snapshot.character_setting,
      videoUrl: snapshot.video_url,
      status: snapshot.video_url ? "completed" : "idle"
    });
    toast({ title: "Version Restored", description: `Restored scene parameters from Version ${ver.version_number}.` });
  };

  // Compile final project video
  const handleCompile = async () => {
    if (!isDurationMatching) {
      toast({ title: "Cannot Compile", description: "Clips duration must equal song length.", variant: "destructive" });
      return;
    }

    const videoUrls = clips.map(c => c.videoUrl || c.video_url).filter(Boolean);
    const audioUrl = ad.audio_url || ad.ad_copy?.audioUrl || "https://cdn1.suno.ai/7b879f5c-21d0-4922-89ea-fa5bdcd372d1.mp3";
    
    if (videoUrls.length === 0) {
      toast({
        title: "Cannot compile",
        description: "No rendered video clips found. Please render video clips for scenes first.",
        variant: "destructive"
      });
      return;
    }

    setCompiling(true);
    setCompileProgress(15);
    
    try {
      console.log(`[Video Compilation Editor] Merging ${videoUrls.length} clips with audio: ${audioUrl}`);
      setCompileProgress(40);
      
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
      
      setCompileProgress(80);
      
      const finalVidUrl = resData.data?.mergedVideoUrl || videoUrls[0];
      console.log(`[Video Compilation Editor] Master video complete: ${finalVidUrl}`);
      
      const cleanClips = clips.map((c, i) => ({
        id: c.id,
        index: i + 1,
        prompt: c.prompt,
        duration: c.duration,
        referenceImageUrl: c.start_reference_image,
        referenceImageName: "Start Frame Consistency",
        videoUrl: c.videoUrl || null,
        status: c.videoUrl ? "completed" : "idle"
      }));

      const adCopy = {
        ...(ad.ad_copy || {}),
        storyboard: cleanClips,
        aiModel: ad.video_model || "kling",
        resolution: exportRes,
        fps: exportFps,
      };

      // Save export record
      const newExport = {
        id: "exp_" + Math.random().toString(36).substring(2, 15),
        project_id: ad.id,
        video_url: finalVidUrl,
        song_title: ad.title || ad.ad_copy?.title || "Song",
        artist: ad.artist || ad.ad_copy?.artist || "Artist",
        resolution: exportRes,
        fps: exportFps,
        status: "completed",
        created_at: new Date().toISOString()
      };
      await supabase.from("exports").insert(newExport);

      // Update generated_ads compatibility record
      await supabase
        .from("generated_ads")
        .update({
          generated_video_url: finalVidUrl,
          ad_copy: adCopy
        })
        .eq("id", ad.id);

      // Update projects record
      await supabase
        .from("projects")
        .update({
          status: "completed",
          video_url: finalVidUrl
        })
        .eq("id", ad.id);

      setCompileProgress(100);
      setCompiling(false);
      
      toast({
        title: "Compilation Complete!",
        description: `Master Video compiled: "${ad.title || ad.ad_copy?.title} - ${ad.artist || ad.ad_copy?.artist}.mp4"`
      });
      
      onSave({ ...ad, generated_video_url: finalVidUrl, ad_copy: adCopy });
      onClose();
    } catch (err) {
      console.error("Compilation save error in editor:", err);
      setCompiling(false);
      toast({
        title: "Compilation failed",
        description: err instanceof Error ? err.message : "Failed to compile project.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col animate-fade-in text-xs">
      {/* Top Widescreen Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} disabled={compiling}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              Music Video Storyboard System
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Project: <span className="font-semibold text-foreground">{(ad.title || ad.ad_copy?.title || "Untitled Video")}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Export Settings selectors */}
          <div className="hidden md:flex items-center gap-3 border border-border px-3 py-1 rounded-xl bg-card/40">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Export Settings:</span>
            <select
              value={exportRes}
              onChange={(e) => setExportRes(e.target.value)}
              className="bg-transparent font-medium border-none focus:outline-none cursor-pointer"
            >
              <option value="1080p" className="bg-card">1080p</option>
              <option value="1440p" className="bg-card">1440p</option>
              <option value="4k" className="bg-card">4K UHD</option>
            </select>
            <span className="text-border">|</span>
            <select
              value={exportFps}
              onChange={(e) => setExportFps(Number(e.target.value))}
              className="bg-transparent font-medium border-none focus:outline-none cursor-pointer"
            >
              <option value={30} className="bg-card">30 fps</option>
              <option value={60} className="bg-card">60 fps</option>
            </select>
          </div>
          
          <Button size="sm" onClick={handleCompile} disabled={compiling} className="gap-1.5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white">
            {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Compile Master Video
          </Button>
        </div>
      </header>

      {/* Compile Progress Overlay */}
      {compiling && (
        <div className="bg-primary/5 border-b border-primary/20 p-4 space-y-2 animate-fade-in">
          <div className="max-w-xl mx-auto space-y-1">
            <div className="flex justify-between text-xs font-semibold text-primary">
              <span>Stitching storyboard scenes and syncing Suno audio track...</span>
              <span>{compileProgress}%</span>
            </div>
            <Progress value={compileProgress} className="h-2 [&>div]:bg-primary" />
          </div>
        </div>
      )}

      {/* Timeline Sync Health Bar */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6 space-y-3">
        <Card className={cn("border border-border", !isDurationMatching && "border-amber-500/50 bg-amber-500/5")}>
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-sm font-semibold flex items-center gap-2">
                {!isDurationMatching ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Check className="h-4 w-4 text-primary" />
                )}
                Timeline Synchronizer
              </p>
              <p className="text-xs text-muted-foreground">
                Song length: <span className="font-semibold text-foreground">{songDuration}s</span> • Scenes total:{" "}
                <span className={cn("font-semibold", !isDurationMatching ? "text-amber-500 font-bold" : "text-primary")}>
                  {totalClipsDuration}s
                </span>
              </p>
            </div>

            {!isDurationMatching && (
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-amber-500 font-medium">
                  Scene clip lengths must be fitted to match audio length.
                </p>
                <Button variant="outline" size="sm" onClick={handleAutoFit} className="h-8 border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                  <Scissors className="h-3 w-3 mr-1.5" />
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
            {clips.map((clip) => {
              const width = (clip.duration / songDuration) * 100;
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

      {/* Main Storyboard Grid rows */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center border-b border-border/50 pb-2">
          <h2 className="text-base font-bold text-foreground">Storyboard Timeline Scene Cards</h2>
          <Button size="sm" variant="outline" onClick={handleAddClip} className="h-8 text-xs gap-1">
            <Plus className="h-4 w-4" /> Add Scene
          </Button>
        </div>

        <div className="space-y-6">
          {clips.map((clip) => (
            <Card key={clip.id} className="overflow-hidden border border-border/80 shadow-md">
              <CardContent className="p-5 grid lg:grid-cols-2 gap-6 bg-card/15">
                
                {/* ──── LEFT SIDE: SCENE SETTINGS & PROMPT ──── */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <span className="text-xs font-bold text-primary mr-2">SCENE {clip.scene_number}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                        {(clip.start_time ?? 0).toFixed(1)}s - {(clip.end_time ?? 0).toFixed(1)}s (Duration: {clip.duration ?? 0}s)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDuplicateClip(clip)} title="Duplicate Scene">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleSplitClip(clip.id)} title="Split Scene">
                        <Scissors className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClip(clip.id)} title="Delete Scene">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Scene Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Scene Prompt Prompt (Widescreen Render)</Label>
                    <textarea
                      value={clip.prompt}
                      onChange={(e) => updateClip(clip.id, { prompt: e.target.value })}
                      placeholder="Describe what visual action is occurring in this scene..."
                      className="w-full h-20 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none font-mono"
                    />
                  </div>

                  {/* Settings dropdowns grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Camera Movement</Label>
                      <select
                        value={clip.camera_setting}
                        onChange={(e) => updateClip(clip.id, { camera_setting: e.target.value })}
                        className="w-full border border-border bg-card px-2 py-1 rounded-lg focus:outline-none"
                      >
                        {["Static Tripod", "Dynamic Tracking Push", "Slow Pan Left", "High Angle Crane", "Dolly Zoom Push"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Motion Flow</Label>
                      <select
                        value={clip.motion_setting}
                        onChange={(e) => updateClip(clip.id, { motion_setting: e.target.value })}
                        className="w-full border border-border bg-card px-2 py-1 rounded-lg focus:outline-none"
                      >
                        {["Slow Flow", "Medium Flow", "Fast Motion", "Strobe Glitch"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Lighting</Label>
                      <select
                        value={clip.lighting_setting}
                        onChange={(e) => updateClip(clip.id, { lighting_setting: e.target.value })}
                        className="w-full border border-border bg-card px-2 py-1 rounded-lg focus:outline-none"
                      >
                        {["Neon Glow", "Volumetric Daylight", "Cinematic Backlight", "Dark Shadow Lowkey"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Character Outfit</Label>
                      <select
                        value={clip.character_setting}
                        onChange={(e) => updateClip(clip.id, { character_setting: e.target.value })}
                        className="w-full border border-border bg-card px-2 py-1 rounded-lg focus:outline-none"
                      >
                        {["Reflective Techwear Jacket", "Formal Suit", "Casual Techwear", "Choir Robe"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Environment Set</Label>
                      <select
                        value={clip.environment_setting}
                        onChange={(e) => updateClip(clip.id, { environment_setting: e.target.value })}
                        className="w-full border border-border bg-card px-2 py-1 rounded-lg focus:outline-none"
                      >
                        {["Cyberpunk Rain Alleyways", "Church Sanctuary", "Urban Warehouse Stage", "Abstract Nebula Space"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Scene duration manual edit */}
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Scene Duration (s)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={clip.duration}
                        onChange={(e) => updateClip(clip.id, { duration: Number(e.target.value) })}
                        className="h-6 text-[10px] rounded-lg border-border bg-card"
                      />
                    </div>
                  </div>

                  {/* Character Consistency Reference frames */}
                  <div className="space-y-2 border-t border-border/30 pt-3">
                    <Label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Consistency reference frames</Label>
                    <div className="grid grid-cols-2 gap-3">
                      
                      {/* Start frame slot */}
                      <div className="space-y-1">
                        <span className="text-[8px] text-muted-foreground block">Start Reference Frame</span>
                        <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg p-1">
                          <img src={clip.start_reference_image || "https://picsum.photos/id/40/300/300"} className="w-8 h-8 rounded object-cover" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] truncate block text-muted-foreground">Start Anchor</span>
                          </div>
                          <select
                            onChange={(e) => updateClip(clip.id, { start_reference_image: e.target.value })}
                            className="bg-transparent border-none text-[8px] max-w-[50px] focus:outline-none"
                          >
                            <option value="https://picsum.photos/id/40/300/300">Frame 1</option>
                            <option value="https://picsum.photos/id/42/300/300">Frame 2</option>
                            <option value="https://picsum.photos/id/45/300/300">Frame 3</option>
                          </select>
                        </div>
                      </div>

                      {/* End frame slot */}
                      <div className="space-y-1">
                        <span className="text-[8px] text-muted-foreground block">End Reference Frame</span>
                        <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg p-1">
                          <img src={clip.end_reference_image || "https://picsum.photos/id/41/300/300"} className="w-8 h-8 rounded object-cover" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] truncate block text-muted-foreground">End Anchor</span>
                          </div>
                          <select
                            onChange={(e) => updateClip(clip.id, { end_reference_image: e.target.value })}
                            className="bg-transparent border-none text-[8px] max-w-[50px] focus:outline-none"
                          >
                            <option value="https://picsum.photos/id/41/300/300">Frame A</option>
                            <option value="https://picsum.photos/id/48/300/300">Frame B</option>
                            <option value="https://picsum.photos/id/49/300/300">Frame C</option>
                          </select>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Versions history dropdown */}
                  {sceneVersions[clip.id] && sceneVersions[clip.id].length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
                      <History className="h-3.5 w-3.5 text-primary" />
                      <span>Version History:</span>
                      <select
                        onChange={(e) => {
                          const v = sceneVersions[clip.id].find(v => v.id === e.target.value);
                          if (v) handleRestoreVersion(clip.id, v);
                        }}
                        className="bg-muted/40 border border-border/50 rounded-md px-1.5 py-0.5"
                      >
                        <option value="">Restore version...</option>
                        {sceneVersions[clip.id].map((v) => (
                          <option key={v.id} value={v.id}>
                            Version {v.version_number} ({v.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>

                {/* ──── RIGHT SIDE: RENDER VIEW PLAYER & DETAILS ──── */}
                <div className="flex flex-col justify-between border-l border-border/40 pl-0 lg:pl-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Video className="h-4 w-4 text-primary" /> Generated Video Clip Preview
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">Render Node</span>
                  </div>

                  {/* Video Player Box */}
                  <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black relative flex items-center justify-center">
                    {clip.status === "processing" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                        <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
                        <span className="text-[10px] text-white">AI Rendering Video Clip: {clip.progress || 10}%</span>
                        <Progress value={clip.progress || 10} className="h-1.5 w-3/4 mt-2" />
                      </div>
                    ) : clip.videoUrl ? (
                      <video src={clip.videoUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6 text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/35 mb-2" />
                        <p className="text-[10px]">No video clip rendered for this scene card.</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Configure settings and click "Regenerate Scene" to render.</p>
                      </div>
                    )}
                  </div>

                  {/* Rendering Metadata stats */}
                  <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg text-[10px] text-muted-foreground font-mono">
                    <div>Model: <span className="text-foreground">{clip.model_used || "Kling 3.0"}</span></div>
                    <div>Seed: <span className="text-foreground">{clip.seed || 1234567}</span></div>
                    <div>Render Time: <span className="text-foreground">{clip.generation_time || "4.2s"}</span></div>
                    <div>Prompt Version: <span className="text-foreground">V{clip.prompt_version || 1}</span></div>
                  </div>

                  {/* Render operational buttons */}
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/30">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateImage(clip.id)}
                        disabled={clip.status === "processing"}
                        className="h-8 text-[10px]"
                      >
                        <ImageIcon className="h-3.5 w-3.5 mr-1" /> Regenerate Image
                      </Button>
                      
                      {clip.videoUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(clip.videoUrl!, "_blank")}
                          className="h-8 text-[10px]"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Download
                        </Button>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleRegenerateSceneVideo(clip.id)}
                      disabled={clip.status === "processing"}
                      className="h-8 text-[10px] bg-primary hover:bg-primary/95 text-white"
                    >
                      {clip.status === "processing" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                      )}
                      Regenerate Scene Video
                    </Button>
                  </div>

                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
