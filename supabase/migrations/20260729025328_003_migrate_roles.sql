
/*
# Migrate roles to Student, Staff, Admin only

## Overview
Migrates all existing profiles from faculty/technician/supervisor to 'staff'.
The app now supports only three roles: student, staff, admin.

## Changes
- faculty → staff
- technician → staff
- supervisor → staff
*/

UPDATE profiles SET role = 'staff' WHERE role IN ('faculty', 'technician', 'supervisor');
