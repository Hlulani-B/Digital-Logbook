-- Supabase SQL: Account Deletion RPC Function
-- Run this in your Supabase SQL Editor to enable account deletion
-- https://supabase.com/dashboard/project/_/sql

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete user data from your tables first (add your own tables here)
  -- DELETE FROM public.entries WHERE user_id = auth.uid();
  -- DELETE FROM public.projects WHERE user_id = auth.uid();
  
  -- Delete the user's auth account
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
