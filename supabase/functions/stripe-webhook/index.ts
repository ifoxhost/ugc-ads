import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { Resend } from "npm:resend@2.0.0";

const plans = {
  starter: { credits: 20, name: "Starter" },
  pro: { credits: 100, name: "Pro" },
  studio: { credits: 400, name: "Studio" }
};

const getAppUrl = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  return supabaseUrl.replace('.supabase.co', '.lovable.app');
};

const generateWelcomeEmailHtml = (userName: string, planName: string, credits: number) => {
  const appUrl = getAppUrl();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to UGC Ads!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff;">
                Welcome to UGC Ads! 🎬
              </h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">
                You're all set to create amazing content
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.6; color: #18181b;">
                Hi ${userName}! 👋
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Thank you for subscribing to the <strong style="color: #8b5cf6;">${planName} Plan</strong>! You now have access to our AI-powered UGC ad creation tools.
              </p>
              
              <!-- Credits Box -->
              <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">
                  Your Credits
                </p>
                <p style="margin: 8px 0 0; font-size: 48px; font-weight: 700; color: #ffffff;">
                  ${credits}
                </p>
                <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">
                  Ready to use
                </p>
              </div>
              
              <!-- Features Section -->
              <h2 style="margin: 30px 0 16px; font-size: 18px; font-weight: 600; color: #18181b;">
                What you can do:
              </h2>
              
              <div style="margin: 0 0 24px;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
                  <span style="font-size: 20px; margin-right: 12px;">🎨</span>
                  <div>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #18181b;">AI-Generated UGC Ads</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Create stunning product ads with AI models</p>
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
                  <span style="font-size: 20px; margin-right: 12px;">🎬</span>
                  <div>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #18181b;">Video Generation</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Transform images into engaging video ads</p>
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-size: 20px; margin-right: 12px;">📚</span>
                  <div>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #18181b;">Content Library</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Access all your creations in one place</p>
                  </div>
                </div>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/create" 
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                      Create Your First Ad →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #71717a; text-align: center;">
                Need help getting started? Check out our <a href="${appUrl}/help" style="color: #6366f1; text-decoration: none;">Help Center</a>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Welcome aboard! We're excited to have you.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const generateFailedPaymentEmailHtml = (userName: string, planName: string, amount: number) => {
  const appUrl = getAppUrl();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">⚠️</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                Payment Failed
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: #71717a;">
                We couldn't process your payment
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                We were unable to process your payment of <strong style="color: #18181b;">R${amount}</strong> for your <strong style="color: #18181b;">${planName}</strong> subscription.
              </p>
              
              <!-- Warning Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 600;">
                  ⚠️ Action Required
                </p>
                <p style="margin: 8px 0 0; font-size: 14px; color: #7f1d1d;">
                  Please update your payment method to avoid service interruption.
                </p>
              </div>
              
              <!-- Common Reasons -->
              <h3 style="margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: #18181b;">
                Common reasons for payment failure:
              </h3>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #3f3f46; font-size: 14px; line-height: 1.8;">
                <li>Insufficient funds in your account</li>
                <li>Card expired or about to expire</li>
                <li>Incorrect billing information</li>
                <li>Bank declined the transaction</li>
              </ul>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/payments" 
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #71717a; text-align: center;">
                If you believe this is an error or need assistance, please reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                We'll retry the payment automatically. Update your payment method to ensure uninterrupted service.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const generateRenewalEmailHtml = (userName: string, planName: string, credits: number, renewDate: string) => {
  const appUrl = getAppUrl();
  const formattedDate = new Date(renewDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Renewed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with Success Icon -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">✓</span>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">
                Thank You! 🎉
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: #71717a;">
                Your subscription has been renewed successfully
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Great news! Your <strong style="color: #18181b;">${planName}</strong> subscription has been renewed and your credits have been refreshed.
              </p>
              
              <!-- Credits Summary Box -->
              <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">
                  Your Credits
                </p>
                <p style="margin: 8px 0 0; font-size: 48px; font-weight: 700; color: #ffffff;">
                  ${credits}
                </p>
                <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">
                  Ready to use
                </p>
              </div>
              
              <!-- Next Renewal -->
              <div style="background-color: #f4f4f5; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #71717a;">
                  📅 Next renewal: <strong style="color: #18181b;">${formattedDate}</strong>
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/create" 
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                      Start Creating Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Thank you for being a valued subscriber!
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Manage your subscription in your <a href="${appUrl}/payments" style="color: #6366f1;">account settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const sendEmail = async (
  resend: InstanceType<typeof Resend>,
  to: string,
  subject: string,
  html: string
) => {
  try {
    const emailResponse = await resend.emails.send({
      from: "UGC Ads <notifications@resend.dev>",
      to: [to],
      subject,
      html,
    });
    console.log("Email sent successfully:", emailResponse);
    return emailResponse;
  } catch (error) {
    console.error("Failed to send email:", error);
    return null;
  }
};

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });
    
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe signature header');
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    let event: Stripe.Event;
    
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response('Invalid signature', { status: 400 });
      }
    } else {
      event = JSON.parse(body);
    }

    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;

        if (!userId || !planId) {
          console.error('Missing user_id or plan_id in session metadata');
          break;
        }

        const plan = plans[planId as keyof typeof plans];
        if (!plan) {
          console.error('Invalid plan:', planId);
          break;
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        const renewDate = new Date();
        renewDate.setMonth(renewDate.getMonth() + 1);

        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            credits: plan.credits,
            credits_used: 0,
            renew_date: renewDate.toISOString(),
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }, { onConflict: 'user_id' });

        if (subError) {
          console.error('Subscription update error:', subError);
          throw subError;
        }

        await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('payment_id', session.id);

        console.log('Subscription activated for user:', userId);

        // Send welcome email to new subscribers
        if (resend) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

          if (profile?.email) {
            const userName = profile.full_name || profile.email.split('@')[0];
            const welcomeHtml = generateWelcomeEmailHtml(userName, plan.name, plan.credits);
            await sendEmail(
              resend,
              profile.email,
              `🎬 Welcome to UGC Ads! Let's create your first ad`,
              welcomeHtml
            );
            console.log('Welcome email sent to:', profile.email);
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription status changed:', subscription.status);

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        if (!existingSub) {
          console.error('Subscription not found for:', subscription.id);
          break;
        }

        let status = 'active';
        if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
          status = 'cancelled';
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          status = 'past_due';
        }

        await supabase
          .from('subscriptions')
          .update({ status })
          .eq('stripe_subscription_id', subscription.id);

        console.log('Subscription status updated:', status);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment succeeded:', invoice.id);

        const subscriptionId = invoice.subscription as string;
        
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id, plan_id, credits')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (existingSub) {
          // Record transaction
          await supabase.from('transactions').insert({
            user_id: existingSub.user_id,
            payment_id: invoice.id,
            amount: invoice.amount_paid / 100,
            status: 'success',
            payment_method: 'stripe',
            metadata: { 
              plan_id: existingSub.plan_id,
              invoice_id: invoice.id,
              subscription_id: subscriptionId
            }
          });

          // Check if this is a renewal (not the first payment)
          const billingReason = invoice.billing_reason;
          if (billingReason === 'subscription_cycle' && resend) {
            const plan = plans[existingSub.plan_id as keyof typeof plans];
            if (plan) {
              const newRenewDate = new Date();
              newRenewDate.setMonth(newRenewDate.getMonth() + 1);
              
              await supabase
                .from('subscriptions')
                .update({ 
                  credits_used: 0,
                  renew_date: newRenewDate.toISOString()
                })
                .eq('stripe_subscription_id', subscriptionId);

              const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', existingSub.user_id)
                .single();

              const { data: prefs } = await supabase
                .from('notification_preferences')
                .select('subscription_expiry_notifications')
                .eq('user_id', existingSub.user_id)
                .single();

              if (profile?.email && (prefs?.subscription_expiry_notifications !== false)) {
                const userName = profile.full_name || profile.email.split('@')[0];
                const renewalHtml = generateRenewalEmailHtml(userName, plan.name, plan.credits, newRenewDate.toISOString());
                await sendEmail(
                  resend,
                  profile.email,
                  `🎉 Thank you! Your ${plan.name} subscription is renewed`,
                  renewalHtml
                );
              }
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', invoice.id);

        const subscriptionId = invoice.subscription as string;
        
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id, plan_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (existingSub) {
          // Record failed transaction
          await supabase.from('transactions').insert({
            user_id: existingSub.user_id,
            payment_id: invoice.id,
            amount: invoice.amount_due / 100,
            status: 'failed',
            payment_method: 'stripe',
            metadata: { 
              plan_id: existingSub.plan_id,
              invoice_id: invoice.id,
              subscription_id: subscriptionId
            }
          });

          // Send failed payment notification email
          if (resend) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', existingSub.user_id)
              .single();

            const { data: prefs } = await supabase
              .from('notification_preferences')
              .select('subscription_expiry_notifications')
              .eq('user_id', existingSub.user_id)
              .single();

            if (profile?.email && (prefs?.subscription_expiry_notifications !== false)) {
              const plan = plans[existingSub.plan_id as keyof typeof plans];
              const userName = profile.full_name || profile.email.split('@')[0];
              const failedHtml = generateFailedPaymentEmailHtml(
                userName,
                plan?.name || existingSub.plan_id,
                invoice.amount_due / 100
              );
              await sendEmail(
                resend,
                profile.email,
                `⚠️ Payment failed for your ${plan?.name || existingSub.plan_id} subscription`,
                failedHtml
              );
              console.log('Failed payment email sent to:', profile.email);
            }
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Stripe webhook error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return new Response('Processing error', { status: 500 });
  }
});
