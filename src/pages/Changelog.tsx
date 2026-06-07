import { Sparkles, Wrench, Zap, Music2 } from "lucide-react";
import Footer from "@/components/Footer";

const entries = [
  {
    version: "1.4.0",
    date: "March 2026",
    badge: "New",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    icon: Sparkles,
    changes: [
      { type: "feature", text: "Pexels background video picker — choose a real video background for any AI music video" },
      { type: "feature", text: "Background blur & opacity controls in style options" },
      { type: "improvement", text: "Suno link parser now supports private song fallback with clearer error messaging" },
      { type: "fix", text: "Fixed email notifications not delivering after edge function bundling issue" },
    ],
  },
  {
    version: "1.3.0",
    date: "February 2026",
    badge: "New",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    icon: Music2,
    changes: [
      { type: "feature", text: "Lyric video generator launched — 6 templates (Kinetic, Minimal, Neon, Cinematic, Waveform, Karaoke)" },
      { type: "feature", text: "Suno link auto-parser: paste a Suno URL and get title, artist & lyrics instantly" },
      { type: "feature", text: "Multi-format export: 9:16, 1:1, and 16:9 aspect ratios" },
      { type: "feature", text: "Library page with video playback, download, and delete" },
    ],
  },
  {
    version: "1.2.0",
    date: "January 2026",
    badge: "Improvement",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    icon: Zap,
    changes: [
      { type: "feature", text: "Weekly activity widget on the dashboard" },
      { type: "feature", text: "Trash bin with 30-day auto-deletion" },
      { type: "improvement", text: "Subscription plans dialog redesigned with clearer credit breakdown" },
      { type: "improvement", text: "Email verification banner now dismissible" },
    ],
  },
  {
    version: "1.1.0",
    date: "December 2025",
    badge: "Improvement",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    icon: Wrench,
    changes: [
      { type: "feature", text: "Push notification support for video completion alerts" },
      { type: "feature", text: "Session management — view and revoke active sessions from Account" },
      { type: "feature", text: "Admin panel with user, subscription, and video generation management" },
      { type: "fix", text: "Fixed rate limiting not resetting correctly after successful login" },
    ],
  },
  {
    version: "1.0.0",
    date: "November 2025",
    badge: "Launch",
    badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: Sparkles,
    changes: [
      { type: "feature", text: "Initial launch of SongDoe" },
      { type: "feature", text: "Email & Google OAuth authentication" },
      { type: "feature", text: "Subscription management via Stripe" },
      { type: "feature", text: "UGC ad image generation (legacy)" },
    ],
  },
];

const typeLabel: Record<string, { label: string; color: string }> = {
  feature:     { label: "New",         color: "text-primary" },
  improvement: { label: "Improved",    color: "text-violet-400" },
  fix:         { label: "Fix",         color: "text-yellow-400" },
};

const Changelog = () => {
  return (
    <div className="min-h-screen bg-background">
      <section className="pt-24 sm:pt-36 pb-10 sm:pb-16 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Changelog
          </div>
          <h1 className="text-[2.5rem] sm:text-[3.5rem] font-tight font-semibold tracking-tight mb-4">
            What's new
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Every update, improvement, and fix to SongDoe — newest first.
          </p>
        </div>
      </section>

      <section className="pb-20 sm:pb-32 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative pl-6 border-l border-border/50 space-y-12">
            {entries.map((entry, i) => (
              <div key={i} className="relative">
                {/* dot */}
                <div className="absolute -left-[1.625rem] top-1.5 w-4 h-4 rounded-full bg-background border-2 border-primary/50 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>

                <div className="mb-3 flex items-center gap-3 flex-wrap">
                  <span className="text-base font-semibold">v{entry.version}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${entry.badgeColor}`}>
                    {entry.badge}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>

                <ul className="space-y-2.5">
                  {entry.changes.map((change, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <span className={`shrink-0 text-xs font-semibold mt-0.5 w-16 ${typeLabel[change.type].color}`}>
                        {typeLabel[change.type].label}
                      </span>
                      <span className="text-muted-foreground leading-relaxed">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Changelog;

