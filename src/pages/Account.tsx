import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, User, Lock, AlertCircle, CreditCard, Check, Calendar, TrendingUp, Bell, ChevronRight, Shield } from "lucide-react";
import SessionManagement from "@/components/account/SessionManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const profileSchema = z.object({
  full_name: z.string().max(100, "Name must be less than 100 characters").optional(),
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const Account = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { revokeAllOtherSessions } = useSessionTracker();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      email: "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    loadUserData();
  }, []);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('account-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          // Reload subscription data
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single();

          setSubscription(subData);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          // Reload transaction history
          const { data: txData } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

          setTransactions(txData || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        navigate("/login");
        return;
      }

      setUser(user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
        return;
      }

      setProfile(profileData);
      profileForm.reset({
        full_name: profileData?.full_name || "",
        email: profileData?.email || user.email || "",
      });

      // Load subscription data
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      setSubscription(subData);

      // Load transaction history
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setTransactions(txData || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          email: data.email,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      loadUserData();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      // Revoke all other sessions for security
      const { success, count } = await revokeAllOtherSessions(user.id);

      if (success && count > 0) {
        toast({
          title: "Password Updated",
          description: `Password changed successfully. ${count} other session${count > 1 ? 's' : ''} logged out for security.`,
        });
      } else {
        toast({
          title: "Success",
          description: "Password updated successfully",
        });
      }

      passwordForm.reset();
      // Refresh session management component
      setSessionRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account preferences and settings</p>

        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscription" className="space-y-6">
            {/* Current Plan Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>
                      Manage your subscription and billing
                    </CardDescription>
                  </div>
                  {subscription && (
                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                      {subscription.status === 'active' ? 'Active' : subscription.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {subscription ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Plan</Label>
                        <p className="text-2xl font-bold capitalize">{subscription.plan_id}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Monthly Cost</Label>
                        <p className="text-2xl font-bold">R{subscription.amount}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Renewal Date
                        </Label>
                        <p className="text-lg font-semibold">
                          {new Date(subscription.renew_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">Credits Usage</Label>
                        <span className="text-sm font-medium">
                          {subscription.credits - subscription.credits_used} / {subscription.credits} remaining
                        </span>
                      </div>
                      <Progress 
                        value={((subscription.credits - subscription.credits_used) / subscription.credits) * 100} 
                        className="h-2"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        onClick={() => navigate("/pricing")}
                        className="flex-1"
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Upgrade Plan
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No Active Subscription</p>
                    <p className="text-muted-foreground mb-6">
                      Subscribe to a plan to start generating content
                    </p>
                    <Button onClick={() => navigate("/pricing")}>
                      View Plans
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Plans Card */}
            <Card>
              <CardHeader>
                <CardTitle>Available Plans</CardTitle>
                <CardDescription>
                  Choose a plan that fits your needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'starter', name: 'Starter', price: 'R199', credits: 20, features: ['20 generations', 'SD downloads', 'Basic voices', 'Email support'] },
                    { id: 'pro', name: 'Pro', price: 'R499', credits: 100, features: ['100 generations', 'HD video ads', 'Script generator', 'Priority support'], popular: true },
                    { id: 'studio', name: 'Studio', price: 'R1,299', credits: 400, features: ['400 generations', 'Multi-brand', 'Premium voices', '24h support'] },
                  ].map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative border rounded-lg p-6 ${
                        subscription?.plan_id === plan.id
                          ? 'border-primary bg-primary/5'
                          : plan.popular
                          ? 'border-primary/50'
                          : 'border-border'
                      }`}
                    >
                      {plan.popular && (
                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                          Popular
                        </Badge>
                      )}
                      {subscription?.plan_id === plan.id && (
                        <Badge variant="secondary" className="absolute -top-2 right-2">
                          Current
                        </Badge>
                      )}
                      <div className="mb-4">
                        <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.credits} credits per month
                        </p>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={subscription?.plan_id === plan.id ? 'secondary' : 'default'}
                        className="w-full"
                        disabled={subscription?.plan_id === plan.id}
                        onClick={() => navigate("/pricing")}
                      >
                        {subscription?.plan_id === plan.id ? 'Current Plan' : 'Select Plan'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Transaction History */}
            {transactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    Your billing history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium capitalize">{tx.metadata?.plan_name || 'Subscription'}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">R{tx.amount}</p>
                          <Badge variant={tx.status === 'success' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your account profile information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Account Created</Label>
                      <Input
                        value={new Date(profile?.created_at).toLocaleDateString()}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={profileForm.formState.isSubmitting}
                      className="w-full"
                    >
                      {profileForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Profile"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Notification Preferences Link */}
            <Card 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate("/account/notifications")}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Notification Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage email notifications and alerts
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your account password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        For security, changing your password will automatically log you out of all other active sessions.
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={passwordForm.formState.isSubmitting}
                      className="w-full"
                    >
                      {passwordForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <SessionManagement refreshKey={sessionRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;
