import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface CancelSubscriptionDialogProps {
  renewDate: string;
  planName: string;
  creditsRemaining: number;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export const CancelSubscriptionDialog = ({
  renewDate,
  planName,
  creditsRemaining,
  onConfirm,
  isLoading = false,
}: CancelSubscriptionDialogProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="flex-1">
          Cancel Subscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Subscription?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Are you sure you want to cancel your <span className="font-semibold capitalize">{planName}</span> subscription?
              </p>
              
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Access until: <span className="font-medium text-foreground">{format(new Date(renewDate), "MMMM d, yyyy")}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Remaining credits: <span className="font-medium text-foreground">{creditsRemaining}</span>
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>You'll keep access until {format(new Date(renewDate), "MMM d")}</li>
                  <li>Use your remaining {creditsRemaining} credits before then</li>
                  <li>No future charges will be made</li>
                  <li>You can resubscribe anytime</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-row gap-2">
          <AlertDialogCancel className="flex-1">Keep Subscription</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Cancelling..." : "Yes, Cancel"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
