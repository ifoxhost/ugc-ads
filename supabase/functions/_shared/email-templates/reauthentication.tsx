/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your SongDoe verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🎬 SongDoe</Text>
          <Text style={tagline}>AI Music Video Creator</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Verify it's you</Heading>
          <Text style={text}>
            Use the code below to confirm your SongDoe identity. It expires in 10 minutes.
          </Text>
          <Text style={codeStyle}>{token}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            Didn't request this? You can safely ignore this email — your SongDoe account remains secure.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '38px',
  fontWeight: 'bold' as const,
  color: 'hsl(6, 85%, 69%)',
  letterSpacing: '10px',
  margin: '0 0 28px',
  textAlign: 'center' as const,
  background: '#1a0a0a',
  borderRadius: '10px',
  padding: '18px',
  border: '1px solid #2a1a0a',
}
const hr = { border: 'none', borderTop: '1px solid #1f1f1f', margin: '4px 0 20px' }
const footer = { fontSize: '12px', color: '#444', margin: '0', lineHeight: '1.5' }
