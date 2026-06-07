import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
}

export const usePushNotifications = () => {
  const { toast } = useToast();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 'serviceWorker' in navigator && 
                        'PushManager' in window && 
                        'Notification' in window;
    return isSupported;
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  // Check existing subscription status
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Verify subscription exists in database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();
          
          return !!data;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Request notification permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        toast({
          title: 'Notifications blocked',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from environment or use a placeholder
      // In production, this should come from your backend
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      let subscription: PushSubscription;
      
      if (vapidPublicKey) {
        // Convert VAPID key to Uint8Array
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      } else {
        // Fallback without VAPID (limited browser support)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
        });
      }

      console.log('Push subscription created:', subscription.endpoint);

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (insertError) {
        console.error('Failed to save subscription:', insertError);
        throw insertError;
      }

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      
      toast({
        title: 'Notifications enabled',
        description: "You'll be notified when your videos are ready.",
      });

      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      
      toast({
        title: 'Subscription failed',
        description: 'Could not enable push notifications. Please try again.',
        variant: 'destructive',
      });
      
      return false;
    }
  }, [toast]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      
      toast({
        title: 'Notifications disabled',
        description: "You won't receive push notifications anymore.",
      });

      return true;
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [toast]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const isSupported = checkSupport();
      setState(prev => ({ ...prev, isSupported }));

      if (!isSupported) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Register service worker
      await registerServiceWorker();

      // Check current permission
      const permission = Notification.permission;
      setState(prev => ({ ...prev, permission }));

      // Check if already subscribed
      if (permission === 'granted') {
        const isSubscribed = await checkSubscriptionStatus();
        setState(prev => ({ ...prev, isSubscribed }));
      }

      setState(prev => ({ ...prev, isLoading: false }));
    };

    init();
  }, [checkSupport, registerServiceWorker, checkSubscriptionStatus]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggleSubscription: state.isSubscribed ? unsubscribe : subscribe,
  };
};
