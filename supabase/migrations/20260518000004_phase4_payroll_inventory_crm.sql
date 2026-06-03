-- Phase 4: Payroll, Inventory, CRM, Franchise
-- Revision: 20260518000004

-- ── Staff Profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    center_id       UUID REFERENCES centers(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    designation     VARCHAR(128),
    department      VARCHAR(128),
    employee_code   VARCHAR(64),
    date_of_joining DATE,
    basic_salary    NUMERIC(14,2) NOT NULL DEFAULT 0,
    bank_account    JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_staff_profiles_org ON staff_profiles (organization_id);

-- ── Payslips ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payslips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id        UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    pay_period      VARCHAR(7) NOT NULL,
    basic_salary    NUMERIC(14,2) NOT NULL,
    allowances      NUMERIC(14,2) NOT NULL DEFAULT 0,
    deductions      NUMERIC(14,2) NOT NULL DEFAULT 0,
    bonus           NUMERIC(14,2) NOT NULL DEFAULT 0,
    gross_pay       NUMERIC(14,2) NOT NULL,
    net_pay         NUMERIC(14,2) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    breakdown       JSONB NOT NULL DEFAULT '{}',
    notes           TEXT,
    paid_at         DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (staff_id, pay_period)
);
CREATE INDEX idx_payslips_org   ON payslips (organization_id);
CREATE INDEX idx_payslips_staff ON payslips (staff_id);

-- ── Inventory Products ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(100),
    category        VARCHAR(100),
    unit            VARCHAR(32) NOT NULL DEFAULT 'pcs',
    unit_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
    reorder_level   INTEGER NOT NULL DEFAULT 0,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_inventory_products_org ON inventory_products (organization_id);

-- ── Stock Entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    center_id       UUID REFERENCES centers(id) ON DELETE SET NULL,
    product_id      UUID NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL,
    entry_type      VARCHAR(32) NOT NULL,
    reference_no    VARCHAR(128),
    unit_cost       NUMERIC(14,2),
    notes           TEXT,
    entry_date      DATE NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_entries_product ON stock_entries (product_id);

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    center_id            UUID REFERENCES centers(id) ON DELETE SET NULL,
    child_name           VARCHAR(255) NOT NULL,
    child_age            INTEGER,
    parent_name          VARCHAR(255) NOT NULL,
    phone                VARCHAR(32),
    email                VARCHAR(255),
    source               VARCHAR(100),
    status               VARCHAR(32) NOT NULL DEFAULT 'new',
    lost_reason          VARCHAR(255),
    assigned_to          UUID REFERENCES users(id) ON DELETE SET NULL,
    follow_up_date       DATE,
    notes                TEXT,
    converted_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ
);
CREATE INDEX idx_leads_org    ON leads (organization_id);
CREATE INDEX idx_leads_status ON leads (status);

-- ── Lead Activities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(64) NOT NULL,
    description   TEXT NOT NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_lead ON lead_activities (lead_id);

-- ── RBAC permissions ──────────────────────────────────────────────────────────
INSERT INTO permissions (id, code, module) VALUES
    (gen_random_uuid(), 'payroll.read',   'payroll'),
    (gen_random_uuid(), 'payroll.write',  'payroll'),
    (gen_random_uuid(), 'inventory.read', 'inventory'),
    (gen_random_uuid(), 'inventory.write','inventory'),
    (gen_random_uuid(), 'crm.read',       'crm'),
    (gen_random_uuid(), 'crm.write',      'crm'),
    (gen_random_uuid(), 'reports.read',   'reports'),
    (gen_random_uuid(), 'franchise.read', 'franchise')
ON CONFLICT DO NOTHING;
