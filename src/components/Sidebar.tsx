import { useState, useEffect } from "react";
import { Library, HelpCircle, User, Home, Wand2, LogIn, Shield, LayoutDashboard, Trash2, Sparkles } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/hooks/useUser";
import { useCreateSubmit } from "@/hooks/useCreateSubmit";

const LyricAVidLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary-foreground">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const Sidebar = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { user, getUserInitials } = useUser();
  const { triggerSubmit } = useCreateSubmit();
  
  const isOnCreatePage = location.pathname === "/create";
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Show tooltip briefly when landing on /create page
  useEffect(() => {
    if (isOnCreatePage && isMobile) {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnCreatePage, isMobile]);
  
  const handleCreateClick = (e: React.MouseEvent) => {
    if (isOnCreatePage) {
      e.preventDefault();
      triggerSubmit();
    }
  };

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/create", icon: Wand2, label: "Create" },
    { to: "/library", icon: Library, label: "Library" },
    { to: "/trash", icon: Trash2, label: "Trash" },
    { to: "/help", icon: HelpCircle, label: "Help" },
    { to: "/account", icon: User, label: "Account" },
  ];

  const dashboardItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/create", icon: Wand2, label: "Create" },
    { to: "/library", icon: Library, label: "Library" },
    { to: "/trash", icon: Trash2, label: "Trash" },
    { to: "/help", icon: HelpCircle, label: "Help" },
    { to: "/account", icon: User, label: "Account" },
  ];

  const adminItem = { to: "/admin", icon: Shield, label: "Admin" };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Mobile Bottom Navigation
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 z-50 md:hidden">
        {/* Home */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
              isActive ? "bg-primary/20 text-primary" : "text-muted-foreground"
            )
          }
        >
          <Home className="h-6 w-6" />
        </NavLink>

        {/* Create - triggers form submit if already on /create page */}
        <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
          <TooltipTrigger asChild>
            <NavLink
              to="/create"
              onClick={handleCreateClick}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center w-14 h-14 rounded-full transition-all",
                  isActive 
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg ring-2 ring-primary/50 ring-offset-2 ring-offset-background animate-pulse" 
                    : "bg-primary/80 text-primary-foreground shadow-lg hover:bg-primary"
                )
              }
            >
              {isOnCreatePage ? (
                <Sparkles className="h-6 w-6 animate-bounce" />
              ) : (
                <Wand2 className="h-6 w-6" />
              )}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-primary text-primary-foreground border-primary px-3 py-2"
          >
            <p className="text-sm font-medium">Tap to generate your video!</p>
          </TooltipContent>
        </Tooltip>

        {/* User Avatar / Login */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center">
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {getUserInitials(1)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2 w-48">
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate(adminItem.to)}>
                    <adminItem.icon className="h-4 w-4 mr-2" />
                    {adminItem.label}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {dashboardItems.map((item) => (
                <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)}>
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogIn className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <LogIn className="h-6 w-6" />
          </button>
        )}
      </nav>
    );
  }

  // Desktop Sidebar
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 bg-card border-r border-border flex-col items-center py-6 z-50">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <LyricAVidLogo />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-6">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group",
                isActive
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-card border border-border rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {item.label}
            </span>
          </NavLink>
        ))}
        
        {/* Admin Link (only for admins) */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group",
                isActive
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )
            }
          >
            <Shield className="h-5 w-5" />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-card border border-border rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Admin
            </span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
