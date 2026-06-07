import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification windows
const FIRST_REMINDER_DAYS = 7;
const FINAL_REMINDER_DAYS = 1;

interface SubscriptionToNotify {
  user_id: string;
  email: string;
  plan_id: string;
  renew_date: string;
  credits: number;
  credits_used: number;
  full_name: string | null;
}

interface SubscriptionRow {
  user_id: string;
  plan_id: string;
  renew_date: string;
  credits: number;
  credits_used: number;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface PreferenceRow {
  user_id: string;
  subscription_expiry_notifications: boolean;
}

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting subscription expiry notification job...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Process both 7-day and 1-day reminders
    const firstReminder = await processReminders(supabase, resend, FIRST_REMINDER_DAYS, 'first');
    const finalReminder = await processReminders(supabase, resend, FINAL_REMINDER_DAYS, 'final');

    const results = { firstReminder, finalReminder };

    console.log('Notification job complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Subscription expiry notifications processed',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Subscription notification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function processReminders(
  supabase: AnySupabaseClient,
  resend: Resend,
  daysBeforeExpiry: number,
  reminderType: 'first' | 'final'
) {
  // Calculate the target date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`[${reminderType}] Looking for subscriptions expiring between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

  // Get active subscriptions that will expire in X days
  const { data: subscriptionsData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id, renew_date, credits, credits_used')
    .eq('status', 'active')
    .gte('renew_date', startOfDay.toISOString())
    .lte('renew_date', endOfDay.toISOString());

  if (fetchError) {
    console.error(`[${reminderType}] Error fetching subscriptions:`, fetchError);
    throw fetchError;
  }

  const subs = (subscriptionsData || []) as SubscriptionRow[];
  console.log(`[${reminderType}] Found ${subs.length} subscriptions expiring in ${daysBeforeExpiry} day(s)`);

  if (subs.length === 0) {
    return { notificationsSent: 0, errors: 0, totalExpiring: 0 };
  }

  // Get user IDs to fetch profiles and preferences
  const userIds = subs.map(sub => sub.user_id);
  
  // Fetch profiles for emails
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds);

  // Fetch notification preferences
  const { data: preferencesData } = await supabase
    .from('notification_preferences')
    .select('user_id, subscription_expiry_notifications')
    .in('user_id', userIds);

  const profiles = (profilesData || []) as ProfileRow[];
  const preferences = (preferencesData || []) as PreferenceRow[];

  // Create maps for easy lookup
  const profileMap = new Map<string, { email: string; full_name: string | null }>();
  profiles.forEach(profile => {
    if (profile.email) {
      profileMap.set(profile.id, { email: profile.email, full_name: profile.full_name });
    }
  });

  const prefMap = new Map<string, boolean>();
  preferences.forEach(pref => {
    prefMap.set(pref.user_id, pref.subscription_expiry_notifications);
  });

  // Filter subscriptions based on preferences and available emails
  const subsToNotify: SubscriptionToNotify[] = [];
  
  for (const sub of subs) {
    const profile = profileMap.get(sub.user_id);
    const wantsNotification = prefMap.get(sub.user_id);
    
    if (!profile?.email || wantsNotification === false) {
      continue;
    }
    
    subsToNotify.push({
      ...sub,
      email: profile.email,
      full_name: profile.full_name,
    });
  }

  console.log(`[${reminderType}] ${subsToNotify.length} users to notify after filtering`);

  let successCount = 0;
  let errorCount = 0;

  for (const sub of subsToNotify) {
    try {
      const emailHtml = generateEmailHtml(sub, daysBeforeExpiry, reminderType);
      const subject = generateSubject(sub.plan_id, daysBeforeExpiry, reminderType);

      const { error: sendError } = await resend.emails.send({
        from: 'UGC Ads <onboarding@resend.dev>',
        to: [sub.email],
        subject,
        html: emailHtml,
      });

      if (sendError) {
        console.error(`[${reminderType}] Error sending email to ${sub.email}:`, sendError);
        errorCount++;
      } else {
        console.log(`[${reminderType}] Notification sent to ${sub.email}`);
        successCount++;
      }
    } catch (emailError) {
      console.error(`[${reminderType}] Error processing email for ${sub.email}:`, emailError);
      errorCount++;
    }
  }

  return { notificationsSent: successCount, errors: errorCount, totalExpiring: subs.length };
}

function generateSubject(planId: string, daysLeft: number, reminderType: 'first' | 'final'): string {
  const planLabel = getPlanLabel(planId);
  if (reminderType === 'final') {
    return `⚠️ Final Reminder: Your ${planLabel} subscription renews tomorrow!`;
  }
  return `⏰ Your ${planLabel} subscription renews in ${daysLeft} days`;
}

function generateEmailHtml(
  sub: SubscriptionToNotify,
  daysLeft: number,
  reminderType: 'first' | 'final'
): string {
  const planLabel = getPlanLabel(sub.plan_id);
  const renewDate = new Date(sub.renew_date);
  const formattedDate = renewDate.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const creditsRemaining = Math.max(0, sub.credits - sub.credits_used);
  const greeting = sub.full_name ? `Hi ${sub.full_name.split(' ')[0]}` : 'Hi there';
  
  const urgencyColor = reminderType === 'final' ? '#fef2f2' : '#f0f9ff';
  const urgencyBorderColor = reminderType === 'final' ? '#ef4444' : '#0ea5e9';
  const urgencyTextColor = reminderType === 'final' ? '#b91c1c' : '#0369a1';
  const urgencyIcon = reminderType === 'final' ? '⚠️' : '⏰';
  const urgencyTitle = reminderType === 'final' 
    ? 'Final Reminder - Renews Tomorrow!' 
    : `Renews in ${daysLeft} Days`;

  // Payments page URL for subscription management
  const renewUrl = `https://eqiwbtxomiskpekgrsph.lovable.app/payments`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">${urgencyIcon} Your Subscription Renews Soon</h1>
        
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${greeting}, your <strong>${planLabel}</strong> subscription will renew on <strong>${formattedDate}</strong>.
        </p>
        
        <div style="background-color: ${urgencyColor}; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid ${urgencyBorderColor};">
          <p style="color: ${urgencyTextColor}; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
            ${urgencyIcon} ${urgencyTitle}
          </p>
          <p style="color: ${urgencyTextColor}; margin: 0 0 8px 0; font-size: 14px;">
            <strong>Plan:</strong> ${planLabel}
          </p>
          <p style="color: ${urgencyTextColor}; margin: 0; font-size: 14px;">
            <strong>Credits Remaining:</strong> ${creditsRemaining} / ${sub.credits}
          </p>
        </div>
        
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${reminderType === 'final' 
            ? 'This is your final reminder. If you need to make any changes to your subscription or payment method, please do so today.'
            : 'If you\'d like to make changes to your subscription or update your payment method, visit your account settings.'}
        </p>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="${renewUrl}" 
             style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            💳 Manage Subscription
          </a>
        </div>
        
        <div style="margin-top: 16px; text-align: center;">
          <a href="https://eqiwbtxomiskpekgrsph.lovable.app/create" 
             style="color: #2563eb; text-decoration: underline; font-size: 14px;">
            Use your remaining ${creditsRemaining} credits before renewal →
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">
          This is an automated reminder. You can manage your notification preferences in your 
          <a href="https://eqiwbtxomiskpekgrsph.lovable.app/account/notifications" style="color: #6b7280;">account settings</a>.
        </p>
      </div>
    </body>
    </html>
  `;
}

function getPlanLabel(planId: string): string {
  const labels: Record<string, string> = {
    'prod_TDxz0hLhTpZkct': 'Starter',
    'prod_TDy0dHGWf8uJsw': 'Pro',
    'prod_TDy1hm7l8BGJa5': 'Studio',
    'starter': 'Starter',
    'pro': 'Pro',
    'studio': 'Studio',
  };
  return labels[planId] || 'Premium';
}
