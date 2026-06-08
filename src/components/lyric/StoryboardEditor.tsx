import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SceneCard } from "./SceneCard";
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
  // Per-scene action lock — synchronous Set ref so a fast double-click can't
  // start two jobs on the same scene before React re-renders.
  const sceneLocks = useRef<Set<string>>(new Set());

  useEffect(() => {
    const duration = ad.video_duration || ad.duration || 60;
    setSongDuration(duration);
    fetchStoryboardScenes(duration);
    fetchSceneVersions();
  }, [ad]);

  const fetchStoryboardScenes = async (duration: number) => {
    try {
      // Primary source: video_scenes (Nano Banana storyboard images live here)
      const { data: vScenes } = await supabase
        .from("video_scenes")
        .select("id, index, image_url, image_status, prompt, start_sec, end_sec, lyric_lines")
        .eq("ad_id", ad.id)
        .order("index", { ascending: true });

      if (vScenes && vScenes.length > 0) {
        const adCopy = ad.ad_copy || {};
        const kieTasks: any[] = Array.isArray(adCopy.kieTasks) ? adCopy.kieTasks : [];
        const videoByScene = new Map<string, string>();
        for (const t of kieTasks) {
          if (t?.sceneId && t?.videoUrl) videoByScene.set(t.sceneId, t.videoUrl);
        }
        const mapped: StoryboardClip[] = vScenes.map((s: any, idx: number) => {
          const p = s.prompt || {};
          const dur = Math.max(0.5, Number(s.end_sec) - Number(s.start_sec)) || 8;
          const promptText = [p.story, p.camera, p.vfx].filter(Boolean).join(" ")
            || (Array.isArray(s.lyric_lines) ? s.lyric_lines.join(" ") : "")
            || `Scene ${idx + 1}`;
          const vid = videoByScene.get(s.id) || null;
          return {
            id: s.id,
            scene_number: (s.index ?? idx) + 1,
            prompt: promptText,
            duration: dur,
            start_time: Number(s.start_sec) || 0,
            end_time: Number(s.end_sec) || 0,
            start_reference_image: s.image_url || null,
            end_reference_image: s.image_url || null,
            camera_setting: p.camera || "Dynamic Tracking",
            motion_setting: "Medium Flow",
            environment_setting: p.environment || "Neon Streets",
            lighting_setting: p.colorGrading || "Neon Glow",
            character_setting: "Reflective Jacket",
            videoUrl: vid,
            status: vid ? "completed" : (s.image_status === "ready" ? "idle" : "processing"),
            model_used: adCopy.aiModel || "Nano Banana",
            seed: 0,
            generation_time: "—",
            prompt_version: 1,
          };
        });
        setClips(mapped);
        return;
      }

      // Fallback: legacy storyboard in ad_copy, then default init
      const adCopy = ad.ad_copy || {};
      if (adCopy.storyboard && Array.isArray(adCopy.storyboard) && adCopy.storyboard.length > 0) {
        const legacyMapped = adCopy.storyboard.map((c: any, idx: number) => ({
          id: c.id || `scene_${idx}`,
          scene_number: c.index || (idx + 1),
          prompt: c.prompt || "Visual scene details...",
          duration: c.duration || 10,
          start_time: 0,
          end_time: 0,
          start_reference_image: c.referenceImageUrl || c.image_url || null,
          end_reference_image: c.image_url || null,
          camera_setting: "Dynamic Tracking",
          motion_setting: "Medium Flow",
          environment_setting: "Wet Alley",
          lighting_setting: "Neon Glow",
          character_setting: "Reflective Jacket",
          videoUrl: c.videoUrl || null,
          status: c.videoUrl ? "completed" : "idle",
        }));
        setClips(autoAdjustClips(legacyMapped, duration));
      } else {
        const masterPrompt = adCopy.lyricsPreview || ad.prompt_used || "Cinematic music video scene";
        const initList = initializeDefaultStoryboard(masterPrompt, duration);
        setClips(autoAdjustClips(initList, duration));
      }
    } catch (err) {
      console.error("[StoryboardEditor] fetch error:", err);
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
        start_reference_image: ad.ad_copy?.referenceImageUrl || "/placeholder.svg",
        end_reference_image: ad.ad_copy?.referenceImageUrl || "/placeholder.svg",
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
    // Persist editable scene fields back to video_scenes when possible.
    try {
      const updates: any = {};
      if (typeof fields.prompt === "string") {
        updates.prompt = {
          story: fields.prompt,
          camera: fields.camera_setting,
          environment: fields.environment_setting,
          colorGrading: fields.lighting_setting,
        };
      }
      if (typeof fields.start_time === "number") updates.start_sec = fields.start_time;
      if (typeof fields.end_time === "number") updates.end_sec = fields.end_time;
      if (typeof fields.start_reference_image === "string") updates.image_url = fields.start_reference_image;
      if (Object.keys(updates).length > 0) {
        await supabase.from("video_scenes").update(updates).eq("id", clipId);
      }
    } catch (e) {
      console.warn("[StoryboardEditor] autosave skipped:", e);
    }
  };

  const syncScenesToDB = async (_updatedClips: StoryboardClip[]) => {
    // No-op: timeline-level resync is handled per-scene via autosaveClip.
    return;
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
      start_reference_image: ad.ad_copy?.referenceImageUrl || "/placeholder.svg",
      end_reference_image: ad.ad_copy?.referenceImageUrl || "/placeholder.svg",
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

  // Regenerate Image — runs Nano Banana for this single scene and swaps the
  // displayed reference frame as soon as the new image_url comes back.
  const handleRegenerateImage = async (clipId: string) => {
    const target = clips.find(c => c.id === clipId);
    if (!target) return;
    if (sceneLocks.current.has(clipId)) {
      toast({ title: "Already running", description: `Scene ${target.scene_number} has a job in progress.` });
      return;
    }
    sceneLocks.current.add(clipId);

    updateClip(clipId, { status: "processing", progress: 20 });

    try {
      const { data, error } = await supabase.functions.invoke("regenerate-scene-image", {
        body: { sceneId: clipId },
      });
      if (error) throw error;
      const newImg = (data as any)?.url as string | undefined;
      if (!newImg) throw new Error("Regeneration did not return an image URL");

      // Cache-bust so the <img> actually re-fetches when the URL is unchanged.
      const displayUrl = `${newImg}${newImg.includes("?") ? "&" : "?"}t=${Date.now()}`;

      updateClip(clipId, {
        status: "idle",
        active_image_id: `img_${Math.random().toString(36).substring(2, 10)}`,
        start_reference_image: displayUrl,
        end_reference_image: displayUrl,
      });

      saveSceneVersion(clipId, "image", {
        prompt: target.prompt,
        image_url: newImg,
        video_url: target.videoUrl,
        camera_setting: target.camera_setting,
        motion_setting: target.motion_setting,
        environment_setting: target.environment_setting,
        lighting_setting: target.lighting_setting,
        character_setting: target.character_setting,
        start_reference_image: newImg,
        end_reference_image: newImg,
      });
      toast({ title: "Image Regenerated", description: `New frame generated for Scene ${target.scene_number}.` });
    } catch (err) {
      console.error("[StoryboardEditor] regenerate image error:", err);
      updateClip(clipId, { status: "idle" });
      toast({
        title: "Regeneration failed",
        description: err instanceof Error ? err.message : "Failed to regenerate scene image.",
        variant: "destructive",
      });
    } finally {
      sceneLocks.current.delete(clipId);
    }
  };

  // Regenerate Video Scene — submits a single Kie clip via the
  // `regenerate-scene-video` edge function and swaps the preview URL once
  // the clip finishes. The edge function handles submission + polling so the
  // browser only sees a single awaited request.
  const handleRegenerateSceneVideo = async (clipId: string) => {
    const target = clips.find(c => c.id === clipId);
    if (!target) return;
    if (sceneLocks.current.has(clipId)) {
      toast({ title: "Already running", description: `Scene ${target.scene_number} has a job in progress.` });
      return;
    }
    if (!target.start_reference_image) {
      toast({
        title: "Image required",
        description: `Generate the image for Scene ${target.scene_number} first.`,
        variant: "destructive",
      });
      return;
    }
    sceneLocks.current.add(clipId);

    updateClip(clipId, { status: "processing", progress: 15 });

    // Soft progress so the UI keeps moving while the edge function polls Kie.
    let pct = 15;
    const tick = setInterval(() => {
      pct = Math.min(92, pct + 4);
      updateClip(clipId, { progress: pct });
    }, 3000);

    try {
      console.log(`[Video Scene Generate Editor] Submitting prompt: "${target.prompt}"`);
      const { data, error } = await supabase.functions.invoke("regenerate-scene-video", {
        body: { sceneId: clipId },
      });
      clearInterval(tick);
      if (error) throw error;
      const videoUrl = (data as any)?.videoUrl as string | undefined;
      if (!videoUrl) throw new Error((data as any)?.error || "No video URL returned");

      updateClip(clipId, {
        status: "completed",
        progress: 100,
        videoUrl,
        video_url: videoUrl,
        prompt_version: (target.prompt_version || 1) + 1,
      });

      saveSceneVersion(clipId, "video", {
        prompt: target.prompt,
        image_url: target.start_reference_image,
        video_url: videoUrl,
        camera_setting: target.camera_setting,
        motion_setting: target.motion_setting,
        environment_setting: target.environment_setting,
        lighting_setting: target.lighting_setting,
        character_setting: target.character_setting,
        start_reference_image: target.start_reference_image,
        end_reference_image: target.end_reference_image,
      });
      toast({ title: "Video Scene Rendered", description: `Scene ${target.scene_number} clip is ready.` });
    } catch (err) {
      clearInterval(tick);
      console.error("Video submission error in editor:", err);
      updateClip(clipId, { status: "idle" });
      toast({
        title: "Video generation failed",
        description: err instanceof Error ? err.message : "Failed to trigger video generation.",
        variant: "destructive",
      });
    } finally {
      sceneLocks.current.delete(clipId);
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
    const audioUrl = ad.ad_copy?.audioFileUrl || ad.ad_copy?.audioUrl || ad.audio_url || null;
    
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
          {clips.map((clip) => {
            const hasImage = !!clip.start_reference_image;
            const hasVideo = !!clip.videoUrl;
            return (
              <SceneCard
                key={clip.id}
                sceneNumber={clip.scene_number}
                timeRange={`${(clip.start_time ?? 0).toFixed(1)}s - ${(clip.end_time ?? 0).toFixed(1)}s (Duration: ${clip.duration ?? 0}s)`}
                hasImage={hasImage}
                hasVideo={hasVideo}
                previewTitle={<><Video className="h-4 w-4 text-primary" /> Generated Video Clip Preview</>}
                headerRight={
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDuplicateClip(clip)} title="Duplicate Scene">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleSplitClip(clip.id)} title="Split Scene">
                      <Scissors className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClip(clip.id)} title="Delete Scene">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                }
                leftContent={
                  <>
                    {/* Scene Prompt */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Scene Prompt (Widescreen Render)</Label>
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
                      {(() => {
                        const bucketRefs: string[] = Array.from(new Set([
                          ...((ad.ad_copy?.referenceImages as string[] | undefined) ?? []),
                          ...((ad.ad_copy?.pexelsBackgroundUrls as string[] | undefined) ?? []),
                          ad.ad_copy?.referenceImageUrl as string | undefined,
                          ad.ad_copy?.pexelsBackgroundUrl as string | undefined,
                          clip.start_reference_image,
                          clip.end_reference_image,
                        ].filter((u): u is string => typeof u === "string" && u.length > 0)));
                        const fallback = bucketRefs[0] || "/placeholder.svg";
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[8px] text-muted-foreground block">Start Reference Frame</span>
                              <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg p-1">
                                <img src={clip.start_reference_image || fallback} className="w-8 h-8 rounded object-cover" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] truncate block text-muted-foreground">Start Anchor</span>
                                </div>
                                <select
                                  value={clip.start_reference_image || ""}
                                  onChange={(e) => updateClip(clip.id, { start_reference_image: e.target.value })}
                                  className="bg-transparent border-none text-[8px] max-w-[60px] focus:outline-none"
                                >
                                  {bucketRefs.length === 0 && <option value="">—</option>}
                                  {bucketRefs.map((u, i) => (
                                    <option key={`s-${i}`} value={u}>Ref {i + 1}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] text-muted-foreground block">End Reference Frame</span>
                              <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg p-1">
                                <img src={clip.end_reference_image || fallback} className="w-8 h-8 rounded object-cover" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] truncate block text-muted-foreground">End Anchor</span>
                                </div>
                                <select
                                  value={clip.end_reference_image || ""}
                                  onChange={(e) => updateClip(clip.id, { end_reference_image: e.target.value })}
                                  className="bg-transparent border-none text-[8px] max-w-[60px] focus:outline-none"
                                >
                                  {bucketRefs.length === 0 && <option value="">—</option>}
                                  {bucketRefs.map((u, i) => (
                                    <option key={`e-${i}`} value={u}>Ref {i + 1}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
                  </>
                }
                previewSlot={
                  clip.status === "processing" ? (
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
                  )
                }
                metadataSlot={
                  <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg text-[10px] text-muted-foreground font-mono">
                    <div>Model: <span className="text-foreground">{clip.model_used || "Kling 3.0"}</span></div>
                    <div>Seed: <span className="text-foreground">{clip.seed || 1234567}</span></div>
                    <div>Render Time: <span className="text-foreground">{clip.generation_time || "4.2s"}</span></div>
                    <div>Prompt Version: <span className="text-foreground">V{clip.prompt_version || 1}</span></div>
                  </div>
                }
                imageButton={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerateImage(clip.id)}
                    disabled={clip.status === "processing"}
                    className="h-8 text-[10px]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" />
                    {hasImage ? "1) Regenerate Image" : "1) Generate Image"}
                  </Button>
                }
                midActions={
                  clip.videoUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(clip.videoUrl!, "_blank")}
                      className="h-8 text-[10px]"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                  ) : null
                }
                videoButton={
                  <Button
                    size="sm"
                    onClick={() => handleRegenerateSceneVideo(clip.id)}
                    disabled={clip.status === "processing" || !hasImage}
                    title={!hasImage ? "Generate the scene image first" : undefined}
                    className="h-8 text-[10px] bg-primary hover:bg-primary/95 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {clip.status === "processing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    {!hasImage ? "2) Image required" : hasVideo ? "2) Regenerate Video" : "2) Generate Video"}
                  </Button>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
