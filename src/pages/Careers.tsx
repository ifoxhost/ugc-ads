import { ArrowRight, MapPin, Clock, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

const OPENINGS = [
  {
    title: "Senior Full-Stack Engineer",
    team: "Engineering",
    location: "Remote",
    type: "Full-time",
    desc: "Build and scale the core rendering pipeline and user-facing product. Strong React + Node.js background preferred.",
  },
  {
    title: "AI / ML Engineer",
    team: "AI",
    location: "Remote",
    type: "Full-time",
    desc: "Improve beat-sync, lyric segmentation, and style-transfer models that power our video generation engine.",
  },
  {
    title: "Product Designer",
    team: "Design",
    location: "Remote",
    type: "Full-time",
    desc: "Own the end-to-end design of the creator experience — from onboarding to video export.",
  },
  {
    title: "Growth Marketer",
    team: "Marketing",
    location: "Remote",
    type: "Full-time",
    desc: "Drive artist acquisition across TikTok, YouTube, and music communities. SEO & paid-social experience a plus.",
  },
];

const VALUES = [
  { title: "Makers first", desc: "We build for artists and creators. Every decision starts with 'does this help someone make better music content?'" },
  { title: "Ship fast, learn faster", desc: "We iterate quickly, ship early, and fix what doesn't work. Progress over perfection." },
  { title: "Remote by default", desc: "Our team is distributed across the globe. Async communication, flexible hours, outcome-focused." },
  { title: "Transparent & direct", desc: "We say what we mean. No politics, no layers. Everyone has a voice and a seat at the table." },
];

const Careers = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <span className="text-xs uppercase tracking-widest text-primary font-semibold">Careers</span>
        <h1 className="text-[2.5rem] sm:text-[4rem] font-semibold tracking-tight mt-3 mb-5 leading-tight">
          Help artists make
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-400">
            better videos
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          We're building the fastest way to turn music into stunning lyric videos. Join us.
        </p>
      </section>

      {/* Values */}
      <section className="py-16 px-6 bg-muted/20 border-y border-border/40">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-10 text-center">How we work</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {VALUES.map((v, i) => (
              <div key={i} className="p-5 rounded-2xl bg-background border border-border/50">
                <h3 className="font-semibold mb-2 text-sm">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-10">Open roles</h2>
        <div className="space-y-4">
          {OPENINGS.map((role, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-border/50 bg-muted/20 hover:border-primary/30 transition-colors group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{role.title}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{role.team}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{role.location}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{role.type}</span>
                  </div>
                  <p className="text-muted-foreground text-sm">{role.desc}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full group-hover:border-primary/40 group-hover:text-primary transition-colors"
                  onClick={() => window.location.href = "mailto:careers@lyricavid.com"}
                >
                  Apply <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* No role? */}
        <div className="mt-12 p-8 rounded-2xl border border-dashed border-border/60 text-center">
          <h3 className="font-semibold mb-2">Don't see your role?</h3>
          <p className="text-muted-foreground text-sm mb-4">
            We're always looking for exceptional people. Send us a note.
          </p>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.location.href = "mailto:careers@lyricavid.com"}
          >
            Get in touch
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
