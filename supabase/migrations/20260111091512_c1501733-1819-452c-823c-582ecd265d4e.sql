-- Add demographics column to user_prompt_presets table
ALTER TABLE public.user_prompt_presets 
ADD COLUMN demographics JSONB DEFAULT NULL;