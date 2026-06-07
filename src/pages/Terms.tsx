import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const LAST_UPDATED = "March 1, 2025";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-12">
        <Link to="/" className="text-primary text-sm hover:underline">← Back to SongDoe</Link>
        <h1 className="text-4xl font-semibold mt-6 mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using SongDoe ("Service", "we", "us", or "our"), you agree to be bound by
          these Terms of Service. If you do not agree to these terms, please do not use the Service.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          SongDoe provides an AI-powered platform that creates AI music videos from any song. The Service
          includes access to templates, Suno integration, a video rendering pipeline, and a personal library to
          manage your creations.
        </p>
      </Section>

      <Section title="3. Eligibility">
        <p>
          You must be at least 13 years old to use SongDoe. By using the Service, you represent that you
          meet this age requirement and have the legal capacity to enter into these Terms.
        </p>
      </Section>

      <Section title="4. User Accounts">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all
          activities that occur under your account. Notify us immediately of any unauthorised use of your account
          at <a href="mailto:support@lyricavid.com" className="text-primary hover:underline">support@lyricavid.com</a>.
        </p>
      </Section>

      <Section title="5. Content & Intellectual Property">
        <p>
          You retain ownership of any lyrics, music, or creative content you upload. By submitting content
          you grant SongDoe a limited, non-exclusive licence to process and render that content solely to
          provide the Service to you.
        </p>
        <p>
          You must not upload content that infringes third-party copyright or violates any applicable law.
          SongDoe reserves the right to remove content that violates these Terms.
        </p>
      </Section>

      <Section title="6. Credits & Subscriptions">
        <p>
          Access to video generation requires credits, which are included with subscription plans. Credits are
          non-transferable and non-refundable unless required by law. Subscription fees are billed in advance
          and renew automatically unless cancelled before the renewal date.
        </p>
      </Section>

      <Section title="7. Prohibited Use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Service to generate content that is illegal, harmful, or offensive</li>
          <li>Attempt to reverse-engineer, scrape, or misuse the platform</li>
          <li>Share account access with others or resell the Service</li>
          <li>Automate requests in a way that disrupts the Service for other users</li>
        </ul>
      </Section>

      <Section title="8. Disclaimer of Warranties">
        <p>
          The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted
          or error-free operation. AI-generated output may vary and does not constitute professional advice.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, SongDoe shall not be liable for any indirect, incidental,
          or consequential damages arising from your use of the Service.
        </p>
      </Section>

      <Section title="10. Changes to Terms">
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes constitutes
          acceptance of the revised Terms. Material changes will be communicated via email or in-app notice.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          For questions about these Terms, email us at{" "}
          <a href="mailto:legal@lyricavid.com" className="text-primary hover:underline">legal@lyricavid.com</a>.
        </p>
      </Section>
    </div>
    <Footer />
  </div>
);

export default Terms;

