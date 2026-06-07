// This hook is deprecated - use useAuth from @/contexts/AuthContext instead
// Kept for backward compatibility with existing components

import { useAuth, UserRole } from "@/contexts/AuthContext";

export type { UserRole };

export const useUserRole = () => {
  const { role, loading, isAdmin } = useAuth();
  return { role, loading, isAdmin };
};
