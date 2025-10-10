/*
  # Crear tabla de conexiones Git/GitHub

  1. Nueva Tabla
    - `git_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key a auth.users)
      - `provider` (text) - 'github', 'gitlab', 'bitbucket'
      - `access_token` (text, encriptado)
      - `refresh_token` (text, encriptado, nullable)
      - `token_expires_at` (timestamptz, nullable)
      - `username` (text)
      - `email` (text)
      - `avatar_url` (text, nullable)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Nueva Tabla
    - `git_repositories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key a auth.users)
      - `git_connection_id` (uuid, foreign key a git_connections)
      - `repo_name` (text)
      - `repo_full_name` (text) - username/repo
      - `repo_url` (text)
      - `clone_url` (text)
      - `default_branch` (text)
      - `is_private` (boolean)
      - `netlify_site_id` (text, nullable)
      - `auto_deploy` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Seguridad
    - Enable RLS en ambas tablas
    - Policies para que usuarios solo accedan a sus propias conexiones y repos
*/

-- Create git_connections table
CREATE TABLE IF NOT EXISTS git_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  username text NOT NULL,
  email text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create git_repositories table
CREATE TABLE IF NOT EXISTS git_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  git_connection_id uuid REFERENCES git_connections(id) ON DELETE CASCADE NOT NULL,
  repo_name text NOT NULL,
  repo_full_name text NOT NULL,
  repo_url text NOT NULL,
  clone_url text NOT NULL,
  default_branch text DEFAULT 'main',
  is_private boolean DEFAULT false,
  netlify_site_id text,
  auto_deploy boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, repo_full_name)
);

-- Enable RLS on git_connections
ALTER TABLE git_connections ENABLE ROW LEVEL SECURITY;

-- Policies for git_connections
CREATE POLICY "Users can read own git connections"
  ON git_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own git connections"
  ON git_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own git connections"
  ON git_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own git connections"
  ON git_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable RLS on git_repositories
ALTER TABLE git_repositories ENABLE ROW LEVEL SECURITY;

-- Policies for git_repositories
CREATE POLICY "Users can read own git repositories"
  ON git_repositories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own git repositories"
  ON git_repositories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own git repositories"
  ON git_repositories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own git repositories"
  ON git_repositories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_git_connections_user_id ON git_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_git_connections_active ON git_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_git_repositories_user_id ON git_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_git_repositories_connection ON git_repositories(git_connection_id);
CREATE INDEX IF NOT EXISTS idx_git_repositories_netlify ON git_repositories(netlify_site_id) WHERE netlify_site_id IS NOT NULL;
