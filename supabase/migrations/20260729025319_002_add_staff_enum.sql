
/*
# Add staff role to enum

## Overview
Adds the 'staff' value to the user_role enum so it can be used in the next migration.
*/

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
