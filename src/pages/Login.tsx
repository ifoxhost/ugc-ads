import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { useSimpleRateLimit } from "@/hooks/useSimpleRateLimit";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LocationState {
  from?: { pathname: string };
}

const REMEMBER_ME_KEY = "ugc_remember_me";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { createSession } = useSessionTracker();
  const { isLocked, lockMessage, checkRateLimit, recordFailedAttempt, recordSuccess } = useSimpleRateLimit();

  // Get the redirect path from location state, default to /create
  const from = (location.state as LocationState)?.from?.pathname || "/create";

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit before attempting login
    if (!checkRateLimit(email)) {
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Record failed attempt
        const result = recordFailedAttempt(email);
        
        let description = error.message || "Invalid email or password.";
        if (result.remaining > 0 && result.remaining <= 3) {
          description += ` ${result.remaining} attempt${result.remaining > 1 ? 's' : ''} remaining.`;
        }
        
        toast({
          title: "Login failed",
          description,
          variant: "destructive",
        });
        return;
      }

      // Record successful login
      recordSuccess(email);

      // Track the session
      if (data.user) {
        await createSession(data.user.id);
      }

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      navigate(from, { replace: true });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Store the redirect path for OAuth callback
    sessionStorage.setItem("authRedirectPath", from);
    
    // Store remember me preference for OAuth
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, "true");
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${from}`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-background py-20 sm:py-0">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-12">
          <Link to="/" className="inline-flex items-center justify-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-foreground">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </Link>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-tight font-semibold mb-2">Welcome to SongDoe</h1>
        </div>

        {isLocked && lockMessage && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{lockMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
          <div>
            <Label htmlFor="email" className="sr-only">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-card border-0 h-14 text-base rounded-xl"
            />
          </div>

          <div className="relative">
            <Label htmlFor="password" className="sr-only">Password</Label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-card border-0 h-14 text-base rounded-xl pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label 
                htmlFor="remember-me" 
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Remember me
              </Label>
            </div>
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading || isLocked}
            className="w-full h-14 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-base"
          >
            {loading ? "Signing in..." : "Sign in with e-mail"}
          </Button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-background text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full h-14 rounded-xl border-border hover:bg-card font-medium text-base"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </Button>

        <div className="mt-8 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Sign up now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

