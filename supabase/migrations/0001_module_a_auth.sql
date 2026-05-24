-- ============================================================================
-- OXV App — Module A : Migration SQL
-- À exécuter dans Supabase SQL Editor
-- Date : 14 mai 2026
-- ============================================================================

-- Extension de la table users existante (du site oxvehicle.fr)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_handle TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pilot_level TEXT 
  CHECK (pilot_level IN ('debutant', 'intermediaire', 'confirme', 'expert'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS ffsa_license TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years TEXT
  CHECK (experience_years IN ('<1', '1-2', '3-5', '5-10', '10+'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT
  CHECK (emergency_contact_relation IN ('conjoint', 'parent', 'enfant', 'ami', 'autre'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_type TEXT
  CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Index pour recherche par handle
CREATE INDEX IF NOT EXISTS idx_users_public_handle ON users(public_handle);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Lecture : un user voit son propre profil
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Mise à jour : un user peut modifier son propre profil
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertion : un user peut créer son propre profil (utilisé après Sign in with Apple par ex)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Trigger : créer un profil dans `users` à chaque inscription Supabase Auth
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Storage : bucket pour les avatars
-- ============================================================================

-- À exécuter via le dashboard Supabase si pas déjà fait :
-- 1. Aller dans Storage → New bucket
-- 2. Nom : avatars
-- 3. Public bucket : Oui
-- 4. File size limit : 5 MB
-- 5. Allowed MIME types : image/jpeg, image/png, image/heic

-- Policies (à exécuter ici quand le bucket existe) :
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
