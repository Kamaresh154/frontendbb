-- Phase 5: Employee & Franchise Manager roles + User Management

-- Add new roles
INSERT INTO roles (code, name, description) VALUES
  ('employee',          'Employee',          'General employee — limited access'),
  ('franchise_manager', 'Franchise Manager', 'Franchise-level manager, same as franchise_owner')
ON CONFLICT (code) DO NOTHING;

-- Employee permissions (read-only for most modules, full for attendance & CRM)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'employee'
  AND p.code IN (
    'organizations.read',
    'centers.read',
    'attendance.read', 'attendance.write',
    'payroll.read',
    'crm.read', 'crm.write',
    'invoices.read',
    'inventory.read',
    'reports.read'
  )
ON CONFLICT DO NOTHING;

-- Franchise Manager: same as franchise_owner
INSERT INTO role_permissions (role_id, permission_id)
SELECT fm.id, rp.permission_id
FROM roles fm
CROSS JOIN role_permissions rp
JOIN roles fo ON fo.id = rp.role_id AND fo.code = 'franchise_owner'
WHERE fm.code = 'franchise_manager'
ON CONFLICT DO NOTHING;

-- Grant franchise_owner users.write so they can manage employees
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('franchise_owner', 'franchise_manager')
  AND p.code = 'users.write'
ON CONFLICT DO NOTHING;

-- Call logs table for tele calling
CREATE TABLE IF NOT EXISTS call_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_name   VARCHAR(255) NOT NULL,
    phone           VARCHAR(32) NOT NULL,
    agent_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_name      VARCHAR(255),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    duration_secs   INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(32) NOT NULL DEFAULT 'completed',
    notes           TEXT,
    recording_url   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_call_logs_org  ON call_logs (organization_id);
CREATE INDEX idx_call_logs_date ON call_logs (started_at);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(255),
    customer_name   VARCHAR(255) NOT NULL,
    phone           VARCHAR(32),
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_name   VARCHAR(255),
    appointment_at  TIMESTAMPTZ NOT NULL,
    appt_type       VARCHAR(64) NOT NULL DEFAULT 'other',
    status          VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_appointments_org  ON appointments (organization_id);
CREATE INDEX idx_appointments_date ON appointments (appointment_at);
