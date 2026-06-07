import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRateLimit } from "@/hooks/useRateLimit";
import { Eye, EyeOff, Check, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    isLocked, 
    lockMessage, 
    remainingAttempts,
    checkRateLimit, 
    recordFailedAttempt, 
    recordSuccessfulLogin 
  } = useRateLimit();

  const passwordRequirements = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    length: password.length >= 8,
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

  // Check rate limit when email changes (debounced)
  useEffect(() => {
    if (email && email.includes("@")) {
      const timeout = setTimeout(() => {
        checkRateLimit(email);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [email, checkRateLimit]);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (!allRequirementsMet) {
      toast({
        title: "Password requirements not met",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    // Check rate limit before attempting signup
    const allowed = await checkRateLimit(email);
    if (!allowed) {
      toast({
        title: "Too many attempts",
        description: lockMessage || "Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/create`,
        },
      });

      if (error) {
        // Record failed attempt for signup failures
        await recordFailedAttempt(email);
        throw error;
      }

      // Record successful signup
      await recordSuccessfulLogin(email);

      toast({
        title: "Welcome to Lyric A Vid! 🎵",
        description: "Check your email to verify your account, then log in to start creating.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/create`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-background py-20 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-12">
          <Link to="/" className="inline-flex items-center justify-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-foreground">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </Link>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-tight font-semibold mb-2">Join SongDoe</h1>
        </div>

        {isLocked && lockMessage && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{lockMessage}</AlertDescription>
          </Alert>
        )}

        {!isLocked && remainingAttempts !== null && remainingAttempts <= 2 && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-600 dark:text-yellow-400">
              {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before temporary lockout.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleEmailSignup} className="space-y-4 mb-6">
          <div>
            <Label htmlFor="email" className="sr-only">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLocked}
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
              disabled={isLocked}
              className="bg-card border-0 h-14 text-base rounded-xl pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isLocked}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="sr-only">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLocked}
              className="bg-card border-0 h-14 text-base rounded-xl"
            />
          </div>

          <div className="space-y-2 py-2">
            {[
              { key: 'lowercase', text: 'Contains at least 1 lowercase letter' },
              { key: 'uppercase', text: 'Contains at least 1 uppercase letter' },
              { key: 'number', text: 'Contains at least 1 number' },
              { key: 'special', text: 'Contains at least 1 special character' },
              { key: 'length', text: 'Is at least 8 characters long' },
            ].map(({ key, text }) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center",
                  passwordRequirements[key as keyof typeof passwordRequirements]
                    ? "bg-primary"
                    : "bg-muted"
                )}>
                  {passwordRequirements[key as keyof typeof passwordRequirements] && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className={cn(
                  "transition-colors",
                  passwordRequirements[key as keyof typeof passwordRequirements]
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          <Button
            type="submit"
            disabled={loading || isLocked}
            className="w-full h-14 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-base"
          >
            {loading ? "Creating account..." : isLocked ? "Too Many Attempts" : "Create an account"}
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-1">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
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
          onClick={handleGoogleSignup}
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
          <span className="text-muted-foreground">Already have an account? </span>
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
