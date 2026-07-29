
/*
# Update RLS policies for simplified roles

## Overview
Updates all RLS policies that previously referenced 'supervisor' or 'technician'
roles to now use 'staff' instead. The app now has only three roles: student, staff, admin.

## Changes
- buildings: admin OR staff (was admin OR supervisor)
- rooms: same
- complaints SELECT: staff sees all (was supervisor)
- complaints UPDATE: staff can update (was supervisor/technician)
- inventory: staff can edit (was supervisor/technician)
- preventive maintenance: staff (was supervisor)
- work orders: staff (was supervisor)
- inventory transactions: staff (was supervisor/technician)
*/

-- buildings
DROP POLICY IF EXISTS "buildings_insert" ON buildings;
CREATE POLICY "buildings_insert" ON buildings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "buildings_update" ON buildings;
CREATE POLICY "buildings_update" ON buildings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- rooms
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- complaints
DROP POLICY IF EXISTS "complaints_select" ON complaints;
CREATE POLICY "complaints_select" ON complaints FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR
  auth.uid() = assigned_to OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "complaints_update" ON complaints;
CREATE POLICY "complaints_update" ON complaints FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR
  auth.uid() = assigned_to OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- inventory
DROP POLICY IF EXISTS "inventory_insert" ON inventory_items;
CREATE POLICY "inventory_insert" ON inventory_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "inventory_update" ON inventory_items;
CREATE POLICY "inventory_update" ON inventory_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- preventive maintenance
DROP POLICY IF EXISTS "pm_insert" ON preventive_maintenance_schedules;
CREATE POLICY "pm_insert" ON preventive_maintenance_schedules FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "pm_update" ON preventive_maintenance_schedules;
CREATE POLICY "pm_update" ON preventive_maintenance_schedules FOR UPDATE TO authenticated USING (
  auth.uid() = assigned_to OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- inventory transactions
DROP POLICY IF EXISTS "inv_trans_select" ON inventory_transactions;
CREATE POLICY "inv_trans_select" ON inventory_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- work orders
DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
CREATE POLICY "work_orders_select" ON work_orders FOR SELECT TO authenticated USING (
  auth.uid() = technician_id OR
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE TO authenticated USING (
  auth.uid() = technician_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
