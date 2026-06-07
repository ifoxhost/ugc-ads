import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const LAST_UPDATED = "March 1, 2025";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-12">
        <Link to="/" className="text-primary text-sm hover:underline">← Back to SongDoe</Link>
        <h1 className="text-4xl font-semibold mt-6 mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <Section title="1. Introduction">
        <p>
          SongDoe ("we", "our", "us") is committed to protecting your personal information. This Privacy
          Policy explains what data we collect, how we use it, and your rights regarding that data.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>We collect the following categories of information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Account data</strong> — email address, name, and authentication credentials</li>
          <li><strong className="text-foreground">Usage data</strong> — videos created, credits used, session activity, and feature interactions</li>
          <li><strong className="text-foreground">Content data</strong> — lyrics, song titles, and uploaded images you provide to generate videos</li>
          <li><strong className="text-foreground">Payment data</strong> — handled by our payment processors (Stripe/PayFast); we do not store card details</li>
          <li><strong className="text-foreground">Technical data</strong> — IP address, browser type, device info, and cookies</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use your information to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide, maintain, and improve the Service</li>
          <li>Process payments and manage your subscription</li>
          <li>Send transactional emails (e.g., video completion, subscription renewal notices)</li>
          <li>Respond to support requests</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Analyse usage to improve product features (aggregated, anonymised where possible)</li>
        </ul>
      </Section>

      <Section title="4. Cookies">
        <p>
          We use essential cookies required for authentication and session management. We may also use
          analytics cookies to understand how users interact with the Service. You can control cookies
          through your browser settings.
        </p>
      </Section>

      <Section title="5. Sharing of Information">
        <p>
          We do not sell your personal data. We share data only with trusted service providers who help us
          operate the platform (e.g., cloud hosting, payment processors, email delivery). All providers are
          contractually bound to protect your data.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain your account data for as long as your account is active. Content in your library (videos,
          images) is retained until you delete it. Deleted items move to Trash and are permanently removed
          after 30 days.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access, correct, or delete your personal data</li>
          <li>Object to or restrict certain processing</li>
          <li>Data portability (receive a copy of your data)</li>
          <li>Withdraw consent at any time</li>
        </ul>
        <p>
          To exercise these rights, email{" "}
          <a href="mailto:privacy@lyricavid.com" className="text-primary hover:underline">privacy@lyricavid.com</a>.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We use industry-standard encryption (TLS in transit, AES at rest) and access controls to protect
          your data. No system is completely secure; please use a strong, unique password for your account.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          The Service is not directed at children under 13. We do not knowingly collect data from children.
          If you believe a child has provided us personal information, contact us and we will delete it promptly.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. Material changes will be communicated via email or
          in-app notice at least 14 days before taking effect.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions or concerns? Email us at{" "}
          <a href="mailto:privacy@lyricavid.com" className="text-primary hover:underline">privacy@lyricavid.com</a>.
        </p>
      </Section>
    </div>
    <Footer />
  </div>
);

export default Privacy;

