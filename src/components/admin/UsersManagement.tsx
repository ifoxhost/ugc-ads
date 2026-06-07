import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, History, X, RotateCcw, Ban, CalendarPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: "admin" | "user" | null;
  subscription?: {
    plan_id: string;
    status: string;
    credits: number;
    credits_used: number;
    renew_date: string;
  } | null;
}

interface Transaction {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_id: string;
  created_at: string;
  metadata: unknown;
}

export const UsersManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [resettingCredits, setResettingCredits] = useState<string | null>(null);
  const [resetCreditsDialogOpen, setResetCreditsDialogOpen] = useState(false);
  const [userToResetCredits, setUserToResetCredits] = useState<UserData | null>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState<string | null>(null);
  const [cancelSubscriptionDialogOpen, setCancelSubscriptionDialogOpen] = useState(false);
  const [userToCancelSubscription, setUserToCancelSubscription] = useState<UserData | null>(null);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [userToExtend, setUserToExtend] = useState<UserData | null>(null);
  const [extendDays, setExtendDays] = useState<string>("30");
  const [extending, setExtending] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) {
        return false;
      }
      
      // Date range filter
      const txDate = new Date(tx.created_at);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (txDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (txDate > toDate) return false;
      }
      
      return true;
    });
  }, [transactions, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const plans = [
    { id: "starter", name: "Starter", credits: 20, amount: 199 },
    { id: "pro", name: "Pro", credits: 100, amount: 499 },
    { id: "studio", name: "Studio", credits: 400, amount: 1299 },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profiles) {
        const usersWithRoles = await Promise.all(
          profiles.map(async (profile) => {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", profile.id)
              .single();

            const { data: subscriptionData } = await supabase
              .from("subscriptions")
              .select("plan_id, status, credits, credits_used, renew_date")
              .eq("user_id", profile.id)
              .eq("status", "active")
              .maybeSingle();

            return {
              ...profile,
              role: roleData?.role || null,
              subscription: subscriptionData,
            };
          })
        );

        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    try {
      // Delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const handleAssignPlan = async () => {
    if (!selectedUser || !selectedPlan) return;
    
    setAssigning(true);
    try {
      const plan = plans.find(p => p.id === selectedPlan);
      if (!plan) throw new Error("Plan not found");

      // Check if user already has a subscription
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", selectedUser.id)
        .maybeSingle();

      if (existingSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            amount: plan.amount,
            credits: plan.credits,
            credits_used: 0,
            status: "active",
            renew_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", existingSubscription.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from("subscriptions")
          .insert({
            user_id: selectedUser.id,
            plan_id: plan.id,
            amount: plan.amount,
            credits: plan.credits,
            credits_used: 0,
            status: "active",
            renew_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: "Plan assigned",
        description: `${plan.name} plan assigned to ${selectedUser.email}`,
      });

      setAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedPlan("");
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign plan",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const fetchTransactions = async (userId: string) => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleViewTransactions = (user: UserData) => {
    setSelectedUser(user);
    setTransactionsDialogOpen(true);
    clearFilters();
    setCurrentPage(1);
    fetchTransactions(user.id);
  };

  const openResetCreditsDialog = (user: UserData) => {
    setUserToResetCredits(user);
    setResetCreditsDialogOpen(true);
  };

  const handleResetCredits = async () => {
    if (!userToResetCredits?.subscription) return;
    
    setResettingCredits(userToResetCredits.id);
    setResetCreditsDialogOpen(false);
    
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ credits_used: 0 })
        .eq("user_id", userToResetCredits.id)
        .eq("status", "active");

      if (error) throw error;

      toast({
        title: "Credits reset",
        description: `Credits reset for ${userToResetCredits.email}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset credits",
        variant: "destructive",
      });
    } finally {
      setResettingCredits(null);
      setUserToResetCredits(null);
    }
  };

  const openCancelSubscriptionDialog = (user: UserData) => {
    setUserToCancelSubscription(user);
    setCancelSubscriptionDialogOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!userToCancelSubscription?.subscription) return;
    
    setCancellingSubscription(userToCancelSubscription.id);
    setCancelSubscriptionDialogOpen(false);
    
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userToCancelSubscription.id)
        .eq("status", "active");

      if (error) throw error;

      toast({
        title: "Subscription cancelled",
        description: `Subscription cancelled for ${userToCancelSubscription.email}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setCancellingSubscription(null);
      setUserToCancelSubscription(null);
    }
  };

  const openExtendDialog = (user: UserData) => {
    setUserToExtend(user);
    setExtendDays("30");
    setExtendDialogOpen(true);
  };

  const handleExtendSubscription = async () => {
    if (!userToExtend?.subscription) return;
    
    const days = parseInt(extendDays);
    if (isNaN(days) || days <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number of days",
        variant: "destructive",
      });
      return;
    }
    
    setExtending(true);
    setExtendDialogOpen(false);
    
    try {
      // Get current subscription to find the renew_date
      const { data: subscription, error: fetchError } = await supabase
        .from("subscriptions")
        .select("renew_date")
        .eq("user_id", userToExtend.id)
        .eq("status", "active")
        .single();

      if (fetchError) throw fetchError;

      const currentRenewDate = new Date(subscription.renew_date);
      const newRenewDate = new Date(currentRenewDate.getTime() + days * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from("subscriptions")
        .update({ renew_date: newRenewDate.toISOString() })
        .eq("user_id", userToExtend.id)
        .eq("status", "active");

      if (error) throw error;

      toast({
        title: "Subscription extended",
        description: `Extended subscription for ${userToExtend.email} by ${days} days`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to extend subscription",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
      setUserToExtend(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users Management</CardTitle>
        <CardDescription>Manage user accounts and roles</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.full_name || "-"}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role || "user"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.subscription ? (
                    <Badge variant="outline" className="capitalize">
                      {user.subscription.plan_id}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.subscription ? (
                    <span className="text-sm">
                      {user.subscription.credits - user.subscription.credits_used}/{user.subscription.credits}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.subscription?.renew_date ? (() => {
                    const renewDate = new Date(user.subscription.renew_date);
                    const now = new Date();
                    const daysUntilExpiry = Math.ceil((renewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
                    const isExpired = daysUntilExpiry <= 0;
                    
                    return (
                      <span className={`text-sm ${isExpired ? 'text-destructive font-medium' : isExpiringSoon ? 'text-orange-500 font-medium' : ''}`}>
                        {renewDate.toLocaleDateString()}
                        {isExpired && <span className="ml-1 text-xs">(expired)</span>}
                        {isExpiringSoon && <span className="ml-1 text-xs">({daysUntilExpiry}d left)</span>}
                      </span>
                    );
                  })() : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role || "user"}
                      onValueChange={(value: "admin" | "user") => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setSelectedPlan(user.subscription?.plan_id || "");
                        setAssignDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Plan
                    </Button>
                    {user.subscription && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openResetCreditsDialog(user)}
                        disabled={resettingCredits === user.id}
                        title="Reset credits"
                      >
                        {resettingCredits === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    {user.subscription && user.subscription.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openExtendDialog(user)}
                        disabled={extending && userToExtend?.id === user.id}
                        title="Extend subscription"
                      >
                        {extending && userToExtend?.id === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarPlus className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    {user.subscription && user.subscription.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openCancelSubscriptionDialog(user)}
                        disabled={cancellingSubscription === user.id}
                        title="Cancel subscription"
                      >
                        {cancellingSubscription === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewTransactions(user)}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Plan</DialogTitle>
            <DialogDescription>
              Assign a subscription plan to {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - R{plan.amount} ({plan.credits} credits)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogOpen(false);
                setSelectedUser(null);
                setSelectedPlan("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignPlan}
              disabled={!selectedPlan || assigning}
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              Viewing transactions for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 pb-2 border-b">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleFilterChange(setDateFrom, e.target.value)}
                className="w-36 h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleFilterChange(setDateTo, e.target.value)}
                className="w-36 h-9"
              />
            </div>
            {(statusFilter !== "all" || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          
          {loadingTransactions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for this user.
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions match the current filters.
            </div>
          ) : (
            <div className="space-y-4">
              <ScrollArea className="max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="font-medium">
                          R{Number(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(tx.status)}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {tx.payment_method || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-32">
                          {tx.payment_id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTransactionsDialogOpen(false);
                setSelectedUser(null);
                setTransactions([]);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Credits Confirmation Dialog */}
      <AlertDialog open={resetCreditsDialogOpen} onOpenChange={setResetCreditsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Credits</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset credits for {userToResetCredits?.email}? This will set their used credits back to 0, giving them full access to their plan's credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToResetCredits(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResetCredits}>
              Reset Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Confirmation Dialog */}
      <AlertDialog open={cancelSubscriptionDialogOpen} onOpenChange={setCancelSubscriptionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the subscription for {userToCancelSubscription?.email}? They will lose access to their remaining credits and plan benefits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToCancelSubscription(null)}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Subscription Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Subscription</DialogTitle>
            <DialogDescription>
              Extend the subscription renewal date for {userToExtend?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="extend-days">Number of days to extend</Label>
              <Input
                id="extend-days"
                type="number"
                min="1"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="flex gap-2">
              {[7, 14, 30, 60, 90].map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant={extendDays === String(days) ? "default" : "outline"}
                  onClick={() => setExtendDays(String(days))}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExtendDialogOpen(false);
                setUserToExtend(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleExtendSubscription} disabled={extending}>
              {extending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extending...
                </>
              ) : (
                "Extend Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
