import { ArrowRight, Play, Package, FileText, Users, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import hero from "@/assets/ugc-studio-hero.jpg";
import skincare from "@/assets/ugc-ads/skincare-ad.jpg";
import unboxing from "@/assets/ugc-ads/tech-unboxing.jpg";
import fitness from "@/assets/ugc-ads/fitness-workout.jpg";
import beauty from "@/assets/ugc-ads/beauty-makeup.jpg";
import routine from "@/assets/ugc-ads/lifestyle-wfh.jpg";
import food from "@/assets/ugc-ads/food-smoothie.jpg";
const examples = [
  ["Creator story", "A personal angle on your product", skincare],
  ["Unboxing", "The first impression, up close", unboxing],
  ["Problem / solution", "A benefit worth stopping for", fitness],
  ["3 reasons why", "One product. Three strong angles.", food],
  ["Before & after", "Show the difference responsibly", beauty],
  ["Aesthetic routine", "Your product in everyday life", routine],
];
export default function Home() {
  return <div>
    <section className="ugc-home-hero relative isolate flex items-center overflow-hidden">
      <img src={hero} alt="Creator filming a skincare product review" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="ugc-hero-shade absolute inset-0" />
      <div className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:px-10">
        <div className="max-w-lg">
          <p className="mb-6 flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> PRODUCT TO CREATIVE</p>
          <h1 className="mb-6 text-5xl font-bold leading-tight sm:text-6xl">UGC Ads<br /><span className="text-primary">Studio.</span></h1>
          <p className="mb-8 max-w-sm text-lg leading-relaxed text-foreground/80">Your product. A fresh angle.<br />Create AI-powered UGC ads for TikTok, Reels, Shorts, and Meta.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2"><Link to="/create">Create UGC Ad <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg" className="gap-2 bg-background/40"><a href="#ad-examples"><Play className="h-4 w-4" /> View Ad Examples</a></Button>
          </div>
          <p className="mt-7 text-xs text-foreground/60">For ecommerce brands, agencies & creative teams</p>
        </div>
      </div>
    </section>
    <section className="border-y border-border bg-secondary/40 px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><span className="text-xs text-muted-foreground">CREATIVE FOR YOUR NEXT CAMPAIGN</span>{["TikTok", "Instagram Reels", "YouTube Shorts", "Meta Ads"].map(x => <span key={x} className="text-lg font-semibold">{x}</span>)}</div>
    </section>
    <section id="ad-examples" className="mx-auto max-w-7xl px-6 py-20 sm:px-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-semibold text-primary">THE CREATIVE LINEUP</p><h2 className="text-3xl sm:text-4xl">Find your product’s angle.</h2></div><p className="max-w-xs text-sm text-muted-foreground">Illustrative creative concepts. Your ad starts with your own product.</p></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{examples.map(([name, detail, image]) => <Link key={name} to="/create" className="group min-w-0"><div className="aspect-[9/14] overflow-hidden rounded-lg bg-muted"><img src={image} alt={name + " UGC concept"} loading="lazy" width={576} height={1024} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div><h3 className="mt-4 text-sm font-semibold">{name}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></Link>)}</div>
    </section>
    <section className="border-y border-border bg-secondary/30 px-6 py-20 sm:px-10"><div className="mx-auto max-w-7xl"><p className="mb-3 text-xs font-semibold text-primary">FROM BRIEF TO AD</p><h2 className="mb-12 text-3xl sm:text-4xl">A better creative starting point.</h2><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{[[Package,"01","Product & offer","Bring your product photos, audience, benefit, and offer."],[FileText,"02","Script & hooks","Explore fresh angles and make every line your own."],[Users,"03","Creator & setting","Choose the look, tone, and environment for your creative."],[Video,"04","Generate & preview","Review your output and export your next campaign asset."]].map(([Icon,n,title,detail]) => { const Symbol = Icon as typeof Package; return <div key={String(n)} className="border-t border-border pt-5"><div className="mb-6 flex justify-between text-primary"><Symbol className="h-6 w-6" /><span className="text-xs">{String(n)}</span></div><h3 className="mb-3 text-lg">{String(title)}</h3><p className="text-sm leading-relaxed text-muted-foreground">{String(detail)}</p></div>; })}</div></div></section>
    <FAQ />
    <section className="border-t border-border px-6 py-16 text-center"><h2 className="mb-6 text-3xl">Your next creative starts here.</h2><Button asChild size="lg" className="gap-2"><Link to="/create">Create UGC Ad <ArrowRight className="h-4 w-4" /></Link></Button></section><Footer />
  </div>;
}
