import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionTracker } from "@/hooks/useSessionTracker";

const SESSION_ACTIVITY_INTERVAL = 5 * 60 * 1000; // 5 minutes

const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { updateSessionActivity } = useSessionTracker();
  const lastActivityUpdate = useRef<number>(0);

  // Update session activity periodically when user is logged in
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastActivityUpdate.current > SESSION_ACTIVITY_INTERVAL) {
        lastActivityUpdate.current = now;
        updateSessionActivity();
      }
    };

    // Update on user interaction
    const handleActivity = () => {
      updateActivity();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Also set up interval for background updates
    const intervalId = setInterval(updateActivity, SESSION_ACTIVITY_INTERVAL);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(intervalId);
    };
  }, [user, updateSessionActivity]);

  return <>{children}</>;
};

export default SessionProvider;
