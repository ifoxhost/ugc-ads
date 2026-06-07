import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  // Check if email is verified
  const isEmailVerified = user?.email_confirmed_at != null;

  // Don't show if no user, email is verified, or banner was dismissed
  if (!user || isEmailVerified || dismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!user.email) return;
    
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 truncate">
              <span className="font-medium">Verify your email</span>
              <span className="hidden sm:inline"> to unlock all features. Check your inbox for the verification link.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendVerification}
              disabled={sending}
              className="text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${sending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{sending ? "Sending..." : "Resend"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              className="text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
