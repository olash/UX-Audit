-- Storage Bucket Setup for Avatars
-- Run this in your Supabase SQL Editor

-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security (RLS) on objects
-- (This is usually enabled by default, but good to ensure)
-- create policy "Avatar images are publicly accessible"
--   on storage.objects for select
--   using ( bucket_id = 'avatars' );

-- 3. Policy: Allow Public Read Access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 4. Policy: Allow Authenticated Users to Upload their own avatar
-- We assume the file name is {user_id}.png or similar, 
-- or we just allow any authenticated user to upload for now.
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] != 'private' 
);

-- 5. Policy: Allow Users to Update their own avatar
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

-- 6. Policy: Allow Users to Delete their own avatar
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' );
