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
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your SongDoe login link — expires soon</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🎬 SongDoe</Text>
          <Text style={tagline}>AI Music Video Creator</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>
            Click below to sign in to {siteName}. This link is single-use and expires shortly.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Sign In to SongDoe →
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Didn't request this? You can safely ignore this email — your account remains secure.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const hr = { border: 'none', borderTop: '1px solid #1f1f1f', margin: '4px 0 20px' }
const footer = { fontSize: '12px', color: '#444', margin: '0', lineHeight: '1.5' }
