CREATE TABLE public.ugc_characters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100), image_paths text[] NOT NULL CHECK (cardinality(image_paths) BETWEEN 1 AND 3), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_characters TO authenticated;
GRANT ALL ON public.ugc_characters TO service_role;
ALTER TABLE public.ugc_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own characters only" ON public.ugc_characters FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM unnest(image_paths) p WHERE split_part(p, '/', 1) <> auth.uid()::text));
CREATE INDEX ugc_characters_user_id_idx ON public.ugc_characters(user_id);