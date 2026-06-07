const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory task store for simulations
const simulatedTasks = {};

// Helper to check if API key is real
function getKieApiKey(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        const key = header.split(' ')[1];
        if (key && key !== 'sk-mock' && key.length > 10) {
            return key;
        }
    }
    return process.env.KIE_API_KEY || null;
}

// Endpoint to verify API key connection status
app.get('/api/status', (req, res) => {
    const hasKey = !!process.env.KIE_API_KEY && process.env.KIE_API_KEY.length > 5;
    res.json({
        connected: hasKey,
        mode: hasKey ? 'production' : 'simulation'
    });
});

// 1. Music Generation Endpoint
app.post('/api/music/generate', async (req, res) => {
    const { prompt, style, title, instrumental } = req.body;
    
    const sunoApiKey = process.env.SUNO_API_KEY;
    const isSunoApiOrg = !!sunoApiKey;
    const apiKey = isSunoApiOrg ? sunoApiKey : getKieApiKey(req);

    if (!apiKey || apiKey === 'sk-mock') {
        console.log('[Simulation] Generating music for prompt:', prompt);
        // Simulate task creation
        const taskId = 'suno_task_' + Math.random().toString(36).substring(2, 15);
        simulatedTasks[taskId] = {
            type: 'music',
            status: 'processing',
            createdAt: Date.now(),
            data: {
                bpm: 125,
                mood: 'Cosmic / Synthpop / Euphoric',
                env: 'Starlit nebulae & spaceship cockpit',
                lyrics: 'Lost in the stardust rain, riding through the neon pain, solar winds calling...',
                audioUrl: 'https://cdn1.suno.ai/7b879f5c-21d0-4922-89ea-fa5bdcd372d1.mp3'
            }
        };
        return res.json({ msg: 'success', data: { taskId, mode: 'simulation' } });
    }

    try {
        const baseUrl = isSunoApiOrg ? 'https://api.sunoapi.org' : 'https://api.kie.ai';
        console.log(`[Suno API] Submitting Suno music request to ${baseUrl}...`);
        const response = await fetch(`${baseUrl}/api/v1/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt || 'A space synthwave beat',
                customMode: true,
                instrumental: instrumental !== false,
                model: 'V4',
                style: style || 'Synthwave',
                title: title || 'Stardust'
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[Suno API Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Music Generation Status
app.get('/api/music/status/:taskId', async (req, res) => {
    const { taskId } = req.params;
    
    const sunoApiKey = process.env.SUNO_API_KEY;
    const isSunoApiOrg = !!sunoApiKey;
    const apiKey = isSunoApiOrg ? sunoApiKey : getKieApiKey(req);

    if (taskId.startsWith('suno_task_')) {
        const task = simulatedTasks[taskId];
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const elapsed = (Date.now() - task.createdAt) / 1000;
        if (elapsed > 8) { // completes in 8 seconds
            task.status = 'success';
        }
        return res.json({
            msg: 'success',
            data: {
                status: task.status === 'success' ? 'success' : 'processing',
                record: task.status === 'success' ? [
                    {
                        audioUrl: task.data.audioUrl,
                        bpm: task.data.bpm,
                        mood: task.data.mood,
                        env: task.data.env,
                        lyrics: task.data.lyrics
                    }
                ] : []
            }
        });
    }

    try {
        const baseUrl = isSunoApiOrg ? 'https://api.sunoapi.org' : 'https://api.kie.ai';
        const response = await fetch(`${baseUrl}/api/v1/generate/record-info?taskId=${taskId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Image Scene Generation Endpoint (Kie.ai Nano Banana Pro)
app.post('/api/image/generate', async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    const apiKey = getKieApiKey(req);

    if (!apiKey) {
        // Simulation fallback with a placeholder image
        console.log('[Simulation] Generating image for prompt:', prompt);
        const taskId = 'img_task_' + Math.random().toString(36).substring(2, 15);
        simulatedTasks[taskId] = {
            type: 'image',
            status: 'processing',
            createdAt: Date.now(),
            data: {
                imageUrl: `https://picsum.photos/seed/${Math.floor(Math.random() * 100)}/1920/1080`
            }
        };
        return res.json({ code: 200, message: 'success', data: { taskId, mode: 'simulation' } });
    }

    try {
        console.log(`[Kie.ai] Submitting nano-banana-pro image generation for prompt: "${prompt?.substring(0, 80)}..."`);
        const payload = {
            model: 'nano-banana-pro',
            input: {
                prompt: prompt || 'A cinematic scene with dramatic lighting and atmospheric depth',
                aspectRatio: aspectRatio || '16:9'
            }
        };
        const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('[Kie.ai Image] Task created:', JSON.stringify(data).substring(0, 200));
        res.json(data);
    } catch (err) {
        console.error('[Kie.ai Image Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// 3b. Image Generation Status / Result
app.get('/api/image/status/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const apiKey = getKieApiKey(req);

    // Simulation mode
    if (taskId.startsWith('img_task_')) {
        const task = simulatedTasks[taskId];
        if (!task) return res.status(404).json({ error: 'Task not found' });
        const elapsed = (Date.now() - task.createdAt) / 1000;
        if (elapsed > 6) task.status = 'success';
        return res.json({
            code: 200,
            message: 'success',
            data: {
                taskId,
                state: task.status === 'success' ? 'success' : 'generating',
                resultJson: task.status === 'success' ? JSON.stringify({ resultUrls: [task.data.imageUrl] }) : null
            }
        });
    }

    if (!apiKey) {
        return res.status(400).json({ error: 'API key required for real task polling' });
    }

    try {
        const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await response.json();
        // Parse resultJson to extract the image URL if completed
        if (data?.data?.resultJson && typeof data.data.resultJson === 'string') {
            try {
                const parsed = JSON.parse(data.data.resultJson);
                data.data.parsedImageUrl = parsed?.resultUrls?.[0] || null;
            } catch {}
        }
        res.json(data);
    } catch (err) {
        console.error('[Kie.ai Image Status Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Video Scene Generation Endpoint (Kling 3.0 / Veo 3.1 via Kie.ai)
app.post('/api/video/generate', async (req, res) => {
    const { prompt, model, aspectRatio, imageUrl } = req.body;
    const apiKey = getKieApiKey(req);

    if (!apiKey) {
        console.log(`[Simulation] Generating video via ${model} for prompt:`, prompt);
        const taskId = 'video_task_' + Math.random().toString(36).substring(2, 15);
        simulatedTasks[taskId] = {
            type: 'video',
            status: 'processing',
            createdAt: Date.now(),
            data: {
                videoUrl: 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c02cba73d47d0078323b6d7e26753811&profile_id=165&oauth2_token_id=57447761'
            }
        };
        return res.json({ code: 200, message: 'success', data: { taskId, mode: 'simulation' } });
    }

    // Determine mode: image-to-video (if imageUrl provided) or text-to-video
    const isVeo = model && model.toLowerCase().includes('veo');
    const hasImage = !!imageUrl;
    
    try {
        let endpoint, payload;
        if (isVeo) {
            // Google Veo 3.1 via kie.ai
            endpoint = 'https://api.kie.ai/api/v1/veo';
            payload = {
                model: 'veo-3.1',
                prompt,
                aspectRatio: aspectRatio || '16:9'
            };
            if (hasImage) payload.imageUrl = imageUrl;
        } else {
            // Kling 3.0 via kie.ai jobs/createTask
            endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
            payload = {
                model: hasImage ? 'kling-image2video' : 'kling-v3',
                input: {
                    prompt,
                    aspectRatio: aspectRatio || '16:9',
                    ...(hasImage ? { imageUrl } : {}),
                    duration: 5,
                    mode: 'standard'
                }
            };
        }

        console.log(`[Kie.ai Video] Submitting to ${isVeo ? 'Veo 3.1' : 'Kling 3.0'} (${hasImage ? 'image2video' : 'text2video'})`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('[Kie.ai Video] Task created:', JSON.stringify(data).substring(0, 200));
        res.json(data);
    } catch (err) {
        console.error('[Kie.ai Video Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Video Generation Status
app.get('/api/video/status/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const apiKey = getKieApiKey(req);

    if (taskId.startsWith('video_task_')) {
        const task = simulatedTasks[taskId];
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const elapsed = (Date.now() - task.createdAt) / 1000;
        if (elapsed > 8) task.status = 'success';
        return res.json({
            code: 200,
            message: 'success',
            data: {
                taskId,
                state: task.status === 'success' ? 'success' : 'generating',
                resultJson: task.status === 'success' ? JSON.stringify({ resultUrls: [task.data.videoUrl] }) : null
            }
        });
    }

    if (!apiKey) {
        return res.status(400).json({ error: 'API key required for real task polling' });
    }

    // Poll kie.ai for status — works for both Kling and Veo task IDs
    const isVeo = taskId.startsWith('veo_') || taskId.includes('veo');
    const url = isVeo 
        ? `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`
        : `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await response.json();
        // Parse resultJson to expose video URL
        if (data?.data?.resultJson && typeof data.data.resultJson === 'string') {
            try {
                const parsed = JSON.parse(data.data.resultJson);
                data.data.parsedVideoUrl = parsed?.resultUrls?.[0] || null;
            } catch {}
        }
        res.json(data);
    } catch (err) {
        console.error('[Kie.ai Video Status Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Merge Endpoint
app.post('/api/video/merge', (req, res) => {
    const { videoUrls, audioUrl } = req.body;
    console.log('[Merge Request] Received urls:', videoUrls, audioUrl);

    if (!videoUrls || videoUrls.length === 0 || !audioUrl) {
        return res.status(400).json({ error: 'Missing videoUrls or audioUrl' });
    }

    // Since downloading files and running FFmpeg requires active server-side storage,
    // we first write a functional simulation. If the files are local/mock, we return a success response immediately.
    const isMock = videoUrls.some(url => url.includes('w3schools') || url.includes('unsplash') || url.includes('picsum'));
    
    if (isMock) {
        setTimeout(() => {
            res.json({
                msg: 'success',
                data: {
                    mergedVideoUrl: videoUrls[0],
                    message: 'Mock merge completed successfully!'
                }
            });
        }, 1500);
        return;
    }

    // Pass-through merge simulator for quick development
    setTimeout(() => {
        res.json({
            msg: 'success',
            data: {
                mergedVideoUrl: videoUrls[0],
                message: 'Merge completed (pass-through simulation)'
            }
        });
    }, 2000);
});

// 6. Suno Link parser scraping endpoint
app.post('/api/suno/parse', async (req, res) => {
    const { sunoUrl } = req.body;
    if (!sunoUrl) {
        return res.status(400).json({ error: 'sunoUrl is required' });
    }

    try {
        console.log(`[Backend Parser] Extracting metadata for: ${sunoUrl}`);
        
        // Resolve short links
        let resolvedUrl = sunoUrl;
        const isShortLink = /suno\.com\/s\/[a-zA-Z0-9]+/.test(sunoUrl);
        if (isShortLink) {
            try {
                const headRes = await fetch(sunoUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; VibeSync/1.0)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    }
                });
                resolvedUrl = headRes.url || sunoUrl;
                console.log(`[Backend Parser] Resolved short link: ${resolvedUrl}`);
            } catch (err) {
                console.warn('[Backend Parser] Short link resolution failed:', err);
            }
        }

        // Fetch Suno HTML
        const fetchResponse = await fetch(resolvedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; VibeSync/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        if (!fetchResponse.ok) {
            console.warn(`[Backend Parser] Failed to fetch Suno page: ${fetchResponse.status}`);
            return res.json({ title: '', artist: '', lyricsSnippet: '', audioUrl: '', success: false });
        }

        const html = await fetchResponse.text();
        let title = '';
        let artist = '';
        let lyricsSnippet = '';
        let audioUrl = '';

        // Try __NEXT_DATA__
        const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (nextDataMatch) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const props = nextData?.props?.pageProps;
                const clip = props?.initialData?.clips?.[0] || props?.clip || props?.song || props?.data?.clips?.[0];
                if (clip) {
                    title = clip.title || clip.display_name || title;
                    artist = clip.artist_name || clip.display_name || artist;
                    const rawLyrics = clip.metadata?.prompt || clip.lyrics || clip.prompt || '';
                    if (rawLyrics) {
                        lyricsSnippet = rawLyrics.slice(0, 1500);
                    }
                    audioUrl = clip.audio_url || clip.stream_url || audioUrl;
                }
            } catch (e) {
                console.warn('[Backend Parser] Next data parse failed:', e);
            }
        }

        // Try og:title
        if (!title) {
            const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
                                 html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
            if (ogTitleMatch) {
                const rawTitle = ogTitleMatch[1].trim();
                const withoutSuno = rawTitle.replace(/\s*[\|–-]\s*Suno.*$/i, '').trim();
                const byMatch = withoutSuno.match(/^(.+?)\s+by\s+(.+)$/i);
                if (byMatch) {
                    title = byMatch[1].trim();
                    artist = byMatch[2].trim();
                } else {
                    title = withoutSuno;
                }
            }
        }

        // Try og:description
        if (!artist) {
            const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
                              html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
            if (descMatch) {
                const byMatch = descMatch[1].match(/by\s+([^,\.]+)/i);
                if (byMatch) artist = byMatch[1].trim();
            }
        }

        // Try application/ld+json
        if (!lyricsSnippet) {
            const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
            for (const match of jsonLdMatches) {
                try {
                    const jsonData = JSON.parse(match[1]);
                    if (jsonData.lyrics || jsonData.description) {
                        lyricsSnippet = (jsonData.lyrics || jsonData.description || '').slice(0, 1500);
                        break;
                    }
                } catch {}
            }
        }

        // Fallback prompt regex
        if (!lyricsSnippet) {
            const lyricsMatch = html.match(/data-lyrics="([^"]+)"/i) ||
                                html.match(/"lyrics"\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
                                html.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            if (lyricsMatch) {
                lyricsSnippet = lyricsMatch[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, ' ')
                    .slice(0, 1500);
            }
        }

        // Studio API call
        if (!lyricsSnippet || !title) {
            const songIdMatch = resolvedUrl.match(/\/song\/([a-f0-9-]{36})/i);
            if (songIdMatch) {
                const songId = songIdMatch[1];
                try {
                    const apiRes = await fetch(`https://studio-api.prod.suno.com/api/feed/v2?ids=${songId}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; VibeSync/1.0)',
                            'Accept': 'application/json',
                        }
                    });
                    if (apiRes.ok) {
                        const apiData = await apiRes.json();
                        const clip = apiData?.clips?.[0] || apiData?.[0];
                        if (clip) {
                            title = title || clip.title || clip.display_name || '';
                            artist = artist || clip.artist_name || '';
                            const rawLyrics = clip.metadata?.prompt || clip.lyrics || '';
                            if (rawLyrics && !lyricsSnippet) {
                                lyricsSnippet = rawLyrics.slice(0, 1500);
                            }
                            audioUrl = audioUrl || clip.audio_url || clip.stream_url || '';
                        }
                    }
                } catch (e) {
                    console.warn('[Backend Parser] Studio feed call failed:', e);
                }
            }
        }

        // Fallback regex for audio URL
        if (!audioUrl) {
            const audioUrlMatch = html.match(/"audio_url"\s*:\s*"([^"]+)"/i) ||
                                  html.match(/"stream_url"\s*:\s*"([^"]+)"/i);
            if (audioUrlMatch) {
                audioUrl = audioUrlMatch[1];
            }
        }

        const success = !!(title || lyricsSnippet || audioUrl);
        console.log(`[Backend Parser] Scrape success: ${success}. Title: "${title}". Audio: "${audioUrl}"`);
        res.json({ title, artist, lyricsSnippet, audioUrl, success });
    } catch (error) {
        console.error('[Backend Parser Error]', error);
        res.json({ title: '', artist: '', lyricsSnippet: '', audioUrl: '', success: false });
    }
});

// 7. Pexels Search proxy endpoint
app.post('/api/pexels/search', async (req, res) => {
    const { query, mediaType = 'photos', orientation = 'portrait', perPage = 15, page = 1 } = req.body;
    
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
        console.warn('[Pexels Proxy] PEXELS_API_KEY is not configured in .env. Returning mockup photos.');
        const mockPhotos = Array.from({ length: 9 }).map((_, i) => ({
            id: 1000 + i,
            type: 'photo',
            url: `https://picsum.photos/id/${10 + i}/600/900`,
            thumbnail: `https://picsum.photos/id/${10 + i}/200/300`,
            photographer: 'Stock Photographer',
            pexels_url: 'https://picsum.photos'
        }));
        return res.json({ results: mockPhotos, totalResults: 9, page: 1, perPage: 15 });
    }

    try {
        const params = new URLSearchParams({
            query: query || 'portrait',
            orientation,
            per_page: String(perPage),
            page: String(page)
        });
        const url = `https://api.pexels.com/v1/search?${params}`;
        
        console.log(`[Pexels Proxy] Searching Pexels: ${url}`);
        const pexelsRes = await fetch(url, {
            headers: { 'Authorization': apiKey }
        });

        if (!pexelsRes.ok) {
            const err = await pexelsRes.text();
            console.error('[Pexels Proxy Error]', err);
            return res.status(pexelsRes.status).json({ error: 'Pexels API request failed' });
        }

        const data = await pexelsRes.json();
        const results = (data.photos ?? []).map(photo => ({
            id: photo.id,
            type: 'photo',
            url: photo.src?.large2x || photo.src?.original,
            thumbnail: photo.src?.medium,
            photographer: photo.photographer,
            pexels_url: photo.url,
            width: photo.width,
            height: photo.height
        }));

        res.json({ results, totalResults: data.total_results || 0, page, perPage });
    } catch (err) {
        console.error('[Pexels Proxy Exception]', err);
        res.status(500).json({ error: err.message });
    }
});


// 8. Audio Transcription — ElevenLabs Scribe v2 via kie.ai (primary) + OpenAI Whisper (fallback)
app.post('/api/audio/transcribe', async (req, res) => {
    const { audioUrl, audioFileName, language = 'en', lyrics = '' } = req.body;
    const kieKey = process.env.KIE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || kieKey; // kie.ai key works as xi-api-key proxy

    if (!audioUrl) {
        return res.status(400).json({ error: 'audioUrl is required' });
    }

    if (!elevenLabsKey && !openAiKey) {
        console.log('[Transcription] No API keys found, returning simulation.');
        return res.json({
            success: true,
            transcript: '',
            combinedText: lyrics || '',
            mode: 'simulation'
        });
    }

    let transcript = '';
    let mode = 'failed';

    // ── Attempt 1: ElevenLabs Scribe v2 via kie.ai ──────────────────────────
    // ElevenLabs accepts cloud_storage_url (no download needed for remote audio)
    if (elevenLabsKey) {
        try {
            console.log(`[Transcription] Trying ElevenLabs Scribe v2 via kie.ai for: ${audioUrl}`);

            // Determine if it's a remote URL or a blob/data URL
            const isRemoteUrl = audioUrl.startsWith('http://') || audioUrl.startsWith('https://');

            let elevenRes;
            if (isRemoteUrl) {
                // Use cloud_storage_url — no download needed, fastest path
                const elFormData = new FormData();
                elFormData.append('model_id', 'scribe_v2');
                elFormData.append('cloud_storage_url', audioUrl);
                if (language !== 'en') elFormData.append('language_code', language);
                elFormData.append('timestamps_granularity', 'word');
                elFormData.append('tag_audio_events', 'false');

                // Try kie.ai ElevenLabs proxy first, then direct ElevenLabs
                const elEndpoints = [
                    { url: 'https://api.kie.ai/api/v1/elevenlabs/v1/speech-to-text', key: kieKey },
                    { url: 'https://api.elevenlabs.io/v1/speech-to-text', key: elevenLabsKey }
                ].filter(ep => ep.key);

                for (const ep of elEndpoints) {
                    try {
                        console.log(`[Transcription] ElevenLabs → ${ep.url}`);
                        const elFormDataCopy = new FormData();
                        elFormDataCopy.append('model_id', 'scribe_v2');
                        elFormDataCopy.append('cloud_storage_url', audioUrl);
                        if (language !== 'en') elFormDataCopy.append('language_code', language);

                        elevenRes = await fetch(ep.url, {
                            method: 'POST',
                            headers: { 'xi-api-key': ep.key },
                            body: elFormDataCopy
                        });
                        if (elevenRes.ok) break;
                        const err = await elevenRes.text();
                        console.warn(`[Transcription] ElevenLabs endpoint failed (${elevenRes.status}): ${err.substring(0, 150)}`);
                        elevenRes = null;
                    } catch (epErr) {
                        console.warn(`[Transcription] ElevenLabs endpoint error:`, epErr.message);
                    }
                }
            } else {
                // Blob/data URL — download first then upload as multipart file
                console.log('[Transcription] Local blob URL detected — downloading for upload...');
                const audioResBlob = await fetch(audioUrl);
                const audioBuffer = await audioResBlob.arrayBuffer();
                const fileName = audioFileName || 'audio.mp3';
                const mimeType = fileName.endsWith('.wav') ? 'audio/wav'
                              : fileName.endsWith('.m4a') ? 'audio/m4a' : 'audio/mpeg';

                const elFormDataFile = new FormData();
                elFormDataFile.append('model_id', 'scribe_v2');
                elFormDataFile.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
                if (language !== 'en') elFormDataFile.append('language_code', language);

                const elEndpoints = [
                    { url: 'https://api.kie.ai/api/v1/elevenlabs/v1/speech-to-text', key: kieKey },
                    { url: 'https://api.elevenlabs.io/v1/speech-to-text', key: elevenLabsKey }
                ].filter(ep => ep.key);

                for (const ep of elEndpoints) {
                    try {
                        console.log(`[Transcription] ElevenLabs file upload → ${ep.url}`);
                        const elFormDataFileCopy = new FormData();
                        elFormDataFileCopy.append('model_id', 'scribe_v2');
                        elFormDataFileCopy.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);

                        elevenRes = await fetch(ep.url, {
                            method: 'POST',
                            headers: { 'xi-api-key': ep.key },
                            body: elFormDataFileCopy
                        });
                        if (elevenRes.ok) break;
                        const err = await elevenRes.text();
                        console.warn(`[Transcription] ElevenLabs file endpoint failed (${elevenRes.status}): ${err.substring(0, 150)}`);
                        elevenRes = null;
                    } catch (epErr) {
                        console.warn(`[Transcription] ElevenLabs file endpoint error:`, epErr.message);
                    }
                }
            }

            if (elevenRes && elevenRes.ok) {
                const elData = await elevenRes.json();
                // ElevenLabs returns { text: '...', language_code: '...', words: [...] }
                transcript = elData?.text || elData?.transcript || '';
                if (transcript) {
                    mode = 'elevenlabs_scribe_v2';
                    console.log(`[Transcription] ElevenLabs Scribe v2 success: ${transcript.length} chars, ${transcript.split(' ').length} words`);
                }
            }
        } catch (elErr) {
            console.warn('[Transcription] ElevenLabs attempt failed:', elErr.message);
        }
    }

    // ── Attempt 2: OpenAI Whisper fallback ──────────────────────────────────
    if (!transcript && openAiKey) {
        try {
            console.log('[Transcription] Falling back to OpenAI Whisper-1...');

            const isRemoteUrl = audioUrl.startsWith('http://') || audioUrl.startsWith('https://');
            let audioBuffer, fileName, mimeType;

            if (isRemoteUrl) {
                const audioFetchRes = await fetch(audioUrl, { headers: { 'User-Agent': 'VibeSync/1.0' } });
                if (!audioFetchRes.ok) throw new Error(`Audio download failed: ${audioFetchRes.status}`);
                audioBuffer = await audioFetchRes.arrayBuffer();
                fileName = audioFileName || 'audio.mp3';
            } else {
                const blobRes = await fetch(audioUrl);
                audioBuffer = await blobRes.arrayBuffer();
                fileName = audioFileName || 'audio.mp3';
            }

            mimeType = fileName.endsWith('.wav') ? 'audio/wav'
                     : fileName.endsWith('.m4a') ? 'audio/m4a' : 'audio/mpeg';

            const whisperForm = new FormData();
            whisperForm.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
            whisperForm.append('model', 'whisper-1');
            whisperForm.append('language', language);
            whisperForm.append('response_format', 'text');

            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAiKey}` },
                body: whisperForm
            });

            if (!whisperRes.ok) {
                const errText = await whisperRes.text();
                throw new Error(`Whisper ${whisperRes.status}: ${errText.substring(0, 200)}`);
            }

            transcript = (await whisperRes.text()).trim();
            mode = 'openai_whisper';
            console.log(`[Transcription] Whisper success: ${transcript.length} chars`);
        } catch (wErr) {
            console.error('[Transcription] Whisper fallback failed:', wErr.message);
        }
    }

    // ── Merge Transcript + Lyrics ────────────────────────────────────────────
    // When both are available: lyrics gives structure/sections, transcript gives spoken content
    let combinedText = transcript;
    if (transcript && lyrics && lyrics.trim().length > 20) {
        combinedText = [
            '=== SONG LYRICS (structured) ===',
            lyrics.trim(),
            '',
            '=== AUDIO TRANSCRIPT (spoken content) ===',
            transcript.trim()
        ].join('\n');
        console.log(`[Transcription] Combined transcript (${transcript.length} chars) + lyrics (${lyrics.length} chars)`);
    } else if (!transcript && lyrics) {
        combinedText = lyrics.trim();
    }

    res.json({
        success: !!transcript,
        transcript: transcript.trim(),
        combinedText,
        mode,
        wordCount: transcript.split(' ').filter(Boolean).length
    });
});

// 9. ChatGPT Script Generation via kie.ai (OpenAI GPT-4o)
// Takes lyrics/transcript + project metadata → structured JSON video script
app.post('/api/script/generate', async (req, res) => {
    const {
        title, artist, genre, style, theme,
        characterDescription, lyrics, transcript,
        duration, aspectRatio,
        cameraInstructions, environmentInstructions,
        colorGrading, storyDescription
    } = req.body;

    const kieKey = process.env.KIE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // Determine number of scenes
    const totalDuration = Number(duration) || 60;
    const sceneCount = Math.max(3, Math.min(8, Math.ceil(totalDuration / 10)));
    const sceneDuration = Math.round(totalDuration / sceneCount);

    // Build the source text — merge transcript + lyrics when both present
    // Lyrics provides song structure/sections, transcript provides raw spoken content
    let sourceText;
    const hasTranscript = transcript && transcript.length > 50;
    const hasLyrics = lyrics && lyrics.trim().length > 20;

    if (hasTranscript && hasLyrics) {
        // Both available: send labeled sections to GPT-4o for richer scene generation
        sourceText = [
            '=== SONG LYRICS (with structure/sections) ===',
            lyrics.trim(),
            '',
            '=== AUDIO TRANSCRIPT (spoken words from uploaded file) ===',
            transcript.trim()
        ].join('\n');
        console.log(`[Script Gen] Using combined Transcript (${transcript.length}c) + Lyrics (${lyrics.length}c)`);
    } else if (hasTranscript) {
        sourceText = transcript.trim();
        console.log(`[Script Gen] Using transcript only (${transcript.length} chars)`);
    } else if (hasLyrics) {
        sourceText = lyrics.trim();
        console.log(`[Script Gen] Using lyrics only (${lyrics.length} chars)`);
    } else {
        sourceText = `A music video for "${title}" by ${artist}.`;
        console.log('[Script Gen] No lyrics or transcript — using title/artist fallback');
    }

    if (!openAiKey && !kieKey) {
        // Intelligent local fallback — generate script from lyrics/metadata
        console.log('[Script Gen] No API key — generating local script from lyrics.');
        const scenes = generateLocalScript({ title, artist, genre, style, theme, characterDescription, sourceText, sceneCount, sceneDuration, aspectRatio, cameraInstructions, environmentInstructions, colorGrading, storyDescription });
        return res.json({ success: true, mode: 'local', scenes, concept: `A cinematic ${style} music video for "${title}" by ${artist}`, narrative: storyDescription || `Dynamic visual progression through ${sceneCount} scenes.` });
    }

    // Build system prompt for GPT-4o
    const systemPrompt = `You are a professional AI music video director and cinematographer. 
Your task is to create a detailed, structured music video script as a JSON array of scenes.
Each scene must be a JSON object with these exact fields:
- scene_number: integer (1 to N)
- duration_seconds: integer
- visual_prompt: string (rich, detailed cinematic description for AI image generation — include lighting, mood, color, environment, character action, camera angle)
- camera_direction: string (specific cinematography instruction)
- environment: string (location/setting description)
- lighting: string (lighting setup)
- emotion: string (emotional tone)
- motion: string (character/camera motion)

Return ONLY a valid JSON object with this structure:
{
  "concept": "one-sentence overall concept",
  "narrative": "2-3 sentence visual narrative description",
  "scenes": [ ... array of N scene objects ... ]
}`;

    const userPrompt = `Create a ${sceneCount}-scene music video script for:
Title: "${title || 'Unknown'}"
Artist: "${artist || 'Unknown'}"
Genre: ${genre || 'Pop'}
Visual Style: ${style || 'Cinematic'}
Theme/Palette: ${theme || 'Dark & Neon'}
Main Character: ${characterDescription || 'A dynamic performer'}
Aspect Ratio: ${aspectRatio || '16:9'}
Total Duration: ${totalDuration}s (${sceneDuration}s per scene)
Camera Style: ${cameraInstructions || 'Dynamic tracking shots, slow pushes'}
Environment: ${environmentInstructions || 'Urban cityscape, studio, outdoor scenic'}
Color Grading: ${colorGrading || 'Cinematic vibrant'}
Story Direction: ${storyDescription || 'Emotional journey matching the music'}

Lyrics / Transcript:
${sourceText.substring(0, 2000)}

Generate exactly ${sceneCount} scenes. Each scene's visual_prompt must be rich enough to generate a stunning AI storyboard image.`;

    try {
        // Try kie.ai's OpenAI-compatible LLM proxy first, then fall back to direct OpenAI
        const endpoints = [
            openAiKey ? { url: 'https://api.openai.com/v1/chat/completions', key: openAiKey } : null,
            kieKey ? { url: 'https://api.kie.ai/api/v1/chat/completions', key: kieKey } : null,
        ].filter(Boolean);

        let scriptData = null;
        let lastError = null;

        for (const ep of endpoints) {
            try {
                console.log(`[Script Gen] Calling GPT-4o at ${ep.url}...`);
                const chatRes = await fetch(ep.url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${ep.key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.8,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!chatRes.ok) {
                    const errText = await chatRes.text();
                    throw new Error(`LLM API ${chatRes.status}: ${errText.substring(0, 200)}`);
                }

                const chatData = await chatRes.json();
                const content = chatData?.choices?.[0]?.message?.content;
                if (!content) throw new Error('Empty response from LLM');

                scriptData = JSON.parse(content);
                console.log(`[Script Gen] GPT-4o script generated: ${scriptData.scenes?.length} scenes`);
                break;
            } catch (epErr) {
                console.warn(`[Script Gen] Endpoint ${ep.url} failed:`, epErr.message);
                lastError = epErr;
            }
        }

        if (!scriptData) {
            // All API attempts failed — use local fallback
            console.log('[Script Gen] All API attempts failed, using local fallback');
            const scenes = generateLocalScript({ title, artist, genre, style, theme, characterDescription, sourceText, sceneCount, sceneDuration, aspectRatio, cameraInstructions, environmentInstructions, colorGrading, storyDescription });
            return res.json({ success: true, mode: 'local_fallback', scenes, concept: `A cinematic ${style} music video for "${title}"`, narrative: storyDescription || '' });
        }

        res.json({ success: true, mode: 'gpt4o', ...scriptData });

    } catch (err) {
        console.error('[Script Gen Error]', err);
        const scenes = generateLocalScript({ title, artist, genre, style, theme, characterDescription, sourceText, sceneCount, sceneDuration, aspectRatio, cameraInstructions, environmentInstructions, colorGrading, storyDescription });
        res.json({ success: true, mode: 'error_fallback', scenes, concept: `${title} music video`, narrative: '' });
    }
});

// Helper: local scene script generation from lyrics when no LLM API is available
function generateLocalScript({ title, artist, genre, style, theme, characterDescription, sourceText, sceneCount, sceneDuration, aspectRatio, cameraInstructions, environmentInstructions, colorGrading, storyDescription }) {
    const lyricLines = sourceText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10 && !l.startsWith('[') && !l.startsWith('('));

    const defaultLines = [
        'A character stands at dawn looking at the horizon with determination',
        'Close-up of expressive eyes reflecting neon city lights',
        'Walking through rain-soaked streets with purpose',
        'An emotional climax moment with dramatic lighting',
        'A contemplative pause, wind in hair, wide open landscape',
        'Rising action, energetic movement in vibrant surroundings',
        'Final triumphant pose against a cinematic backdrop'
    ];

    const sources = lyricLines.length >= sceneCount ? lyricLines : [...lyricLines, ...defaultLines];

    return Array.from({ length: sceneCount }, (_, i) => {
        const lyricRef = sources[i % sources.length] || `Scene ${i + 1}`;
        return {
            scene_number: i + 1,
            duration_seconds: sceneDuration,
            visual_prompt: `Cinematic ${style} music video scene. ${theme} color palette. ${characterDescription || 'A performer'}. Scene: ${lyricRef}. ${cameraInstructions || 'Dynamic tracking shot'}. ${colorGrading || 'Cinematic color grading'}. ${environmentInstructions || 'Atmospheric environment'}. Professional film quality, ${aspectRatio} aspect ratio.`,
            camera_direction: cameraInstructions || (i % 3 === 0 ? 'Wide establishing shot, slow push in' : i % 3 === 1 ? 'Close-up with shallow depth of field' : 'Dynamic tracking shot'),
            environment: environmentInstructions || (i % 2 === 0 ? 'Urban night cityscape with neon lights' : 'Dramatic outdoor scenic landscape'),
            lighting: colorGrading || (i % 2 === 0 ? 'High contrast neon rim lighting' : 'Golden hour cinematic glow'),
            emotion: i < sceneCount / 2 ? 'Building anticipation' : 'Peak emotional intensity',
            motion: i % 2 === 0 ? 'Slow deliberate movement' : 'Dynamic energetic motion'
        };
    });
}

app.listen(PORT, () => {

    console.log(`VibeSync AI Backend Server running on http://localhost:${PORT}`);
});
