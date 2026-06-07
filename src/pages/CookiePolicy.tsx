import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const LAST_UPDATED = "March 1, 2025";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const CookiePolicy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-12">
        <Link to="/" className="text-primary text-sm hover:underline">← Back to SongDoe</Link>
        <h1 className="text-4xl font-semibold mt-6 mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <Section title="1. What Are Cookies">
        <p>
          Cookies are small text files placed on your device when you visit a website. They allow the
          site to recognise your device, remember your preferences, and improve your overall experience.
        </p>
      </Section>

      <Section title="2. How We Use Cookies">
        <p>SongDoe uses cookies for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Authentication</strong> — to keep you logged in and secure your session</li>
          <li><strong className="text-foreground">Preferences</strong> — to remember your settings and UI preferences</li>
          <li><strong className="text-foreground">Analytics</strong> — to understand how users interact with the platform (aggregated and anonymised)</li>
          <li><strong className="text-foreground">Performance</strong> — to monitor and improve page load speed and reliability</li>
        </ul>
      </Section>

      <Section title="3. Types of Cookies We Use">
        <p><strong className="text-foreground">Essential cookies</strong> are required for the Service to function. Without them, features like login and video generation cannot operate. These cannot be disabled.</p>
        <p><strong className="text-foreground">Functional cookies</strong> remember your choices (e.g., language, theme) to personalise your experience. You can disable these in your browser settings, though some features may be affected.</p>
        <p><strong className="text-foreground">Analytics cookies</strong> help us understand usage patterns so we can improve the product. We use privacy-respecting analytics that do not track you across other websites.</p>
      </Section>

      <Section title="4. Third-Party Cookies">
        <p>
          Some cookies on our platform are set by trusted third-party services we use, including payment
          processors (Stripe, PayFast) and infrastructure providers. These third parties have their own
          cookie and privacy policies, which we encourage you to review.
        </p>
      </Section>

      <Section title="5. Managing Cookies">
        <p>
          You can control and delete cookies through your browser settings. Most browsers allow you to
          block cookies or alert you when a cookie is being set. Note that disabling essential cookies
          will prevent you from using core features of SongDoe.
        </p>
        <p>
          For guidance on managing cookies in your browser, visit{" "}
          <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            allaboutcookies.org
          </a>.
        </p>
      </Section>

      <Section title="6. Changes to This Policy">
        <p>
          We may update this Cookie Policy from time to time. Any material changes will be communicated
          via in-app notice or email before taking effect.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          If you have questions about our use of cookies, email us at{" "}
          <a href="mailto:privacy@lyricavid.com" className="text-primary hover:underline">privacy@lyricavid.com</a>.
        </p>
      </Section>
    </div>
    <Footer />
  </div>
);

export default CookiePolicy;

