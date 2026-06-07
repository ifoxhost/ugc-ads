import { useAuth } from "@/contexts/AuthContext";

export const useUser = () => {
  const { user, session, loading } = useAuth();

  const getUserInitials = (length: number = 2): string => {
    if (!user) return "U";
    
    // Try full name from metadata first
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
    if (fullName) {
      const names = fullName.trim().split(" ");
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, length).toUpperCase();
    }
    
    // Fall back to email
    if (user.email) {
      return user.email.substring(0, length).toUpperCase();
    }
    
    return "U";
  };

  const getUserDisplayName = (): string => {
    if (!user) return "User";
    
    // Try full name from metadata
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
    if (fullName) return fullName;
    
    // Fall back to email username
    if (user.email) {
      return user.email.split("@")[0];
    }
    
    return "User";
  };

  const getUserEmail = (): string => {
    return user?.email || "";
  };

  const getUserAvatarUrl = (): string | null => {
    return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  };

  const getFirstName = (): string => {
    if (!user) return "User";
    
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
    if (fullName) {
      return fullName.split(" ")[0];
    }
    
    if (user.email) {
      return user.email.split("@")[0];
    }
    
    return "User";
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    getUserInitials,
    getUserDisplayName,
    getUserEmail,
    getUserAvatarUrl,
    getFirstName,
  };
};
