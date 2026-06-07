import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const LAST_UPDATED = "March 1, 2025";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const AcceptableUse = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-12">
        <Link to="/" className="text-primary text-sm hover:underline">← Back to SongDoe</Link>
        <h1 className="text-4xl font-semibold mt-6 mb-2">Acceptable Use Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <Section title="1. Purpose">
        <p>
          This Acceptable Use Policy ("AUP") governs how you may use the SongDoe platform and
          services. It exists to protect our users, maintain the integrity of the Service, and ensure
          a positive creative environment for everyone.
        </p>
      </Section>

      <Section title="2. Permitted Use">
        <p>You may use SongDoe to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create AI music videos from song lyrics you own or have rights to</li>
          <li>Generate UGC-style ads for legitimate products and services</li>
          <li>Store, manage, and share your creative output</li>
          <li>Explore features within the limits of your subscription plan</li>
        </ul>
      </Section>

      <Section title="3. Prohibited Content">
        <p>You must not use SongDoe to create, upload, or distribute content that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Infringes any copyright, trademark, or other intellectual property right</li>
          <li>Is defamatory, harassing, threatening, or incites violence or hatred</li>
          <li>Is sexually explicit, pornographic, or involves minors in any inappropriate manner</li>
          <li>Promotes illegal activities, fraud, or deceptive practices</li>
          <li>Contains malware, viruses, or other harmful code</li>
          <li>Impersonates any person, company, or brand without authorisation</li>
          <li>Violates the privacy or personal data rights of others</li>
        </ul>
      </Section>

      <Section title="4. Prohibited Activities">
        <p>You must not:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Attempt to gain unauthorised access to the platform or other users' accounts</li>
          <li>Reverse-engineer, decompile, or scrape the Service or its underlying systems</li>
          <li>Use automated scripts or bots to interact with the Service in a way that disrupts availability for others</li>
          <li>Resell, sublicense, or commercially redistribute access to the Service without written permission</li>
          <li>Share your account credentials with others or create accounts on behalf of third parties at scale</li>
          <li>Circumvent any rate limits, credit systems, or access controls</li>
        </ul>
      </Section>

      <Section title="5. AI-Generated Content">
        <p>
          You are responsible for the prompts, lyrics, and inputs you provide to SongDoe's AI systems.
          AI-generated output remains your responsibility. Do not use AI features to generate content that
          would otherwise violate this policy.
        </p>
      </Section>

      <Section title="6. Enforcement">
        <p>
          Violations of this AUP may result in warnings, temporary suspension, or permanent termination
          of your account — at our sole discretion. We reserve the right to remove content that violates
          this policy without prior notice.
        </p>
        <p>
          We are not obligated to monitor all content, but we will act on reports of violations. To
          report a violation, email{" "}
          <a href="mailto:trust@lyricavid.com" className="text-primary hover:underline">trust@lyricavid.com</a>.
        </p>
      </Section>

      <Section title="7. Changes to This Policy">
        <p>
          We may update this AUP as the Service evolves. Continued use of SongDoe after changes
          constitutes acceptance of the revised policy. Material changes will be communicated via email
          or in-app notice.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          Questions about this policy? Email us at{" "}
          <a href="mailto:legal@lyricavid.com" className="text-primary hover:underline">legal@lyricavid.com</a>.
        </p>
      </Section>
    </div>
    <Footer />
  </div>
);

export default AcceptableUse;

