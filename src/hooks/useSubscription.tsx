import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export const useSubscription = () => {
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Admins don't need subscriptions
        if (isAdmin) {
          setHasActiveSubscription(true);
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasActiveSubscription(false);
          setLoading(false);
          return;
        }

        // Check for active subscription
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status, renew_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setHasActiveSubscription(false);
        } else {
          // Check if subscription is still valid (not expired)
          const renewDate = new Date(data.renew_date);
          const now = new Date();
          setHasActiveSubscription(renewDate > now);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasActiveSubscription(false);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      checkSubscription();
    }
  }, [isAdmin, roleLoading]);

  return { hasActiveSubscription, loading: loading || roleLoading };
};
