-- Create security_logs table
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'prompt_injection', 'unauthorized_access', etc.
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Only admins should be able to view all logs (assuming an admin role or similar mechanism exists, 
-- but for now, users can only view their own logs if we want to show them, or strictly backend access).
-- For this MVP, we'll allow users to insert their own logs (via server-side service role usually, but RLS for insert is good practice)
-- and maybe view them if we build a security dashboard later.

CREATE POLICY "Users can insert their own security logs"
  ON security_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own security logs"
  ON security_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_security_logs_user ON security_logs(user_id);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX idx_security_logs_severity ON security_logs(severity);
