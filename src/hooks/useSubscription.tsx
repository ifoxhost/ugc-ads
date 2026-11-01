import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { canGenerate } from "@/components/ugc/studio-rules";

export const useSubscription = () => {
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    let current = true;
    const checkSubscription = async () => {
      try {
        // Admins don't need subscriptions
        if (isAdmin) {
          if (current) { setHasActiveSubscription(true); setLoading(false); }
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (current) { setHasActiveSubscription(false); setLoading(false); }
          return;
        }

        // Check for active subscription
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status, renew_date, credits, credits_used')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          if (current) setHasActiveSubscription(false);
        } else {
          // Check if subscription is still valid (not expired)
          if (current) setHasActiveSubscription(canGenerate(data, false));
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        if (current) setHasActiveSubscription(false);
      } finally {
        if (current) setLoading(false);
      }
    };

    if (!roleLoading && !authLoading) {
      checkSubscription();
    }
    return () => { current = false; };
  }, [isAdmin, roleLoading, authLoading, authUser?.id]);

  return { hasActiveSubscription, loading: loading || roleLoading || authLoading };
};
