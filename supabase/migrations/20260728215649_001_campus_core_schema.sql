
/*
# Campus Complaint & Maintenance Management System - Core Schema

## Overview
Creates all core tables for the campus maintenance management system including
user profiles, roles, buildings/locations, complaint categories, complaints,
technicians, work orders, inventory, preventive maintenance, notifications, and feedback.

## New Tables

### profiles
- Extends Supabase auth.users with role and campus-specific details
- Columns: id (uuid, FK auth.users), full_name, college_id, role (enum), department, hostel, block, room, phone, avatar_url, is_active

### buildings
- Campus buildings/blocks
- Columns: id, name, code, type (academic/hostel/admin/other), floors, description

### rooms
- Rooms within buildings
- Columns: id, building_id, floor, room_number, room_type, description

### complaint_categories
- Categories like Electrical, Plumbing, WiFi, etc.
- Columns: id, name, icon, color, description, sla_hours

### complaints
- Core complaint records
- Columns: id, complaint_no (auto-generated), title, description, category_id, user_id, building_id, room_id, floor, priority, status, photo_urls, assigned_to, assigned_at, resolved_at, closed_at, expected_completion, escalation_level, feedback_rating, feedback_comment, created_at, updated_at

### complaint_status_history
- Tracks every status change for a complaint
- Columns: id, complaint_id, old_status, new_status, changed_by, remarks, created_at

### technicians
- Technician profile details linked to profiles
- Columns: id (=profile id), skills, current_workload, availability_status, area_coverage, employee_code

### work_orders
- Work orders generated per complaint
- Columns: id, work_order_no, complaint_id, technician_id, tools_required, materials_used, start_time, completion_time, labour_hours, repair_notes, material_cost, status, completion_photo_urls, created_by, created_at, updated_at

### inventory_items
- Stock of maintenance items
- Columns: id, name, category, unit, current_stock, min_stock, max_stock, unit_cost, supplier, description, created_at

### inventory_transactions
- Stock in/out records
- Columns: id, item_id, transaction_type (in/out/issued), quantity, technician_id, work_order_id, notes, created_by, created_at

### preventive_maintenance_schedules
- Recurring maintenance schedules
- Columns: id, title, description, category, building_id, frequency_days, last_performed, next_due, assigned_to, status, created_at

### notifications
- In-app notifications for users
- Columns: id, user_id, title, message, type, related_id, is_read, created_at

## Security
- RLS enabled on all tables
- Authenticated users can read their own profiles and complaints
- Admins/supervisors have broader access (handled via role checks in policies)
- All policies use auth.uid()
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'faculty', 'technician', 'supervisor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Complaint status enum
DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Priority enum
DO $$ BEGIN
  CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  college_id text,
  role user_role NOT NULL DEFAULT 'student',
  department text,
  hostel text,
  block text,
  room text,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- ==================== BUILDINGS ====================
CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  type text DEFAULT 'academic',
  floors integer DEFAULT 1,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buildings_select" ON buildings;
CREATE POLICY "buildings_select" ON buildings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "buildings_insert" ON buildings;
CREATE POLICY "buildings_insert" ON buildings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "buildings_update" ON buildings;
CREATE POLICY "buildings_update" ON buildings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "buildings_delete" ON buildings;
CREATE POLICY "buildings_delete" ON buildings FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== ROOMS ====================
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  floor integer NOT NULL DEFAULT 1,
  room_number text NOT NULL,
  room_type text DEFAULT 'classroom',
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rooms_insert" ON rooms;
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== COMPLAINT CATEGORIES ====================
CREATE TABLE IF NOT EXISTS complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text DEFAULT 'wrench',
  color text DEFAULT '#3B82F6',
  description text,
  sla_hours integer DEFAULT 48,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE complaint_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON complaint_categories;
CREATE POLICY "categories_select" ON complaint_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert" ON complaint_categories;
CREATE POLICY "categories_insert" ON complaint_categories FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "categories_update" ON complaint_categories;
CREATE POLICY "categories_update" ON complaint_categories FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "categories_delete" ON complaint_categories;
CREATE POLICY "categories_delete" ON complaint_categories FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== COMPLAINTS ====================
CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1000;

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_no text UNIQUE NOT NULL DEFAULT ('CMP-' || nextval('complaint_seq')),
  title text NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES complaint_categories(id),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id uuid REFERENCES buildings(id),
  room_id uuid REFERENCES rooms(id),
  floor integer,
  location_description text,
  priority complaint_priority NOT NULL DEFAULT 'medium',
  status complaint_status NOT NULL DEFAULT 'submitted',
  photo_urls text[] DEFAULT '{}',
  assigned_to uuid REFERENCES auth.users(id),
  assigned_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  expected_completion timestamptz,
  escalation_level integer DEFAULT 0,
  feedback_rating integer CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "complaints_select" ON complaints;
CREATE POLICY "complaints_select" ON complaints FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR
  auth.uid() = assigned_to OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "complaints_insert" ON complaints;
CREATE POLICY "complaints_insert" ON complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "complaints_update" ON complaints;
CREATE POLICY "complaints_update" ON complaints FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR
  auth.uid() = assigned_to OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor', 'technician'))
);

DROP POLICY IF EXISTS "complaints_delete" ON complaints;
CREATE POLICY "complaints_delete" ON complaints FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== COMPLAINT STATUS HISTORY ====================
CREATE TABLE IF NOT EXISTS complaint_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  old_status complaint_status,
  new_status complaint_status NOT NULL,
  changed_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  remarks text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE complaint_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_history_select" ON complaint_status_history;
CREATE POLICY "status_history_select" ON complaint_status_history FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM complaints c WHERE c.id = complaint_id AND (
      c.user_id = auth.uid() OR
      c.assigned_to = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
    )
  )
);

DROP POLICY IF EXISTS "status_history_insert" ON complaint_status_history;
CREATE POLICY "status_history_insert" ON complaint_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

DROP POLICY IF EXISTS "status_history_update" ON complaint_status_history;
CREATE POLICY "status_history_update" ON complaint_status_history FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "status_history_delete" ON complaint_status_history;
CREATE POLICY "status_history_delete" ON complaint_status_history FOR DELETE TO authenticated USING (false);

-- ==================== TECHNICIANS ====================
CREATE TABLE IF NOT EXISTS technicians (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text UNIQUE,
  skills text[] DEFAULT '{}',
  current_workload integer DEFAULT 0,
  availability_status text DEFAULT 'available',
  area_coverage text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technicians_select" ON technicians;
CREATE POLICY "technicians_select" ON technicians FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "technicians_insert" ON technicians;
CREATE POLICY "technicians_insert" ON technicians FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "technicians_update" ON technicians;
CREATE POLICY "technicians_update" ON technicians FOR UPDATE TO authenticated USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "technicians_delete" ON technicians;
CREATE POLICY "technicians_delete" ON technicians FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== WORK ORDERS ====================
CREATE SEQUENCE IF NOT EXISTS wo_seq START 5000;

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_no text UNIQUE NOT NULL DEFAULT ('WO-' || nextval('wo_seq')),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES auth.users(id),
  tools_required text[] DEFAULT '{}',
  materials_used jsonb DEFAULT '[]',
  start_time timestamptz,
  completion_time timestamptz,
  labour_hours numeric(5,2),
  repair_notes text,
  material_cost numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pending',
  completion_photo_urls text[] DEFAULT '{}',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
CREATE POLICY "work_orders_select" ON work_orders FOR SELECT TO authenticated USING (
  auth.uid() = technician_id OR
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by
);

DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE TO authenticated USING (
  auth.uid() = technician_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "work_orders_delete" ON work_orders;
CREATE POLICY "work_orders_delete" ON work_orders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== INVENTORY ====================
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit text DEFAULT 'pcs',
  current_stock integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  max_stock integer DEFAULT 100,
  unit_cost numeric(10,2) DEFAULT 0,
  supplier text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select" ON inventory_items;
CREATE POLICY "inventory_select" ON inventory_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_insert" ON inventory_items;
CREATE POLICY "inventory_insert" ON inventory_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "inventory_update" ON inventory_items;
CREATE POLICY "inventory_update" ON inventory_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor', 'technician'))
);

DROP POLICY IF EXISTS "inventory_delete" ON inventory_items;
CREATE POLICY "inventory_delete" ON inventory_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== INVENTORY TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out', 'issued', 'returned')),
  quantity integer NOT NULL,
  technician_id uuid REFERENCES auth.users(id),
  work_order_id uuid REFERENCES work_orders(id),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_trans_select" ON inventory_transactions;
CREATE POLICY "inv_trans_select" ON inventory_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor', 'technician'))
);

DROP POLICY IF EXISTS "inv_trans_insert" ON inventory_transactions;
CREATE POLICY "inv_trans_insert" ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "inv_trans_update" ON inventory_transactions;
CREATE POLICY "inv_trans_update" ON inventory_transactions FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "inv_trans_delete" ON inventory_transactions;
CREATE POLICY "inv_trans_delete" ON inventory_transactions FOR DELETE TO authenticated USING (false);

-- ==================== PREVENTIVE MAINTENANCE ====================
CREATE TABLE IF NOT EXISTS preventive_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  building_id uuid REFERENCES buildings(id),
  frequency_days integer NOT NULL DEFAULT 30,
  last_performed timestamptz,
  next_due timestamptz,
  assigned_to uuid REFERENCES auth.users(id),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE preventive_maintenance_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_select" ON preventive_maintenance_schedules;
CREATE POLICY "pm_select" ON preventive_maintenance_schedules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pm_insert" ON preventive_maintenance_schedules;
CREATE POLICY "pm_insert" ON preventive_maintenance_schedules FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "pm_update" ON preventive_maintenance_schedules;
CREATE POLICY "pm_update" ON preventive_maintenance_schedules FOR UPDATE TO authenticated USING (
  auth.uid() = assigned_to OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

DROP POLICY IF EXISTS "pm_delete" ON preventive_maintenance_schedules;
CREATE POLICY "pm_delete" ON preventive_maintenance_schedules FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_complaint ON work_orders(complaint_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_technician ON work_orders(technician_id);

-- ==================== SEED DATA ====================

-- Seed buildings
INSERT INTO buildings (name, code, type, floors) VALUES
  ('Academic Block A', 'ABA', 'academic', 4),
  ('Academic Block B', 'ABB', 'academic', 3),
  ('Academic Block C', 'ABC', 'academic', 4),
  ('Hostel Block A', 'HBA', 'hostel', 5),
  ('Hostel Block B', 'HBB', 'hostel', 5),
  ('Central Library', 'LIB', 'academic', 3),
  ('Seminar Hall', 'SEM', 'academic', 2),
  ('Admin Block', 'ADM', 'admin', 2),
  ('Sports Complex', 'SPT', 'other', 1)
ON CONFLICT DO NOTHING;

-- Seed complaint categories
INSERT INTO complaint_categories (name, icon, color, description, sla_hours) VALUES
  ('Electrical', 'zap', '#F59E0B', 'Electrical issues - lights, fans, sockets', 24),
  ('Plumbing', 'droplets', '#3B82F6', 'Water supply, drainage, taps, pipes', 48),
  ('Wi-Fi / IT', 'wifi', '#8B5CF6', 'Network and internet connectivity issues', 12),
  ('Cleaning', 'sparkles', '#10B981', 'Cleanliness and hygiene issues', 24),
  ('Furniture', 'sofa', '#6B7280', 'Broken chairs, desks, almirahs', 72),
  ('Security', 'shield', '#EF4444', 'Security and safety related issues', 4),
  ('HVAC / AC', 'wind', '#06B6D4', 'Air conditioning and ventilation', 48),
  ('Civil / Structure', 'building', '#92400E', 'Walls, floors, doors, windows', 72)
ON CONFLICT DO NOTHING;
