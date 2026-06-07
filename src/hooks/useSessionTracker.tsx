import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SessionInfo {
  browser: string;
  os: string;
  deviceInfo: string;
}

const getSessionInfo = (): SessionInfo => {
  const userAgent = navigator.userAgent;
  
  // Detect browser
  let browser = "Unknown";
  if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Edg")) {
    browser = "Edge";
  } else if (userAgent.includes("Chrome")) {
    browser = "Chrome";
  } else if (userAgent.includes("Safari")) {
    browser = "Safari";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    browser = "Opera";
  }

  // Detect OS
  let os = "Unknown";
  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    os = "macOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
  }

  // Detect device type
  let deviceInfo = "Desktop";
  if (/Mobi|Android/i.test(userAgent)) {
    deviceInfo = "Mobile";
  } else if (/Tablet|iPad/i.test(userAgent)) {
    deviceInfo = "Tablet";
  }

  return { browser, os, deviceInfo };
};

const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const useSessionTracker = () => {
  const createSession = useCallback(async (userId: string) => {
    try {
      const { browser, os, deviceInfo } = getSessionInfo();
      const sessionToken = generateSessionToken();
      
      // Store session token in localStorage for current session identification
      localStorage.setItem("current_session_token", sessionToken);

      // First, mark any existing sessions for this user as not current
      await supabase
        .from("user_sessions")
        .update({ is_current: false })
        .eq("user_id", userId);

      // Create new session
      const { error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: userId,
          session_token: sessionToken,
          browser,
          os,
          device_info: deviceInfo,
          is_current: true,
          last_active_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        });

      if (error) {
        console.error("Error creating session:", error);
      }
    } catch (error) {
      console.error("Error tracking session:", error);
    }
  }, []);

  const updateSessionActivity = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem("current_session_token");
      if (!sessionToken) return;

      await supabase
        .from("user_sessions")
        .update({ 
          last_active_at: new Date().toISOString(),
          is_current: true 
        })
        .eq("session_token", sessionToken);
    } catch (error) {
      console.error("Error updating session activity:", error);
    }
  }, []);

  const removeSession = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem("current_session_token");
      if (!sessionToken) return;

      await supabase
        .from("user_sessions")
        .delete()
        .eq("session_token", sessionToken);

      localStorage.removeItem("current_session_token");
    } catch (error) {
      console.error("Error removing session:", error);
    }
  }, []);

  const markCurrentSession = useCallback(async (userId: string) => {
    try {
      const sessionToken = localStorage.getItem("current_session_token");
      if (!sessionToken) return;

      // Mark this session as current
      await supabase
        .from("user_sessions")
        .update({ is_current: true })
        .eq("session_token", sessionToken)
        .eq("user_id", userId);
    } catch (error) {
      console.error("Error marking current session:", error);
    }
  }, []);

  const revokeAllOtherSessions = useCallback(async (userId: string) => {
    try {
      const currentSessionToken = localStorage.getItem("current_session_token");
      if (!currentSessionToken) return { success: false, count: 0 };

      // Delete all sessions except the current one
      const { data, error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", userId)
        .neq("session_token", currentSessionToken)
        .select();

      if (error) {
        console.error("Error revoking other sessions:", error);
        return { success: false, count: 0 };
      }

      return { success: true, count: data?.length || 0 };
    } catch (error) {
      console.error("Error revoking other sessions:", error);
      return { success: false, count: 0 };
    }
  }, []);

  return {
    createSession,
    updateSessionActivity,
    removeSession,
    markCurrentSession,
    revokeAllOtherSessions,
  };
};
