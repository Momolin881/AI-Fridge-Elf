-- Add sort_order column to fridge_compartments table
-- Migration: 004_add_compartment_sort_order

-- Add sort_order column with default value
ALTER TABLE fridge_compartments 
ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Update existing compartments with default sort order based on creation order
UPDATE fridge_compartments 
SET sort_order = (
    SELECT ROW_NUMBER() OVER (PARTITION BY fridge_id ORDER BY created_at) - 1
    FROM (SELECT id, fridge_id, created_at FROM fridge_compartments) AS sub
    WHERE sub.id = fridge_compartments.id
);

-- Create index for better sorting performance
CREATE INDEX idx_fridge_compartments_sort_order ON fridge_compartments(fridge_id, sort_order);