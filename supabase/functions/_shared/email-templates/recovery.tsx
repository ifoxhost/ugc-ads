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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your SongDoe password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🎬 SongDoe</Text>
          <Text style={tagline}>AI Music Video Creator</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Password reset</Heading>
          <Text style={text}>
            We received a request to reset your password for your {siteName} account.
            Click the button below to choose a new one.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Reset My Password →
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Didn't request a password reset? You can safely ignore this email — your SongDoe account and password will remain unchanged.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
