-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: 1aa605c2-e676-4aa8-941f-457788d1b67f

-- Remove insecure public select policies
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;

DROP POLICY IF EXISTS "Challenge covers are publicly readable" ON storage.objects;

-- Create secure select policies (only owner can list/see metadata)
CREATE POLICY "Users can view their own avatars" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own challenge covers" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'challenge-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure other operations are also properly restricted (already seem to be, but let's re-verify/harden)
-- For avatars
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

CREATE POLICY "Users can upload own avatar" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;

CREATE POLICY "Users can update own avatar" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can delete own avatar" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- For challenge-covers
DROP POLICY IF EXISTS "Users can upload their own challenge covers" ON storage.objects;

CREATE POLICY "Users can upload their own challenge covers" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'challenge-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own challenge covers" ON storage.objects;

CREATE POLICY "Users can update their own challenge covers" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'challenge-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own challenge covers" ON storage.objects;

CREATE POLICY "Users can delete their own challenge covers" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'challenge-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
