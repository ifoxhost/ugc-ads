import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface GuestRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const GuestRoute = ({ 
  children, 
  redirectTo = "/dashboard" 
}: GuestRouteProps) => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to dashboard if already authenticated
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default GuestRoute;
