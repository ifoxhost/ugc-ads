import { Music2, Play, Download, HelpCircle, BookOpen, Zap, AlertCircle } from "lucide-react";

const Help = () => {
  const sections = [
    {
      icon: Music2,
      title: "Getting Started",
      items: [
        {
          q: "How do I create my first lyric video?",
          a: "Navigate to Create from the sidebar. Choose Suno Link or Manual Entry, fill in your song details, pick a template, set your aspect ratio, and click Generate Lyric Video."
        },
        {
          q: "Do I need a subscription?",
          a: "Yes, a subscription is required to generate lyric videos. Visit Pricing to choose a plan that fits your needs."
        },
      ]
    },
    {
      icon: Play,
      title: "Suno Integration",
      items: [
        {
          q: "How do I use a Suno link?",
          a: "On the Create page, select the Suno Link tab and paste a public Suno song URL (e.g. https://suno.com/song/abc123). Click Parse and SongDoe will extract the title, artist, and lyrics automatically."
        },
        {
          q: "What if Suno parsing fails?",
          a: "Parsing may fail for private songs or if Suno's page structure changes. When this happens, SongDoe shows an error and you can switch to the Manual Entry tab to enter the details yourself."
        },
        {
          q: "Can I edit the extracted lyrics?",
          a: "Yes! After parsing, the song title and artist fields are editable. Use the Manual Entry tab to view and edit the full lyrics in the lyric editor."
        },
      ]
    },
    {
      icon: BookOpen,
      title: "Templates & Styles",
      items: [
        {
          q: "What templates are available?",
          a: "SongDoe offers cinematic AI video styles: Kinetic (animated words), Minimal (clean fades), Neon (glowing text), Cinematic (letterbox style), Waveform (audio bars), and Karaoke (word-by-word highlight)."
        },
        {
          q: "How do I change font or color?",
          a: "After selecting a template, expand Style Options on the Create page. You'll find font theme pickers (Bold, Serif, Modern Sans, Handwritten) and color palette options (Dark, Neon, Pastel, Monochrome)."
        },
        {
          q: "Which aspect ratio should I use?",
          a: "Use 9:16 for TikTok, Instagram Reels, and YouTube Shorts. Use 1:1 for Instagram feed posts or LinkedIn. Use 16:9 for YouTube videos or Twitter."
        },
      ]
    },
    {
      icon: Download,
      title: "Downloading & Using Videos",
      items: [
        {
          q: "How do I download my lyric video?",
          a: "Go to your Library and click the download button on any completed video. Videos are delivered as MP4 files compatible with all major social media platforms."
        },
        {
          q: "Can I use the videos commercially?",
          a: "Yes. All videos you generate are fully yours. You can use them in ads, post them on social media, upload to streaming platforms, or include them in any commercial project."
        },
      ]
    },
    {
      icon: Zap,
      title: "Credits & Billing",
      items: [
        {
          q: "How do credits work?",
          a: "Each lyric video generation consumes credits from your subscription. Your plan's monthly credit allowance resets on your billing date. View your remaining credits on the Dashboard."
        },
        {
          q: "Am I charged if a video fails?",
          a: "No. If a video generation fails, credits are not consumed. You can delete the failed entry and try again."
        },
      ]
    },
    {
      icon: AlertCircle,
      title: "Troubleshooting",
      items: [
        {
          q: "My video is stuck at 'processing'. What do I do?",
          a: "Video rendering can take up to 5 minutes during peak hours. If it's been over 10 minutes, try refreshing the page. If the video is still stuck, delete it and regenerate."
        },
        {
          q: "The generated video looks wrong. How do I fix it?",
          a: "Check that your lyrics are correctly formatted (verse/chorus labels on their own lines help). Make sure the song title and artist are filled in. You can regenerate as many times as needed — only completed videos consume credits."
        },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-20 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">Help Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-tight font-bold mb-2">SongDoe Help Center</h1>
          <p className="text-muted-foreground">Everything you need to get the most out of SongDoe AI Music Video Creator</p>
        </div>

        <div className="space-y-10">
          {sections.map((section, si) => (
            <div key={si}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">{section.title}</h2>
              </div>
              <div className="space-y-4 pl-11">
                {section.items.map((item, ii) => (
                  <div key={ii} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <p className="font-medium text-sm mb-1.5">{item.q}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Help;

