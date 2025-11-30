
-- Create business_glossary table
create table if not exists business_glossary (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  term text not null,
  definition text not null,
  sql_logic text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure terms are unique per user (or globally if shared, but let's stick to per-user for now)
  unique(user_id, term)
);

-- Enable RLS
alter table business_glossary enable row level security;

-- Policies
create policy "Users can view their own glossary terms"
  on business_glossary for select
  using (auth.uid() = user_id);

create policy "Users can insert their own glossary terms"
  on business_glossary for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own glossary terms"
  on business_glossary for update
  using (auth.uid() = user_id);

create policy "Users can delete their own glossary terms"
  on business_glossary for delete
  using (auth.uid() = user_id);

-- Indexes
create index business_glossary_term_idx on business_glossary using gin(to_tsvector('english', term || ' ' || definition));
