// Local Mock / Sandboxed Supabase Client for local testing
import { Database } from './types';

const IS_MOCK = import.meta.env.VITE_LOCAL_MOCK === 'true';

// Mock User Details
const mockUser = {
  id: "mock-user-123",
  email: "local-tester@example.com",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Local Tester" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const mockSession = {
  access_token: "mock-token-abc",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "mock-refresh-token",
  user: mockUser,
};

// Initialize Mock Databases in localStorage
const initMockDBs = () => {
  if (!localStorage.getItem("db_user_roles")) {
    localStorage.setItem("db_user_roles", JSON.stringify([
      { user_id: mockUser.id, role: "admin" }
    ]));
  }
  if (!localStorage.getItem("db_subscriptions")) {
    localStorage.setItem("db_subscriptions", JSON.stringify([
      { id: "sub-1", user_id: mockUser.id, status: "active", credits: 500, credits_used: 15, plan_name: "Premium Pro" }
    ]));
  }
  if (!localStorage.getItem("db_profiles")) {
    localStorage.setItem("db_profiles", JSON.stringify([
      { id: mockUser.id, email: mockUser.email, full_name: "Local Tester" }
    ]));
  }
  if (!localStorage.getItem("db_projects")) {
    localStorage.setItem("db_projects", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_scripts")) {
    localStorage.setItem("db_scripts", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_storyboards")) {
    localStorage.setItem("db_storyboards", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_storyboard_scenes")) {
    localStorage.setItem("db_storyboard_scenes", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_scene_images")) {
    localStorage.setItem("db_scene_images", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_scene_videos")) {
    localStorage.setItem("db_scene_videos", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_versions")) {
    localStorage.setItem("db_versions", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_exports")) {
    localStorage.setItem("db_exports", JSON.stringify([]));
  }
  if (!localStorage.getItem("db_generated_ads")) {
    localStorage.setItem("db_generated_ads", JSON.stringify([
      {
        id: "ad-1",
        user_id: mockUser.id,
        email: mockUser.email,
        style_template: "kinetic",
        aspect_ratio: "9:16",
        product_image_url: "https://placehold.co/1080x1920/0a0a0a/ffffff?text=Lyric+Video",
        generated_video_url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c02cba73d47d0078323b6d7e26753811&profile_id=165&oauth2_token_id=57447761",
        status: "completed",
        video_status: "idle",
        video_progress: 100,
        ad_copy: {
          title: "Stardust Cosmic Ride",
          artist: "VibeSync AI",
          lyricsPreview: "Lost in the stardust rain, riding through the neon pain...",
          fontTheme: "bold",
          colorPalette: "dark"
        },
        created_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date(Date.now() - 3500000).toISOString()
      }
    ]));
  }
};

class MockQueryBuilder {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private opData: any = null;
  private filters: ((item: any) => boolean)[] = [];
  private sortCol: string | null = null;
  private sortAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    initMockDBs();
  }

  select(columns?: string, options?: any) {
    this.operation = 'select';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(item => item[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(item => item[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push(item => values.includes(item[column]));
    return this;
  }

  or(filters: string) {
    // Simple no-op or fallback wrapper
    return this;
  }

  is(column: string, value: any) {
    if (column === 'deleted_at' && value === null) {
      this.filters.push(item => !item.deleted_at);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortCol = column;
    this.sortAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.opData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.opData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  async rpc(fn: string, args?: any) {
    if (fn === 'consume_credit') {
      const subs = JSON.parse(localStorage.getItem("db_subscriptions") || "[]");
      const sub = subs.find((s: any) => s.user_id === mockUser.id);
      if (sub) {
        sub.credits_used = (sub.credits_used || 0) + (args?._amount || 3);
        localStorage.setItem("db_subscriptions", JSON.stringify(subs));
      }
    }
    return { data: null, error: null };
  }

  async execute() {
    const fullTable = JSON.parse(localStorage.getItem(`db_${this.tableName}`) || '[]');
    let matching = [...fullTable];

    // Apply filters
    for (const filter of this.filters) {
      matching = matching.filter(filter);
    }

    // Sort
    if (this.sortCol) {
      const col = this.sortCol;
      const asc = this.sortAsc;
      matching.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    // Limit
    if (this.limitCount !== null) {
      matching = matching.slice(0, this.limitCount);
    }

    let resultData: any = matching;

    if (this.operation === 'insert') {
      const recordsToInsert = Array.isArray(this.opData) ? this.opData : [this.opData];
      const inserted = recordsToInsert.map(item => ({
        id: item.id || 'id_' + Math.random().toString(36).substring(2, 15),
        created_at: item.created_at || new Date().toISOString(),
        ...item
      }));
      fullTable.push(...inserted);
      localStorage.setItem(`db_${this.tableName}`, JSON.stringify(fullTable));
      resultData = inserted;
    } else if (this.operation === 'update') {
      const updatedIds = new Set(matching.map(m => m.id));
      const updated = fullTable.map((item: any) => {
        if (updatedIds.has(item.id)) {
          return { ...item, ...this.opData };
        }
        return item;
      });
      localStorage.setItem(`db_${this.tableName}`, JSON.stringify(updated));
      resultData = matching.map(m => ({ ...m, ...this.opData }));
    } else if (this.operation === 'delete') {
      const deletedIds = new Set(matching.map(m => m.id));
      const remaining = fullTable.filter((item: any) => !deletedIds.has(item.id));
      localStorage.setItem(`db_${this.tableName}`, JSON.stringify(remaining));
      resultData = matching;
    }

    if (this.isSingle) {
      return { data: resultData[0] || null, error: resultData[0] ? null : new Error('Item not found') };
    }
    if (this.isMaybeSingle) {
      return { data: resultData[0] || null, error: null };
    }
    return { data: resultData, error: null };
  }

  // Thenable interface implementation for async/await support
  async then(onfulfilled: any, onrejected?: any) {
    try {
      const result = await this.execute();
      return onfulfilled(result);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }
}

// Mock Supabase Client API
const mockSupabase = {
  auth: {
    async getUser() {
      return { data: { user: mockUser }, error: null };
    },
    async getSession() {
      return { data: { session: mockSession }, error: null };
    },
    onAuthStateChange(callback: any) {
      // Simulate successful login event immediately
      setTimeout(() => {
        callback("SIGNED_IN", mockSession);
      }, 50);
      return {
        data: {
          subscription: {
            unsubscribe() {}
          }
        }
      };
    },
    async signInWithPassword() {
      return { data: { user: mockUser, session: mockSession }, error: null };
    },
    async signUp() {
      return { data: { user: mockUser, session: mockSession }, error: null };
    },
    async signOut() {
      return { error: null };
    }
  },

  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },

  rpc(fn: string, args?: any) {
    return new MockQueryBuilder("").rpc(fn, args);
  },

  channel(name: string) {
    return {
      on(event: string, filter: any, callback: any) {
        return this;
      },
      subscribe() {
        return this;
      }
    };
  },

  removeChannel(channel: any) {},

  functions: {
    async invoke(functionName: string, options?: any) {
      const body = options?.body || {};
      console.log(`[Mock Supabase Function] Invoking ${functionName}:`, body);

      if (functionName === "suno-parse") {
        try {
          const res = await fetch("http://localhost:3000/api/suno/parse", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ sunoUrl: body.sunoUrl })
          });
          const parsedData = await res.json();
          return { data: parsedData, error: null };
        } catch (err) {
          console.error("Local suno-parse fetch failed, falling back to mock:", err);
          return {
            data: {
              success: true,
              title: "Neon Stardust Ride (Mock Fallback)",
              artist: "VibeSync AI",
              audioUrl: "https://cdn1.suno.ai/7b879f5c-21d0-4922-89ea-fa5bdcd372d1.mp3",
              lyricsSnippet: "[Verse 1]\nLost in the stardust rain\nRiding through the neon pain\nSolar winds calling our name\n\n[Chorus]\nFly with me to the night\nUnder the cybernetic light\nEverything's gonna be alright"
            },
            error: null
          };
        }
      }

      if (functionName === "pexels-search") {
        try {
          const res = await fetch("http://localhost:3000/api/pexels/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query: body.query,
              mediaType: body.mediaType || "photos",
              orientation: body.orientation || "portrait",
              perPage: body.perPage || 15,
              page: body.page || 1
            })
          });
          const parsedData = await res.json();
          return { data: parsedData, error: null };
        } catch (err) {
          console.error("Local pexels-search fetch failed, falling back to mock:", err);
          const mockPhotos = Array.from({ length: 9 }).map((_, i) => ({
            id: 1000 + i,
            type: "photo",
            url: `https://picsum.photos/id/${10 + i}/600/900`,
            thumbnail: `https://picsum.photos/id/${10 + i}/200/300`,
            photographer: "Stock Photographer (Fallback)",
            pexels_url: "https://picsum.photos"
          }));
          return {
            data: {
              results: mockPhotos,
              totalResults: 9,
              page: 1,
              perPage: 15
            },
            error: null
          };
        }
      }

      if (functionName === "check-rate-limit") {
        return { data: { allowed: true }, error: null };
      }

      if (functionName === "submit-lyric-video") {
        const projectId = "proj_" + Math.random().toString(36).substring(2, 15);
        const scriptId = "script_" + Math.random().toString(36).substring(2, 15);
        const storyboardId = "sb_" + Math.random().toString(36).substring(2, 15);

        // Project settings from submission
        const newProject = {
          id: projectId,
          user_id: mockUser.id,
          email: mockUser.email,
          title: body.songTitle || "Untitled Music Video",
          artist: body.artist || "Unknown Artist",
          album: body.albumName || "",
          genre: body.genre || "Pop",
          video_style: body.videoStyle || body.template || "cinematic",
          visual_theme: body.visualTheme || "Dark Neon",
          main_character_description: body.mainCharacterDescription || "A young lead character in a vibrant setting",
          reference_character_image: body.referenceImageUrl ?? null,
          additional_character_images: body.additionalCharacterImages ?? [],
          aspect_ratio: body.aspectRatio || "16:9",
          video_model: body.aiModel || "kling",
          image_model: body.aiImageModel || "nano-banana",
          quality: body.quality || "high",
          fps: body.fps || 30,
          duration: body.duration || 60,
          audio_url: body.audioUrl || "https://cdn1.suno.ai/7b879f5c-21d0-4922-89ea-fa5bdcd372d1.mp3",
          audio_name: body.audioFileName || "Suno Track.mp3",
          audio_type: body.inputMode || "suno",
          // Advanced Prompt Instructions
          story_description: body.storyDescription || "",
          character_instructions: body.characterInstructions || "",
          camera_instructions: body.cameraInstructions || "",
          environment_instructions: body.environmentInstructions || "",
          color_grading_instructions: body.colorGradingInstructions || "",
          visual_effects_instructions: body.visualEffectsInstructions || "",
          
          status: "processing",
          current_stage: "audio_analysis",
          stage_progress: 10,
          stage_status: "processing",
          stage_time_estimate: "45s",
          stage_logs: ["[11:00:01] Queuing production pipeline...", "[11:00:02] Initializing Audio Analysis stage..."],
          created_at: new Date().toISOString()
        };

        const projects = JSON.parse(localStorage.getItem("db_projects") || "[]");
        projects.unshift(newProject);
        localStorage.setItem("db_projects", JSON.stringify(projects));

        // Create initial placeholder generated_ad for backwards compatibility gallery
        const newAd = {
          id: projectId, // keep ID in sync
          user_id: mockUser.id,
          email: mockUser.email,
          style_template: body.template || "kinetic",
          aspect_ratio: body.aspectRatio,
          product_image_url: body.referenceImageUrl || "https://placehold.co/1080x1920/0a0a0a/ffffff?text=Lyric+Video",
          generated_image_url: body.referenceImageUrl || null,
          generated_video_url: null,
          status: "processing",
          video_status: "queued",
          video_progress: 5,
          video_duration: body.duration || 60,
          ad_copy: {
            title: body.songTitle || "Untitled Song",
            artist: body.artist || "Unknown Artist",
            lyricsPreview: body.lyrics ? body.lyrics.slice(0, 100) : "",
            fontTheme: body.fontTheme,
            colorPalette: body.colorPalette,
            referenceImageUrl: body.referenceImageUrl ?? null,
            referenceImageName: body.referenceImageName ?? null,
            aiModel: body.aiModel,
            resolution: body.resolution,
            storyboard: []
          },
          created_at: new Date().toISOString()
        };

        const ads = JSON.parse(localStorage.getItem("db_generated_ads") || "[]");
        ads.unshift(newAd);
        localStorage.setItem("db_generated_ads", JSON.stringify(ads));

        // Simulated Pipeline Stages Execution (runs asynchronously in local storage)
        let pipelineStep = 1;
        const pipelineInterval = setInterval(() => {
          const projs = JSON.parse(localStorage.getItem("db_projects") || "[]");
          const curAds = JSON.parse(localStorage.getItem("db_generated_ads") || "[]");
          
          const pIndex = projs.findIndex((p: any) => p.id === projectId);
          const adIndex = curAds.findIndex((a: any) => a.id === projectId);
          
          if (pIndex === -1) {
            clearInterval(pipelineInterval);
            return;
          }

          const project = projs[pIndex];

          if (pipelineStep === 1) {
            // Stage 1: Audio Analysis completes, transition to lyric extraction
            project.current_stage = "lyric_extraction";
            project.stage_progress = 10;
            project.stage_time_estimate = "35s";
            project.stage_logs.push(
              "[11:00:03] Audio file fetched and loaded successfully.",
              "[11:00:04] Analyzing beats, frequencies, and sections...",
              "[11:00:06] Analysis Completed: BPM=128, Energy=High, Mood=Epic Energetic.",
              "[11:00:07] Sections mapped: Intro (0-10s), Verse 1 (10-22s), Chorus (22-35s), Verse 2 (35-50s), Outro (50-60s).",
              "[11:00:08] Starting lyric transcription extraction..."
            );
            
            if (adIndex !== -1) {
              curAds[adIndex].video_progress = 20;
              curAds[adIndex].video_status = "processing";
            }
          } 
          else if (pipelineStep === 2) {
            // Stage 2: Audio Transcription + Lyric Extraction
            project.current_stage = "script_generation";
            project.stage_progress = 10;
            project.stage_time_estimate = "30s";
            project.stage_logs.push(
              "[11:00:09] Starting audio transcription...",
            );

            if (adIndex !== -1) curAds[adIndex].video_progress = 40;

            // Run transcription async — results stored in project for Stage 3
            (async () => {
              const isUploadedAudio = body.inputMode === 'upload' && body.audioFileUrl;
              const hasLyrics = body.lyrics && body.lyrics.trim().length > 30;
              
              if (isUploadedAudio) {
                try {
                   const projs2 = JSON.parse(localStorage.getItem("db_projects") || "[]");
                  const pIdx2 = projs2.findIndex((p: any) => p.id === projectId);
                  if (pIdx2 !== -1) {
                    projs2[pIdx2].stage_logs = [
                      ...(projs2[pIdx2].stage_logs || []),
                      `[11:00:10] Uploaded audio detected: ${body.audioFileName || 'audio file'}`,
                      "[11:00:11] Submitting to ElevenLabs Scribe v2 (via kie.ai) for transcription..."
                    ];
                    localStorage.setItem("db_projects", JSON.stringify(projs2));
                  }

                  const transcRes = await fetch("http://localhost:3000/api/audio/transcribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      audioUrl: body.audioFileUrl,
                      audioFileName: body.audioFileName,
                      // Pass lyrics so server can merge Transcript + Lyrics together
                      lyrics: body.lyrics || ''
                    })
                  });
                  const transcData = await transcRes.json();
                  const transcript = transcData?.transcript || '';
                  const combinedText = transcData?.combinedText || transcript;
                  const transcMode = transcData?.mode || 'unknown';
                  const wordCount = transcData?.wordCount || 0;

                  // Store both raw transcript and combined text for Stage 3
                  const projs3 = JSON.parse(localStorage.getItem("db_projects") || "[]");
                  const pIdx3 = projs3.findIndex((p: any) => p.id === projectId);
                  if (pIdx3 !== -1) {
                    projs3[pIdx3].transcript = transcript;
                    projs3[pIdx3].combinedText = combinedText;
                    const modeLabel = transcMode === 'elevenlabs_scribe_v2' ? 'ElevenLabs Scribe v2'
                                   : transcMode === 'openai_whisper' ? 'OpenAI Whisper-1'
                                   : transcMode === 'simulation' ? 'Simulation' : `unknown (${transcMode})`;
                    projs3[pIdx3].stage_logs = [
                      ...(projs3[pIdx3].stage_logs || []),
                      `[11:00:13] Transcription engine: ${modeLabel}.`,
                      transcript
                        ? `[11:00:14] Success! ${wordCount} words transcribed.${combinedText.includes('SONG LYRICS') ? ' Merged with Suno lyrics.' : ''}`
                        : `[11:00:14] Transcription unavailable — ChatGPT will use lyrics only.`,
                      "[11:00:15] Preparing ChatGPT (GPT-4o) video script generation..."
                    ];
                    localStorage.setItem("db_projects", JSON.stringify(projs3));
                  }
                } catch (err) {
                  console.warn("[Pipeline] Transcription failed:", err);
                }
              } else if (hasLyrics) {
                const projs2 = JSON.parse(localStorage.getItem("db_projects") || "[]");
                const pIdx2 = projs2.findIndex((p: any) => p.id === projectId);
                if (pIdx2 !== -1) {
                  projs2[pIdx2].stage_logs = [
                    ...(projs2[pIdx2].stage_logs || []),
                    `[11:00:10] Suno lyrics loaded: ${body.lyrics.split('\n').filter((l: string) => l.trim()).length} lines extracted.`,
                    "[11:00:11] Preparing ChatGPT video script generation..."
                  ];
                  localStorage.setItem("db_projects", JSON.stringify(projs2));
                }
              }
            })();
          } 
          else if (pipelineStep === 3) {
            // Stage 3: ChatGPT Script Generation via kie.ai
            project.current_stage = "script_enrichment";
            project.stage_progress = 10;
            project.stage_time_estimate = "20s";
            project.stage_logs.push(
              "[11:00:16] Sending lyrics + metadata to ChatGPT (GPT-4o via kie.ai)...",
              "[11:00:17] Generating full music video script with scene breakdowns..."
            );

            // Call ChatGPT script generation + build storyboard async
            (async () => {
              const currentProjs = JSON.parse(localStorage.getItem("db_projects") || "[]");
              const currentProj = currentProjs.find((p: any) => p.id === projectId) || project;
              // Use combinedText (Transcript + Lyrics merged) when available, else raw transcript
              const transcript = currentProj.combinedText || currentProj.transcript || '';

              // Call ChatGPT script generation
              let sceneBreakdowns: any[] = [];
              let scriptConcept = '';
              let scriptNarrative = '';
              
              try {
                const scriptRes = await fetch("http://localhost:3000/api/script/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: project.title,
                    artist: project.artist,
                    genre: project.genre,
                    style: project.video_style,
                    theme: project.visual_theme,
                    characterDescription: project.main_character_description,
                    lyrics: body.lyrics || '',
                    transcript,
                    duration: project.duration,
                    aspectRatio: project.aspect_ratio,
                    cameraInstructions: project.camera_instructions,
                    environmentInstructions: project.environment_instructions,
                    colorGrading: project.color_grading_instructions,
                    storyDescription: project.story_description
                  })
                });

                const scriptData = await scriptRes.json();
                
                if (scriptData.scenes && scriptData.scenes.length > 0) {
                  sceneBreakdowns = scriptData.scenes.map((sc: any) => ({
                    scene: sc.scene_number,
                    duration: sc.duration_seconds,
                    prompt: sc.visual_prompt,
                    camera: sc.camera_direction,
                    environment: sc.environment,
                    lighting: sc.lighting,
                    emotion: sc.emotion,
                    motion: sc.motion
                  }));
                  scriptConcept = scriptData.concept || '';
                  scriptNarrative = scriptData.narrative || '';

                  // Update project logs with ChatGPT result
                  const projs4 = JSON.parse(localStorage.getItem("db_projects") || "[]");
                  const pIdx4 = projs4.findIndex((p: any) => p.id === projectId);
                  if (pIdx4 !== -1) {
                    projs4[pIdx4].stage_logs = [
                      ...(projs4[pIdx4].stage_logs || []),
                      `[11:00:19] ChatGPT script generated (mode: ${scriptData.mode}). ${sceneBreakdowns.length} scenes created.`,
                      `[11:00:20] Concept: ${scriptConcept.substring(0, 100)}`,
                      "[11:00:21] Initiating nano-banana-pro storyboard image generation..."
                    ];
                    localStorage.setItem("db_projects", JSON.stringify(projs4));
                  }
                } else {
                  throw new Error('No scenes in script response');
                }
              } catch (err) {
                console.warn("[Pipeline] ChatGPT script gen failed, using lyric fallback:", err);
                // Fall back to lyric-line based scenes
                const lyricLines = (body.lyrics || '')
                  .split("\n")
                  .map((l: string) => l.trim())
                  .filter((l: string) => l.length > 0 && !l.startsWith("["));
                const fallbackPrompts = lyricLines.length > 0 ? lyricLines.slice(0, 5) : [
                  'A character looking up at the sky, contemplative',
                  'A character walking through streets, lonely',
                  'A character standing in front of glowing lights, energetic',
                  'A close up of eyes reflecting neon billboards, dramatic',
                  'A wide shot of a character standing at a scenic overlook, peaceful'
                ];
                const sceneDur = Math.round((body.duration || 60) / fallbackPrompts.length);
                sceneBreakdowns = fallbackPrompts.map((text: string, idx: number) => ({
                  scene: idx + 1,
                  duration: sceneDur,
                  prompt: `Cinematic ${project.video_style} scene. ${project.visual_theme} palette. ${text}. ${project.camera_instructions || 'Dynamic shot'}.`
                }));
              }

              // Save ChatGPT script to localStorage
              const newScript = {
                id: scriptId,
                project_id: projectId,
                story_concept: scriptConcept || `A journey of discovery matching ${project.title}`,
                visual_narrative: scriptNarrative || project.story_description || 'Dynamic storyboard timeline.',
                character_descriptions: `Protagonist: ${project.main_character_description}`,
                environment_descriptions: project.environment_instructions || 'City streets, scenic views.',
                camera_directions: project.camera_instructions || 'Tracking shots, slow pushes.',
                scene_breakdown: sceneBreakdowns,
                created_at: new Date().toISOString()
              };

              const scripts = JSON.parse(localStorage.getItem("db_scripts") || "[]");
              scripts.unshift(newScript);
              localStorage.setItem("db_scripts", JSON.stringify(scripts));

              const newStoryboard = {
                id: storyboardId,
                project_id: projectId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              const storyboards = JSON.parse(localStorage.getItem("db_storyboards") || "[]");
              storyboards.unshift(newStoryboard);
              localStorage.setItem("db_storyboards", JSON.stringify(storyboards));

              const scenesList: any[] = [];
              const versionsList: any[] = [];
              const sceneImagesList: any[] = [];
              
              let accumulatedTime = 0;
              for (let idx = 0; idx < sceneBreakdowns.length; idx++) {
                const sc = sceneBreakdowns[idx];
                const sceneId = "scene_" + Math.random().toString(36).substring(2, 15);
                const imgId = "img_" + Math.random().toString(36).substring(2, 15);
                
                const startVal = accumulatedTime;
                accumulatedTime += sc.duration;
                const endVal = accumulatedTime;

                // Pexels for reference images (input frame for video generation)
                let realImgUrl = `https://picsum.photos/id/${(10 + idx) % 85}/1920/1080`; // fallback
                try {
                  const searchPrompt = (sc.prompt || "") + " " + project.visual_theme;
                  console.log(`[Pexels Pipeline] Searching reference image for: "${searchPrompt}"`);
                  const res = await fetch("http://localhost:3000/api/pexels/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchPrompt, perPage: 1 })
                  });
                  const pexelsData = await res.json();
                  if (pexelsData.results && pexelsData.results.length > 0) {
                    realImgUrl = pexelsData.results[0].url;
                    console.log(`[Pexels Pipeline] Found reference image: ${realImgUrl}`);
                  }
                } catch (err) {
                  console.warn("[Pexels Pipeline] Reference image search failed, using fallback:", err);
                }

                // Nano Banana Pro via kie.ai — generates the actual storyboard AI visual
                let storyboardImgUrl = realImgUrl; // default to pexels until AI is ready
                (async () => {
                  try {
                    const cinematicPrompt = `Cinematic storyboard frame, ${project.visual_theme || 'dramatic'} style. ${sc.prompt}. ${project.camera_instructions || 'Wide establishing shot'}. Professional film photography, rich depth of field, ${project.color_grading_instructions || 'vibrant color grading'}.`;
                    console.log(`[Kie.ai Pipeline] Generating storyboard image for scene ${idx + 1}...`);
                    const imgRes = await fetch("http://localhost:3000/api/image/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ 
                        prompt: cinematicPrompt,
                        aspectRatio: project.aspect_ratio === '9:16' ? '9:16' : '16:9'
                      })
                    });
                    const imgData = await imgRes.json();
                    const imgTaskId = imgData?.data?.taskId;
                    if (imgTaskId) {
                      // Poll until complete (max 90s)
                      let attempts = 0;
                      while (attempts < 30) {
                        await new Promise(r => setTimeout(r, 3000));
                        attempts++;
                        const statusRes = await fetch(`http://localhost:3000/api/image/status/${imgTaskId}`);
                        const statusData = await statusRes.json();
                        const state = statusData?.data?.state;
                        if (state === 'success') {
                          const parsedUrl = statusData?.data?.parsedImageUrl;
                          const resultJson = statusData?.data?.resultJson;
                          let aiImg = parsedUrl;
                          if (!aiImg && resultJson) {
                            try { aiImg = JSON.parse(resultJson)?.resultUrls?.[0]; } catch {}
                          }
                          if (aiImg) {
                            storyboardImgUrl = aiImg;
                            console.log(`[Kie.ai Pipeline] Scene ${idx + 1} storyboard image ready: ${aiImg.substring(0, 80)}`);
                            // Update this scene's storyboard_image_url in localStorage
                            const lsScenes = JSON.parse(localStorage.getItem("db_storyboard_scenes") || "[]");
                            const scIdx = lsScenes.findIndex((s: any) => s.id === sceneId);
                            if (scIdx !== -1) {
                              lsScenes[scIdx].storyboard_image_url = aiImg;
                              lsScenes[scIdx].start_reference_image = aiImg; // also update the display image
                              localStorage.setItem("db_storyboard_scenes", JSON.stringify(lsScenes));
                            }
                          }
                          break;
                        } else if (state === 'fail') {
                          console.warn(`[Kie.ai Pipeline] Scene ${idx + 1} storyboard image failed`);
                          break;
                        }
                      }
                    }
                  } catch (aiErr) {
                    console.warn(`[Kie.ai Pipeline] Storyboard image gen failed for scene ${idx + 1}:`, aiErr);
                  }
                })();

                const newScene = {
                  id: sceneId,
                  storyboard_id: storyboardId,
                  project_id: projectId,
                  scene_number: sc.scene,
                  start_time: startVal,
                  end_time: endVal,
                  duration: sc.duration,
                  prompt: sc.prompt,
                  start_reference_image: realImgUrl,
                  end_reference_image: realImgUrl,
                  camera_setting: project.camera_instructions || "Dynamic Tracking",
                  motion_setting: "Medium Flow",
                  environment_setting: project.environment_instructions || "Widescreen scenery",
                  lighting_setting: project.color_grading_instructions || "Cinematic color grading",
                  character_setting: project.main_character_description || "Contemplative character",
                  active_image_id: imgId,
                  active_video_id: null,
                  videoUrl: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                const newSceneImg = {
                  id: imgId,
                  scene_id: sceneId,
                  project_id: projectId,
                  image_url: realImgUrl,
                  prompt: sc.prompt,
                  version: 1,
                  created_at: new Date().toISOString()
                };

                const newVersion = {
                  id: "ver_" + Math.random().toString(36).substring(2, 15),
                  scene_id: sceneId,
                  project_id: projectId,
                  version_number: 1,
                  type: "scene_data",
                  data: {
                    prompt: sc.prompt,
                    image_url: realImgUrl,
                    video_url: null,
                    camera_setting: newScene.camera_setting,
                    motion_setting: newScene.motion_setting,
                    environment_setting: newScene.environment_setting,
                    lighting_setting: newScene.lighting_setting,
                    character_setting: newScene.character_setting,
                    start_reference_image: newScene.start_reference_image,
                    end_reference_image: newScene.end_reference_image
                  },
                  created_at: new Date().toISOString()
                };

                scenesList.push(newScene);
                sceneImagesList.push(newSceneImg);
                versionsList.push(newVersion);
              }

              // Save scenes, images, versions to LocalStorage
              const scenes = JSON.parse(localStorage.getItem("db_storyboard_scenes") || "[]");
              scenes.push(...scenesList);
              localStorage.setItem("db_storyboard_scenes", JSON.stringify(scenes));

              const sceneImages = JSON.parse(localStorage.getItem("db_scene_images") || "[]");
              sceneImages.push(...sceneImagesList);
              localStorage.setItem("db_scene_images", JSON.stringify(sceneImages));

              const versions = JSON.parse(localStorage.getItem("db_versions") || "[]");
              versions.push(...versionsList);
              localStorage.setItem("db_versions", JSON.stringify(versions));
            })();

            if (adIndex !== -1) curAds[adIndex].video_progress = 60;
          }
          else if (pipelineStep === 4) {
            // Stage 4: Script Enrichment completes, transition to Storyboard Generation
            project.current_stage = "storyboard_generation";
            project.stage_progress = 10;

            project.stage_time_estimate = "5s";
            project.stage_logs.push(
              "[11:00:17] Enhancing Visual prompts with custom instructions: " + project.story_description + " " + project.camera_instructions,
              "[11:00:18] Enriching wardrobes and expressions for character continuity...",
              "[11:00:19] Script Enrichment Completed. Scene parameters compiled.",
              "[11:00:20] Mapping script scenes to storyboard timeline blocks..."
            );

            // Update Script Enrichment Detail
            const scripts = JSON.parse(localStorage.getItem("db_scripts") || "[]");
            const sIdx = scripts.findIndex((s: any) => s.project_id === projectId);
            if (sIdx !== -1) {
              scripts[sIdx].scene_breakdown = scripts[sIdx].scene_breakdown.map((sc: any) => ({
                ...sc,
                camera: "Dynamic tracking push",
                lighting: "Vibrant high-contrast neon lighting",
                wardrobe: "Dark reflective techwear jacket",
                environment: "Cyberpunk rain-soaked street alleys",
                emotion: "Reflective and contemplative"
              }));
              localStorage.setItem("db_scripts", JSON.stringify(scripts));
            }

            if (adIndex !== -1) curAds[adIndex].video_progress = 80;
          } 
          else if (pipelineStep === 5) {
            // Stage 5: Storyboard Gen completes, finalize project!
            clearInterval(pipelineInterval);
            project.status = "completed";
            project.current_stage = "storyboard_generation";
            project.stage_progress = 100;
            project.stage_status = "completed";
            project.stage_time_estimate = "0s";
            project.stage_logs.push(
              "[11:00:21] Generating scene storyboard frames...",
              "[11:00:22] Layout configured in 2-column widescreen storyboard.",
              "[11:00:23] Persistent Storyboard system generated and autosaved.",
              "[11:00:24] Pipeline complete! Your project storyboard is ready to edit."
            );
            project.completed_at = new Date().toISOString();

            // Retrieve storyboard scenes created in step 3 and update their video URLs to mock videos
            const scenes = JSON.parse(localStorage.getItem("db_storyboard_scenes") || "[]");
            const projectScenes = scenes.filter((s: any) => s.project_id === projectId);
            projectScenes.forEach((s: any, idx: number) => {
              const mockVid = "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c02cba73d47d0078323b6d7e26753811&profile_id=165&oauth2_token_id=57447761";
              s.videoUrl = mockVid;
              s.video_url = mockVid;
              s.updated_at = new Date().toISOString();
            });
            localStorage.setItem("db_storyboard_scenes", JSON.stringify(scenes));

            // Sync complete state to generated_ad record
            if (adIndex !== -1) {
              curAds[adIndex].status = "completed";
              curAds[adIndex].video_status = "idle";
              curAds[adIndex].video_progress = 100;
              curAds[adIndex].completed_at = new Date().toISOString();
              // Format storyboard scenes into legacy storyboard for fallback
              curAds[adIndex].ad_copy.storyboard = projectScenes.map((s: any) => ({
                id: s.id,
                index: s.scene_number,
                prompt: s.prompt,
                duration: s.duration,
                referenceImageUrl: s.start_reference_image,
                referenceImageName: "Consistency Frame Start",
                videoUrl: s.videoUrl,
                status: "completed"
              }));
              localStorage.setItem("db_generated_ads", JSON.stringify(curAds));
            }
          }

          localStorage.setItem("db_projects", JSON.stringify(projs));
          pipelineStep++;
        }, 3000);

        return { data: { success: true, adIds: [projectId] }, error: null };
      }

      return { data: { success: true }, error: null };
    }
  }
};

// Real Supabase client initialization (imported in production)
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://eqiwbtxomiskpekgrsph.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaXdidHhvbWlza3Bla2dyc3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzk4MDEsImV4cCI6MjA3NDkxNTgwMX0.EdsQxbtq9_KLFLv7aFd59zkQV3HOO55IDMn2BmhqD5A";

const realSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const supabase: any = IS_MOCK ? mockSupabase : realSupabase;