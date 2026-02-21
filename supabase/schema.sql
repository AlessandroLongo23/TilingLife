-- ============================================
-- TilingLife Database Schema
-- ============================================

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TILING GROUPS TABLE
-- Stores tiling categories/groups (1-Uniform, 2-Uniform, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS tiling_groups (
    id TEXT PRIMARY KEY,                          -- e.g., "1Ur", "1Usr", "2U"
    title TEXT NOT NULL,                          -- e.g., "1-Uniform (Regular)"
    k INTEGER NOT NULL,                           -- Number of vertex types
    m INTEGER NOT NULL,                           -- Number of distinct vertex types
    vertex_type_count INTEGER DEFAULT 1,          -- Number of vertex types
    has_dual BOOLEAN DEFAULT false,               -- Whether group supports dual tilings
    is_concave BOOLEAN DEFAULT false,             -- Whether group contains concave polygons
    display_order INTEGER DEFAULT 0,              -- For sorting in UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TILINGS TABLE
-- Stores individual tiling definitions and metadata
-- ============================================
CREATE TABLE IF NOT EXISTS tilings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic identification
    original_id INTEGER,                          -- Original ID from source (for reference)
    name TEXT,                                    -- e.g., "triangular", "square"
    rulestring TEXT NOT NULL UNIQUE,              -- Generation rule (unique identifier)
    cr_notation TEXT,                             -- Conway-Radin notation (e.g., "3^6", "4^4")
    
    -- Group/Category
    group_id TEXT NOT NULL REFERENCES tiling_groups(id),
    
    -- Dual tiling information
    dual_name TEXT,                               -- Name of the dual tiling (e.g., "hexagonal")
    
    -- Classification booleans
    is_regular BOOLEAN DEFAULT false,             -- Regular tiling (all same regular polygons)
    is_star BOOLEAN DEFAULT false,                -- Contains star polygons
    is_concave BOOLEAN DEFAULT false,             -- Contains concave polygons
    
    -- Alternative configurations
    alternatives JSONB DEFAULT '[]'::jsonb,       -- Alternative rulestrings array
    
    -- Image URLs (from Supabase Storage)
    image_url TEXT,                               -- URL to tiling preview image
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tilings_group_id ON tilings(group_id);
CREATE INDEX IF NOT EXISTS idx_tilings_rulestring ON tilings(rulestring);
CREATE INDEX IF NOT EXISTS idx_tilings_cr_notation ON tilings(cr_notation);
CREATE INDEX IF NOT EXISTS idx_tilings_is_regular ON tilings(is_regular);
CREATE INDEX IF NOT EXISTS idx_tilings_is_semiregular ON tilings(is_semiregular);
CREATE INDEX IF NOT EXISTS idx_tilings_is_star ON tilings(is_star);
CREATE INDEX IF NOT EXISTS idx_tilings_is_concave ON tilings(is_concave);

-- ============================================
-- STORAGE BUCKET FOR TILING IMAGES
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('tilings', 'tilings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to tiling images
CREATE POLICY "Public can read tiling images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tilings');

-- Allow authenticated users to upload (for admin/migration purposes)
CREATE POLICY "Authenticated users can upload tiling images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tilings');

-- Allow service role full access (for migration scripts)
CREATE POLICY "Service role can manage tiling images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'tilings');

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE tiling_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tilings ENABLE ROW LEVEL SECURITY;

-- Public read access for tiling_groups (no auth required)
CREATE POLICY "Public can read tiling groups"
ON tiling_groups FOR SELECT
TO public
USING (true);

-- Public read access for tilings (no auth required)
CREATE POLICY "Public can read tilings"
ON tilings FOR SELECT
TO public
USING (true);

-- Service role can do anything (for migrations)
CREATE POLICY "Service role can manage tiling groups"
ON tiling_groups FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role can manage tilings"
ON tilings FOR ALL
TO service_role
USING (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tilings_updated_at
    BEFORE UPDATE ON tilings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: TILING GROUPS
-- ============================================
INSERT INTO tiling_groups (id, title, k, m, vertex_type_count, has_dual, is_concave, display_order) VALUES
    ('1Ur', '1-Uniform (Regular)', 1, 1, 1, true, false, 1),
    ('1Usr', '1-Uniform (Semiregular)', 1, 1, 1, true, false, 2),
    ('2U', '2-Uniform', 2, 2, 2, true, false, 3),
    ('3U2', '3-Uniform (2 Vertex Types)', 3, 2, 2, true, false, 4),
    ('3U3', '3-Uniform (3 Vertex Types)', 3, 3, 3, true, false, 5),
    ('4U', '4-Uniform', 4, 4, 4, true, false, 6),
    ('5U', '5-Uniform', 5, 5, 5, true, false, 7),
    ('6U', '6-Uniform', 6, 6, 6, true, false, 8),
    ('c1U', 'Concave 1-Uniform', 1, 1, 1, true, true, 9),
    ('c2U', 'Concave 2-Uniform', 2, 2, 2, true, true, 10),
    ('c3U', 'Concave 3-Uniform', 3, 3, 3, true, true, 11),
    ('c4U', 'Concave 4-Uniform', 4, 4, 4, true, true, 12),
    ('c5U', 'Concave 5-Uniform', 5, 5, 5, true, true, 13),
    ('c6U', 'Concave 6-Uniform', 6, 6, 6, true, true, 14),
    ('c7U', 'Concave 7-Uniform', 7, 7, 7, true, true, 15),
    ('ckU', 'Concave k-Uniform', k, 0, 0, true, true, 16)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    k = EXCLUDED.k,
    m = EXCLUDED.m,
    vertex_type_count = EXCLUDED.vertex_type_count,
    has_dual = EXCLUDED.has_dual,
    is_concave = EXCLUDED.is_concave,
    display_order = EXCLUDED.display_order;
