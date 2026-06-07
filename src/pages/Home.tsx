import { ArrowRight, ChevronDown, Music2, Zap, Download, Film, Mic, Sparkles, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

// Lyric video phone screenshots
import preview1 from "@/assets/lyric-video-preview-1.jpg";
import preview2 from "@/assets/lyric-video-preview-2.jpg";
import preview3 from "@/assets/lyric-video-preview-3.jpg";
import preview4 from "@/assets/lyric-video-preview-4.jpg";
import preview5 from "@/assets/lyric-video-preview-5.jpg";
import preview6 from "@/assets/lyric-video-preview-6.jpg";

const ALL_SCREENS = [preview1, preview2, preview3, preview4, preview5, preview6];
const CAROUSEL_ITEMS = [...ALL_SCREENS, ...ALL_SCREENS, ...ALL_SCREENS];

const VIDEO_STYLES = [
  { name: "Cinematic",   desc: "Epic widescreen cinematography",   img: preview4 },
  { name: "Neon Club",   desc: "Cyberpunk glowing visuals",        img: preview1 },
  { name: "Dreamscape",  desc: "Surreal fantasy landscapes",       img: preview3 },
  { name: "Urban Grit",  desc: "Street-level raw aesthetic",       img: preview2 },
  { name: "Abstract",    desc: "Flowing shapes & motion art",      img: preview5 },
  { name: "Lyric Focus", desc: "Word-by-word cinematic text",      img: preview6 },
];

const TESTIMONIALS = [
  {
    name: "Alex Rivera",
    handle: "@alexbeats",
    role: "Lo-fi Beat Producer",
    quote: "I used to spend weeks syncing visuals to every drop and transition. SongDoe builds a complete cinematic storyboard in minutes and my music videos look like I spent a fortune on a video production team."
  },
  {
    name: "Mina Kwon",
    handle: "@minakwon_music",
    role: "TikTok Music Creator",
    quote: "Short-form video promotion used to feel rushed and repetitive. With SongDoe's AI music video creator, every TikTok and Reel looks professionally made without extra effort."
  },
  {
    name: "Jayden Cole",
    handle: "@jaydencole",
    role: "Indie Electronic Artist",
    quote: "The AI finds the strongest visual moments in my tracks and turns them into genuinely stunning music videos. My YouTube engagement nearly doubled after using SongDoe."
  },
  {
    name: "Sofia Martinez",
    handle: "@sofiamusic",
    role: "Music Video Freelancer",
    quote: "Before SongDoe, producing music videos for clients took weeks. Now I generate multiple high-quality visual concepts in one afternoon and spend more time on creative direction."
  },
  {
    name: "Marcus Lee",
    handle: "@marcusbeats",
    role: "Independent Hip-Hop Artist",
    quote: "Marketing new releases used to overwhelm me. With SongDoe I create promo clips, cinematic visuals, and Shorts — all from the same song in one workflow. Game changer."
  },
  {
    name: "Lena Fischer",
    handle: "@lenaelectro",
    role: "Electronic DJ & Producer",
    quote: "Timing matters when releasing music. SongDoe lets me publish promotional music video clips within hours of finishing a track so I never miss the momentum window."
  },
];

// AI engine badge data
const AI_ENGINES = [
  { name: "Kling 3.0",     color: "from-blue-600 to-blue-400",    icon: "🎬" },
  { name: "Veo 3.1",       color: "from-purple-600 to-violet-400", icon: "🎥" },
  { name: "GPT-4o",        color: "from-green-600 to-emerald-400", icon: "✍️" },
  { name: "ElevenLabs",    color: "from-orange-600 to-amber-400",  icon: "🎙️" },
  { name: "Nano Banana",   color: "from-yellow-600 to-yellow-400", icon: "🖼️" },
];

const Home = () => {
  return (
    <div className="scroll-snap-container">

      {/* ─── Hero Section ─── */}
      <section className="scroll-snap-section relative h-screen flex items-center justify-center overflow-hidden">

        {/* Auto-scrolling background carousel */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div
            className="flex gap-4 absolute top-0 left-0 h-full"
            style={{
              animation: "carouselSlide 40s linear infinite",
              width: `${CAROUSEL_ITEMS.length * 220}px`,
            }}
          >
            {CAROUSEL_ITEMS.map((src, i) => (
              <div key={i} className="h-full flex-shrink-0" style={{ width: "200px" }}>
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl opacity-30"
                  style={{
                    marginTop: i % 2 === 0 ? "0" : "60px",
                    height: i % 2 === 0 ? "100%" : "calc(100% - 60px)",
                  }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background)/0.55) 30%, hsl(var(--background)/0.55) 70%, hsl(var(--background)) 100%)" }}
        />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)/0.7) 0%, transparent 20%, transparent 80%, hsl(var(--background)/0.9) 100%)" }}
        />

        {/* Colour orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-primary/12 blur-[140px] animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-violet-600/12 blur-[100px] animate-[pulse_8s_ease-in-out_infinite_2s]" />
        </div>

        {/* Hero content */}
        <div className="relative z-20 text-center px-4 sm:px-6 max-w-5xl mx-auto">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            #1 AI Music Video Creator — Kling 3.0 · Veo 3.1 · GPT-4o
          </div>

          {/* H1 */}
          <h1 className="text-[2.6rem] sm:text-[4.2rem] md:text-[5.8rem] font-tight leading-[0.92] mb-6 sm:mb-8 tracking-[-0.03em] font-bold">
            Your Song.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-primary">
              A Cinematic
            </span>
            <br />
            Music Video.
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
            Paste a <strong className="text-foreground">Suno link</strong> or upload your audio — our AI writes the script,
            generates storyboard scenes, and renders a cinematic music video with{" "}
            <strong className="text-foreground">Kling 3.0</strong> &{" "}
            <strong className="text-foreground">Google Veo 3.1</strong>. Done in minutes.
          </p>

          {/* AI engine badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {AI_ENGINES.map(engine => (
              <span key={engine.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <span>{engine.icon}</span>
                {engine.name}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-16 sm:mb-20">
            <Link to="/create">
              <Button
                id="hero-cta-create"
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-13 text-base gap-2 shadow-[0_0_40px_hsl(var(--primary)/0.45)] hover:shadow-[0_0_60px_hsl(var(--primary)/0.55)] transition-all"
              >
                <Play className="h-4 w-4 fill-current" />
                Create AI Music Video — Free
              </Button>
            </Link>
            <Link to="/pricing">
              <Button
                id="hero-cta-pricing"
                size="lg"
                variant="outline"
                className="rounded-full h-13 px-8 text-base border-border/50 hover:border-primary/40"
              >
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span><strong className="text-foreground">10,000+</strong> artists use SongDoe</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-400 text-sm">★</span>)}
              <span className="text-sm text-muted-foreground ml-1.5">4.9/5 rating</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span>No editing skills needed</span>
            </div>
          </div>

          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            aria-label="Learn more"
          >
            <span>See how it works</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </button>
        </div>
      </section>

      {/* Mobile Sticky CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border p-4">
        <Link to="/create" className="block w-full">
          <Button size="lg" className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base h-12 gap-2">
            <Play className="h-4 w-4 fill-current" />
            Create AI Music Video — Free
          </Button>
        </Link>
      </div>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">How It Works</span>
            <h2 className="text-[2rem] sm:text-[3rem] font-tight font-bold mt-2 mb-3 tracking-tight">
              From Song to Cinematic Video in 3 Steps
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto font-light">
              The most powerful AI music video pipeline ever assembled — automated from start to finish
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {[
              {
                step: "01", icon: Mic, title: "Add Your Song",
                desc: "Paste a Suno URL for instant lyrics extraction, or upload any audio file (MP3, WAV, M4A). ElevenLabs Scribe v2 automatically transcribes your audio with near-perfect accuracy.",
                tag: "ElevenLabs Scribe v2"
              },
              {
                step: "02", icon: Film, title: "AI Writes Your Video Script",
                desc: "GPT-4o analyzes your lyrics and audio transcript to write a full cinematic screenplay — complete with scene descriptions, visual direction, mood, and character notes for each moment of your song.",
                tag: "GPT-4o"
              },
              {
                step: "03", icon: Sparkles, title: "AI Renders Your Music Video",
                desc: "Nano Banana Pro generates storyboard images, then Kling 3.0 or Veo 3.1 renders stunning video clips for each scene — synced, edited, and ready to download and publish anywhere.",
                tag: "Kling 3.0 · Veo 3.1"
              },
            ].map((item, i) => (
              <div key={i} className="relative p-6 sm:p-7 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                <div className="text-5xl font-black text-primary/10 mb-4 select-none">{item.step}</div>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{item.desc}</p>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/8 border border-primary/20 text-[10px] font-semibold text-primary uppercase tracking-wide">
                  {item.tag}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/create">
              <Button id="how-it-works-cta" size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 text-base gap-2">
                Start Creating Now <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Video Styles / Templates ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">Visual Styles</span>
            <h2 className="text-[1.75rem] sm:text-[2.75rem] font-tight mb-3 leading-tight tracking-tight font-bold mt-2">
              6 Cinematic Music Video Styles
            </h2>
            <p className="text-muted-foreground text-[15px] sm:text-[17px] font-light">
              From dreamy abstract visuals to gritty urban scenes — your song, your aesthetic
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            {VIDEO_STYLES.map((style, i) => (
              <Link
                key={i}
                to="/create"
                className="aspect-[9/14] rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-2xl group cursor-pointer hover:scale-[1.02] transition-transform duration-300 block"
                aria-label={`Create ${style.name} AI music video`}
              >
                <img
                  src={style.img}
                  alt={`${style.name} AI music video style`}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="text-white font-semibold text-sm sm:text-base block">{style.name}</span>
                  <span className="text-white/60 text-xs">{style.desc}</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary/90 text-primary-foreground rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-1.5">
                    <Play className="h-3 w-3 fill-current" /> Create This Style
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why SongDoe — Features ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">Why SongDoe</span>
            <h2 className="text-[1.75rem] sm:text-[2.75rem] font-tight mb-3 leading-tight tracking-tight font-bold mt-2">
              The Only AI Music Video Creator You Need
            </h2>
            <p className="text-muted-foreground text-[15px] sm:text-[17px] max-w-2xl mx-auto font-light leading-relaxed">
              While other tools make you stitch together multiple AI apps, SongDoe gives you a complete, automated pipeline — from raw audio to published music video.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Mic,
                title: "Audio → Script in Seconds",
                desc: "ElevenLabs Scribe v2 transcribes your full audio with 99% accuracy. Combined with your lyrics, GPT-4o writes a full cinematic video screenplay — scene by scene, beat by beat."
              },
              {
                icon: Film,
                title: "Kling 3.0 & Veo 3.1 Videos",
                desc: "Access the world's two most powerful AI video engines. Kling 3.0 delivers cinematic motion and character consistency. Veo 3.1 creates photorealistic environments and breathtaking landscapes."
              },
              {
                icon: Music2,
                title: "Suno & Custom Audio",
                desc: "Paste any Suno URL for instant song import with automatic lyrics. Or upload your own MP3, WAV, M4A, or FLAC audio file. Both inputs flow into the same powerful AI pipeline."
              },
              {
                icon: Sparkles,
                title: "AI Storyboard Generator",
                desc: "Nano Banana Pro generates scene-by-scene storyboard images from the GPT-4o script. Each image is tailored to your song's mood, genre, and visual style before video rendering begins."
              },
              {
                icon: Download,
                title: "All Formats, All Platforms",
                desc: "Download your music video in 9:16 for TikTok & Reels, 16:9 for YouTube, 1:1 for Instagram feed, or 4:5 portrait. Every format is render-ready with no quality loss."
              },
              {
                icon: Zap,
                title: "No Skills. Real Results.",
                desc: "You don't need video editing experience, a production team, or an expensive studio. SongDoe's AI pipeline handles cinematography, transitions, timing, and visual direction automatically."
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">Loved by Creators</span>
            <h2 className="text-[1.75rem] sm:text-[2.75rem] font-tight mb-3 leading-tight tracking-tight font-bold mt-2">
              Artists Are Making Real Music Videos
            </h2>
            <p className="text-muted-foreground text-[15px] sm:text-[17px] font-light">
              Join thousands of artists, producers, and creators who use SongDoe to launch faster
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/20 transition-colors flex flex-col gap-4">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400 text-sm">★</span>)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Competitor Comparison ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">SongDoe vs The Rest</span>
            <h2 className="text-[1.75rem] sm:text-[2.75rem] font-tight mb-3 leading-tight tracking-tight font-bold mt-2">
              Built Exclusively for AI Music Videos
            </h2>
            <p className="text-muted-foreground text-[15px] sm:text-[17px] max-w-2xl mx-auto font-light">
              Generic AI tools make you duct-tape 5 apps together. SongDoe is one complete pipeline, made only for music video creators.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4">
                    <span className="font-bold text-primary">SongDoe</span>
                  </th>
                  <th className="text-center p-4 text-muted-foreground">Sondo.ai</th>
                  <th className="text-center p-4 text-muted-foreground">OpenArt</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Purpose-built for Music Videos", true, true, false],
                  ["Kling 3.0 Video Engine", true, false, true],
                  ["Google Veo 3.1 Video Engine", true, false, true],
                  ["GPT-4o Video Script Writing", true, false, false],
                  ["ElevenLabs Audio Transcription", true, false, false],
                  ["Suno URL Import", true, false, false],
                  ["AI Storyboard Generator", true, false, true],
                  ["Custom Audio Upload (MP3/WAV/M4A)", true, true, false],
                  ["End-to-End Automated Pipeline", true, false, false],
                  ["Multi-format Export (9:16, 16:9, 1:1)", true, true, true],
                ].map(([feature, songdoe, sondo, openart], i) => (
                  <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}>
                    <td className="p-4 font-medium">{feature as string}</td>
                    <td className="p-4 text-center">
                      {songdoe ? <span className="text-green-400 font-bold text-base">✓</span> : <span className="text-muted-foreground/40">–</span>}
                    </td>
                    <td className="p-4 text-center">
                      {sondo ? <span className="text-muted-foreground font-bold">✓</span> : <span className="text-muted-foreground/40">–</span>}
                    </td>
                    <td className="p-4 text-center">
                      {openart ? <span className="text-muted-foreground font-bold">✓</span> : <span className="text-muted-foreground/40">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center bg-background py-2 sm:py-0">
        <FAQ />
      </section>

      {/* ─── Final CTA ─── */}
      <section className="scroll-snap-section sm:min-h-screen flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 bg-background pb-16 sm:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Free to start · No credit card needed
          </div>
          <h2 className="text-[2rem] sm:text-[3.2rem] font-tight mb-4 sm:mb-6 tracking-tight font-bold">
            Your Music Deserves a<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-primary">
              Cinematic Music Video
            </span>
          </h2>
          <p className="text-[16px] sm:text-[18px] text-muted-foreground mb-8 sm:mb-10 font-light px-4">
            Join 10,000+ artists creating stunning AI music videos with SongDoe. Powered by Kling 3.0, Google Veo 3.1, and GPT-4o.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link to="/create" className="hidden sm:inline-block">
              <Button
                id="final-cta-create"
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-10 h-14 text-base shadow-[0_0_50px_hsl(var(--primary)/0.4)] gap-2"
              >
                <Play className="h-5 w-5 fill-current" />
                Create AI Music Video — Free
              </Button>
            </Link>
            <Link to="/pricing">
              <Button id="final-cta-pricing" size="lg" variant="outline" className="rounded-full h-14 px-8 text-base border-border/50 hover:border-primary/40">
                View Plans & Pricing
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Trusted by artists on TikTok · YouTube · Instagram Reels · Spotify Canvas
          </p>
        </div>
      </section>

      <Footer />

      {/* Carousel keyframe injection */}
      <style>{`
        @keyframes carouselSlide {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
};

export default Home;
