/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to SongDoe — verify your email to start creating AI music videos</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🎬 SongDoe</Text>
          <Text style={tagline}>AI Music Video Creator</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Almost there!</Heading>
          <Text style={text}>
            Welcome aboard! 🎵 You're one step away from turning your songs into cinematic AI music
            videos with{' '}
            <Link href={siteUrl} style={link}>SongDoe</Link>.
          </Text>
          <Text style={text}>
            Click below to verify{' '}
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
            and unlock your account:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Verify My Email →
          </Button>
          <Hr style={hr} />
          <Text style={featureHighlight}>
            🎬 Kling 3.0 · Google Veo 3.1 · GPT-4o Scripts · ElevenLabs Transcription
          </Text>
          <Text style={footer}>
            Didn't sign up for SongDoe? You can safely ignore this email — nothing will change.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
const container = {
  maxWidth: '520px',
  margin: '40px auto',
  borderRadius: '16px',
  overflow: 'hidden',
  border: '1px solid #1f1f1f',
  boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
}
const header = {
  background: 'linear-gradient(135deg, #0f0f0f 0%, #1a0a2e 50%, #0f0f0f 100%)',
  padding: '32px 32px 24px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #2a1a4e',
}
const logoText = {
  color: '#ffffff',
  fontSize: '26px',
  fontWeight: '800',
  margin: '0 0 4px',
  letterSpacing: '-0.5px',
}
const tagline = {
  color: 'hsl(6, 85%, 69%)',
  fontSize: '11px',
  fontWeight: '600',
  margin: '0',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
}
const content = { padding: '32px 40px 28px', backgroundColor: '#0f0f0f' }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#ffffff',
  margin: '0 0 16px',
  letterSpacing: '-0.5px',
}
const text = {
  fontSize: '15px',
  color: '#a0a0a0',
  lineHeight: '1.7',
  margin: '0 0 20px',
}
const link = { color: 'hsl(6, 85%, 69%)', textDecoration: 'underline' }
const button = {
  background: 'linear-gradient(135deg, hsl(6, 85%, 69%) 0%, hsl(270, 70%, 65%) 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: '24px',
}
const featureHighlight = {
  fontSize: '11px',
  color: '#555',
  textAlign: 'center' as const,
  letterSpacing: '0.5px',
  margin: '0 0 16px',
}
const hr = { border: 'none', borderTop: '1px solid #1f1f1f', margin: '4px 0 20px' }
const footer = { fontSize: '12px', color: '#444', margin: '0', lineHeight: '1.5' }
