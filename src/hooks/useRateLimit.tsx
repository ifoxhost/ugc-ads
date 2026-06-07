import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RateLimitResponse {
  allowed: boolean;
  remaining_attempts?: number;
  locked_until?: string;
  message?: string;
}

export const useRateLimit = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const checkRateLimit = useCallback(async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("check-rate-limit", {
        body: { email, action: "check" },
      });

      if (error) {
        console.error("Rate limit check error:", error);
        return true; // Fail open
      }

      const response = data as RateLimitResponse;
      
      if (!response.allowed) {
        setIsLocked(true);
        setLockMessage(response.message || "Too many attempts. Please try again later.");
        return false;
      }

      setIsLocked(false);
      setLockMessage(null);
      setRemainingAttempts(response.remaining_attempts ?? null);
      return true;
    } catch (error) {
      console.error("Rate limit check failed:", error);
      return true; // Fail open for availability
    }
  }, []);

  const recordFailedAttempt = useCallback(async (email: string): Promise<RateLimitResponse | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("check-rate-limit", {
        body: { email, action: "record_attempt" },
      });

      if (error) {
        console.error("Record attempt error:", error);
        return null;
      }

      const response = data as RateLimitResponse;
      
      if (!response.allowed) {
        setIsLocked(true);
        setLockMessage(response.message || "Too many attempts. Please try again later.");
      } else {
        setRemainingAttempts(response.remaining_attempts ?? null);
      }

      return response;
    } catch (error) {
      console.error("Record attempt failed:", error);
      return null;
    }
  }, []);

  const recordSuccessfulLogin = useCallback(async (email: string): Promise<void> => {
    try {
      await supabase.functions.invoke("check-rate-limit", {
        body: { email, action: "record_success" },
      });
      
      setIsLocked(false);
      setLockMessage(null);
      setRemainingAttempts(null);
    } catch (error) {
      console.error("Record success failed:", error);
    }
  }, []);

  const resetState = useCallback(() => {
    setIsLocked(false);
    setLockMessage(null);
    setRemainingAttempts(null);
  }, []);

  return {
    isLocked,
    lockMessage,
    remainingAttempts,
    checkRateLimit,
    recordFailedAttempt,
    recordSuccessfulLogin,
    resetState,
  };
};