import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "What is SongDoe?",
      answer: "SongDoe is the #1 AI Music Video Creator. Paste a Suno URL or upload any audio file — our AI automatically transcribes your audio with ElevenLabs Scribe v2, writes a full cinematic video script with GPT-4o, generates scene-by-scene storyboard images with Nano Banana Pro, and renders professional video clips using Kling 3.0 or Google Veo 3.1. No editing skills needed."
    },
    {
      question: "How do I create an AI music video on SongDoe?",
      answer: "It's a 3-step process: (1) Paste your Suno song URL or upload your own audio file (MP3, WAV, M4A). (2) Customize your visual style, character description, color palette, and aspect ratio. (3) Click 'Generate Music Video' — our AI pipeline handles everything: transcription → script → storyboard → video rendering. Your cinematic music video is ready in minutes."
    },
    {
      question: "How is SongDoe different from Sondo.ai or OpenArt?",
      answer: "SongDoe is purpose-built exclusively for AI music video creation, while OpenArt and Sondo.ai are general-purpose AI tools. SongDoe gives you a dedicated end-to-end pipeline: audio transcription (ElevenLabs), AI screenplay writing (GPT-4o), scene image generation (Nano Banana Pro via Kie.ai), and cinematic video rendering (Kling 3.0 + Veo 3.1) — all in one workflow specifically designed for music artists and creators."
    },
    {
      question: "What AI models does SongDoe use?",
      answer: "SongDoe uses the world's best AI stack: Kling 3.0 for cinematic video generation, Google Veo 3.1 for photorealistic video rendering, GPT-4o for script writing and scene direction, ElevenLabs Scribe v2 for audio transcription, Nano Banana Pro for storyboard image generation, and Pexels for reference cinematography imagery."
    },
    {
      question: "Can I use a Suno song URL or do I need to upload audio?",
      answer: "Both! In the Create page, you can either paste a Suno song URL (https://suno.com/s/...) and we'll automatically extract the title, artist, and lyrics — or switch to the Upload Audio tab and drag in any MP3, WAV, M4A, or FLAC file. When you upload audio, ElevenLabs Scribe v2 transcribes the full spoken content, which is then merged with any lyrics you paste for maximum script quality."
    },
    {
      question: "What aspect ratios can I generate?",
      answer: "SongDoe supports all major formats: 16:9 (YouTube, cinematic widescreen), 9:16 (TikTok, Reels, YouTube Shorts), 1:1 (Instagram square), and 4:5 (Instagram portrait). Every video is export-ready for any platform."
    },
    {
      question: "How long does it take to generate a music video?",
      answer: "The full pipeline — transcription, GPT-4o script, storyboard image generation, and video rendering — typically completes in 3–8 minutes depending on video duration and server load. The live pipeline log on-screen shows you each stage's progress in real time."
    },
    {
      question: "Can I use the music videos commercially?",
      answer: "Yes — you fully own all videos created on SongDoe. Use them anywhere: social media, YouTube, ads, client work, live shows, streaming platforms, or music distribution. No royalties, no attribution required."
    },
    {
      question: "What if my Suno link parsing fails?",
      answer: "Suno link parsing works on a best-effort basis. If it fails for a private or modified URL, SongDoe falls back gracefully — you can manually enter the song title, artist name, and lyrics in the provided fields. The AI pipeline will still generate a full cinematic music video."
    },
    {
      question: "How do SongDoe credits work?",
      answer: "Each AI music video generation uses credits from your plan. Credits reset monthly on your billing date. Your Dashboard shows remaining credits and usage history. If you run out, you can upgrade your plan or purchase additional credit packs — no generation is ever wasted as failed jobs don't consume credits."
    },
    {
      question: "Can I choose between Kling 3.0 and Google Veo 3.1?",
      answer: "Yes! In the Create form you can select your preferred video AI engine: Kling 3.0 excels at cinematic motion, character continuity, and dramatic scene transitions — perfect for music videos with a performer. Google Veo 3.1 excels at photorealistic environments, landscapes, and abstract visual storytelling."
    },
    {
      question: "Is SongDoe free to use?",
      answer: "SongDoe offers a free tier with monthly generation credits — no credit card required to start. Paid plans unlock higher resolution exports (up to 4K), longer video durations, priority rendering with the latest AI models, unlimited storyboard revisions, and commercial usage rights for all output."
    }
  ];

  return (
    <section className="py-20 px-6 bg-background" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <span className="block text-center text-xs uppercase tracking-widest text-primary font-semibold mb-3">FAQ</span>
        <h2 id="faq-heading" className="text-center text-[2.5rem] font-tight mb-4 tracking-tight font-semibold">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-muted-foreground mb-12 text-[17px] font-light">
          Everything you need to know about SongDoe AI Music Video Creator
        </p>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border-b border-border">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
