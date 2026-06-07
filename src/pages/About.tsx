import { Music2, Zap, Heart, Users } from "lucide-react";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-24 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
            <Music2 className="h-3.5 w-3.5" />
            About SongDoe
          </div>
          <h1 className="text-[2.5rem] sm:text-[4rem] font-tight font-semibold tracking-tight leading-[0.95] mb-6">
            We help artists make<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-400">
              AI Music Videos
            </span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            SongDoe is the #1 AI Music Video Creator — purpose-built for independent artists, producers, and creators who want
            cinematic music videos without a production team, expensive software, or weeks of editing work.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/30">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">Our mission</span>
            <h2 className="text-[1.75rem] sm:text-[2.5rem] font-tight font-semibold mt-2 mb-4 tracking-tight">
              Every song deserves a cinematic music video
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
              Every song tells a story. SongDoe gives artists the world's most powerful AI video tools —
              Kling 3.0, Google Veo 3.1, GPT-4o, and ElevenLabs — in one automated pipeline.
              We believe cinematic music videos shouldn't be a luxury reserved for artists with major label budgets.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Music2, label: "Music videos created", value: "50,000+" },
              { icon: Users, label: "Artists on SongDoe", value: "10,000+" },
              { icon: Zap, label: "Avg generation time", value: "< 5 min" },
              { icon: Heart, label: "Creator satisfaction", value: "98%" },
            ].map((stat, i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border/50 text-center">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-xs uppercase tracking-widest text-primary font-semibold">Our story</span>
          <h2 className="text-[1.75rem] sm:text-[2.5rem] font-tight font-semibold mt-2 mb-6 tracking-tight">
            Built by music fans, for music creators
          </h2>
          <div className="space-y-4 text-muted-foreground text-sm sm:text-base leading-relaxed text-left">
            <p>
              We started SongDoe after watching incredible music go unnoticed because artists couldn't afford
              professional music videos. AI tools like Kling 3.0, Veo 3.1, and GPT-4o had completely
              transformed what was possible — but nobody had built a tool that connected them all into
              one complete music video pipeline.
            </p>
            <p>
              So we built SongDoe: paste a Suno URL or upload your audio, describe your visual style,
              and get a fully rendered cinematic music video in minutes. ElevenLabs transcribes
              your audio. GPT-4o writes the screenplay. Nano Banana Pro builds the storyboard.
              Kling 3.0 or Veo 3.1 renders the final cinematic video clips.
            </p>
            <p>
              Today, SongDoe supports 10,000+ artists and creators publishing music videos on TikTok,
              YouTube, Instagram Reels, Spotify Canvas, and beyond. We're continuously adding new
              AI models, visual styles, and pipeline features to stay at the cutting edge of what's possible.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-[1.75rem] sm:text-[2.5rem] font-tight font-semibold mb-4 tracking-tight">
            Ready to create your music video?
          </h2>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base">
            Join 10,000+ artists creating cinematic AI music videos with SongDoe — powered by Kling 3.0 & Veo 3.1.
          </p>
          <Link to="/create">
            <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12">
              Create AI Music Video — Free
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
