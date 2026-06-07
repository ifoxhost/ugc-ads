import { Link } from "react-router-dom";

const SongDoeLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <circle cx="16" cy="16" r="15" fill="currentColor" fillOpacity="0.15" />
    <path d="M13 8v12.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13 8l10-2v3L13 11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10.5" cy="20.5" r="2.5" stroke="currentColor" strokeWidth="2" />
    <path d="M20 15l5 3-5 3v-6z" fill="currentColor" />
  </svg>
);

const Footer = () => {
  return (
    <footer className="bg-black border-t border-white/10 py-14 px-8">
      <div className="max-w-7xl mx-auto">

        {/* Top brand row */}
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
          <div className="max-w-xs">
            <Link to="/" className="flex items-center gap-2 mb-4" aria-label="SongDoe Home">
              <SongDoeLogo className="w-8 h-8 text-primary" />
              <span className="text-xl font-outfit font-bold text-white tracking-tight">
                Song<span className="text-primary">Doe</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The #1 AI Music Video Creator. Turn any song into a cinematic music video in minutes — powered by Kling 3.0, Google Veo 3.1, GPT-4o, and ElevenLabs.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a href="https://twitter.com/songdoe_ai" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors" aria-label="SongDoe on X (Twitter)">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://discord.gg/songdoe" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors" aria-label="SongDoe Discord">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="https://www.youtube.com/@songdoe" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors" aria-label="SongDoe on YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@songdoe" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors" aria-label="SongDoe on TikTok">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 md:max-w-2xl">
            {/* Product */}
            <div>
              <h3 className="text-white font-semibold text-xs uppercase tracking-widest mb-4">Product</h3>
              <ul className="space-y-3">
                <li><Link to="/create" className="text-muted-foreground hover:text-white text-sm transition-colors">AI Music Video</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-white text-sm transition-colors">Pricing</Link></li>
                <li><Link to="/changelog" className="text-muted-foreground hover:text-white text-sm transition-colors">Changelog</Link></li>
                <li><Link to="/library" className="text-muted-foreground hover:text-white text-sm transition-colors">My Videos</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white font-semibold text-xs uppercase tracking-widest mb-4">Company</h3>
              <ul className="space-y-3">
                <li><Link to="/about" className="text-muted-foreground hover:text-white text-sm transition-colors">About SongDoe</Link></li>
                <li><Link to="/careers" className="text-muted-foreground hover:text-white text-sm transition-colors">Careers</Link></li>
                <li><a href="mailto:hello@songdoe.com" className="text-muted-foreground hover:text-white text-sm transition-colors">Contact Us</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-white font-semibold text-xs uppercase tracking-widest mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><Link to="/blog" className="text-muted-foreground hover:text-white text-sm transition-colors">Blog</Link></li>
                <li><Link to="/help" className="text-muted-foreground hover:text-white text-sm transition-colors">Help Center</Link></li>
                <li><Link to="/community" className="text-muted-foreground hover:text-white text-sm transition-colors">Community</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-white font-semibold text-xs uppercase tracking-widest mb-4">Legal</h3>
              <ul className="space-y-3">
                <li><Link to="/terms" className="text-muted-foreground hover:text-white text-sm transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-white text-sm transition-colors">Privacy Policy</Link></li>
                <li><Link to="/cookies" className="text-muted-foreground hover:text-white text-sm transition-colors">Cookie Policy</Link></li>
                <li><Link to="/acceptable-use" className="text-muted-foreground hover:text-white text-sm transition-colors">Acceptable Use</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* AI Engine badges */}
        <div className="flex flex-wrap gap-2 mb-10 pb-10 border-b border-white/10">
          <span className="text-xs text-muted-foreground mr-2 self-center">Powered by:</span>
          {["Kling 3.0", "Google Veo 3.1", "GPT-4o", "ElevenLabs Scribe v2", "Nano Banana Pro", "Pexels"].map(engine => (
            <span key={engine} className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground font-medium">
              {engine}
            </span>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} SongDoe. All rights reserved. The #1 AI Music Video Creator.
          </p>
          <p className="text-muted-foreground text-xs">
            Made with ❤️ for artists, producers & creators worldwide
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
