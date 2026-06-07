import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTracker } from "@/hooks/useSessionTracker";

export type UserRole = "admin" | "user" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  isAdmin: false,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const { createSession } = useSessionTracker();
  const sessionCreatedForUser = useRef<string | null>(null);

  const fetchUserRole = async (userId: string | null) => {
    if (!userId) {
      setRole(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
        setRole(data?.role || null);
      }
    } catch (error) {
      console.error("Error:", error);
      setRole(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Defer async calls to avoid deadlock
      if (session?.user?.id) {
        const userId = session.user.id;
        
        setTimeout(() => {
          if (isMounted) {
            fetchUserRole(userId);
          }
        }, 0);

        // Create session record for OAuth logins (SIGNED_IN event after redirect)
        // Only create once per user to avoid duplicates
        if (event === "SIGNED_IN" && sessionCreatedForUser.current !== userId) {
          const existingToken = localStorage.getItem("current_session_token");
          // Only create if no session token exists (OAuth redirect case)
          if (!existingToken) {
            sessionCreatedForUser.current = userId;
            setTimeout(() => {
              if (isMounted) {
                createSession(userId);
              }
            }, 0);
          }
        }
      } else {
        setRole(null);
        sessionCreatedForUser.current = null;
      }
    });

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (session) {
          setSession(session);
          setUser(session.user);
          await fetchUserRole(session.user.id);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    session,
    role,
    isAdmin: role === "admin",
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
