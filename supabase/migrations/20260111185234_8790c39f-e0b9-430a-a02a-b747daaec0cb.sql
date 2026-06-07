-- Drop the incomplete admin policy
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;

-- Create a proper admin INSERT policy with with_check
CREATE POLICY "Admins can insert any subscription"
ON public.subscriptions
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create a proper admin UPDATE policy
CREATE POLICY "Admins can update any subscription"
ON public.subscriptions
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create a proper admin DELETE policy
CREATE POLICY "Admins can delete any subscription"
ON public.subscriptions
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));