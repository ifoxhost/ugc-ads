import BrandMark from "@/components/ugc/BrandMark";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Library, HelpCircle, UserCircle, LogOut, LayoutDashboard, Shield, Video, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/hooks/useUser";
import NotificationBell from "@/components/NotificationBell";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { user, getUserInitials, getUserEmail, getUserAvatarUrl, getUserDisplayName } = useUser();
  const isHomePage = location.pathname === "/";
  const [isScrolled, setIsScrolled] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out successfully" });
    navigate("/");
  };

  useEffect(() => {
    if (!isHomePage) return;
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  if (isHomePage) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 h-14 sm:h-[72px] z-50 flex items-center justify-between px-3 sm:px-8 transition-all duration-300 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-lg border-b border-border"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0" aria-label="UGC Ads Studio">
          <BrandMark />
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ">
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground text-[15px] font-medium px-4 py-2 rounded-full hover:bg-secondary transition-all">Pricing</Link>
          <Link to="/about" className="text-muted-foreground hover:text-foreground text-[15px] font-medium px-4 py-2 rounded-full hover:bg-secondary transition-all">About</Link>
          <Link to="/help" className="text-muted-foreground hover:text-foreground text-[15px] font-medium px-4 py-2 rounded-full hover:bg-secondary transition-all">Help</Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {!user && (
            <>
              <Button variant="ghost" className="rounded-full text-foreground hover:bg-secondary border border-border h-8 sm:h-10 px-3 sm:px-5 text-xs sm:text-[14px] font-medium whitespace-nowrap" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground h-8 sm:h-10 px-3 sm:px-5 text-xs sm:text-[14px] font-semibold whitespace-nowrap" asChild>
                <Link to="/create">Create Ad</Link>
              </Button>
            </>
          )}
          {user && (
            <>
              <Button className="hidden sm:flex rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-5 text-[14px] gap-1.5" asChild>
                <Link to="/create"><Video className="h-4 w-4" /> Create Ad</Link>
              </Button>
              <NotificationBell variant="dark" />
              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none">
                  <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border-2 border-border hover:border-primary/60 transition-colors cursor-pointer">
                    <AvatarImage src={getUserAvatarUrl() || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium text-xs sm:text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background border-border z-50">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground">{getUserEmail()}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer"><Shield className="mr-2 h-4 w-4" />Admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                   <Link to="/library" className="cursor-pointer"><Library className="mr-2 h-4 w-4" />Ad Library</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/notifications" className="cursor-pointer"><Bell className="mr-2 h-4 w-4" />Notifications</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="cursor-pointer"><UserCircle className="mr-2 h-4 w-4" />Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/help" className="cursor-pointer"><HelpCircle className="mr-2 h-4 w-4" />Help</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 sm:left-16 right-0 h-14 sm:h-16 bg-background border-b border-border z-40 flex items-center justify-between px-3 sm:px-8 overflow-x-hidden">
      <Link to="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" aria-label="UGC Ads Studio Home">
        <BrandMark />
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <Button variant="ghost" className="hidden sm:flex rounded-full" asChild>
          <Link to="/pricing">Pricing</Link>
        </Button>
        {!user && (
          <Button variant="ghost" className="rounded-full border border-border h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap" asChild>
            <Link to="/login">Log in</Link>
          </Button>
        )}
        {user && (
          <>
            <Button className="hidden sm:flex rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5" asChild>
              <Link to="/create"><Video className="h-4 w-4" /> Create Ad</Link>
            </Button>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border-2 border-border hover:border-primary/50 transition-colors cursor-pointer">
                  <AvatarImage src={getUserAvatarUrl() || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium text-xs sm:text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background border-border z-50">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                    <p className="text-xs leading-none text-muted-foreground">{getUserEmail()}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer"><Shield className="mr-2 h-4 w-4" />Admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                 <Link to="/library" className="cursor-pointer"><Library className="mr-2 h-4 w-4" />Ad Library</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="cursor-pointer"><Bell className="mr-2 h-4 w-4" />Notifications</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" className="cursor-pointer"><UserCircle className="mr-2 h-4 w-4" />Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/help" className="cursor-pointer"><HelpCircle className="mr-2 h-4 w-4" />Help</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
