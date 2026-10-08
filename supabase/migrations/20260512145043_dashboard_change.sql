-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: 77a685fa-1097-4f4a-8a59-6ddd1061b541

-- Create subscriptions table
CREATE TABLE public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT CHECK (plan IN ('monthly', 'annual')),
    status TEXT CHECK (status IN ('trialing', 'active', 'cancelled', 'past_due', 'disputed', 'refunded')),
    trial_end TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Users can view their own subscription" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- Update profiles table to include subscription info
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create function to update profile subscription status
CREATE OR REPLACE FUNCTION public.handle_subscription_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        subscription_status = NEW.status,
        stripe_customer_id = NEW.stripe_customer_id,
        updated_at = now()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription updates
CREATE TRIGGER on_subscription_change
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_subscription_update();

-- Create updated_at trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
