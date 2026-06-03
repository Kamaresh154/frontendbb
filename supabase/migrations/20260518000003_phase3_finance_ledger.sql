-- Phase 3: Finance Ledger
-- Revision: 20260518000003

-- ── Chart of Accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(32)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    account_type    VARCHAR(32)  NOT NULL,  -- asset | liability | equity | revenue | expense
    currency        VARCHAR(8)   NOT NULL DEFAULT 'INR',
    description     TEXT,
    is_system       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);

CREATE INDEX idx_ledger_accounts_org ON ledger_accounts (organization_id);

-- ── Ledger Entries ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    center_id       UUID REFERENCES centers(id) ON DELETE SET NULL,
    account_id      UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
    direction       VARCHAR(8)   NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(8)   NOT NULL DEFAULT 'INR',
    entry_type      VARCHAR(32)  NOT NULL,  -- revenue | expense | payment | refund | adjustment
    description     VARCHAR(500) NOT NULL,
    reference_no    VARCHAR(128),
    entry_date      TIMESTAMPTZ  NOT NULL,
    meta            JSONB        NOT NULL DEFAULT '{}',
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_entries_org_date ON ledger_entries (organization_id, entry_date);
CREATE INDEX idx_ledger_entries_account  ON ledger_entries (account_id);
CREATE INDEX idx_ledger_entries_invoice  ON ledger_entries (invoice_id);

-- Auto-update updated_at trigger (reuse pattern from existing tables)
CREATE OR REPLACE TRIGGER set_ledger_entries_updated_at
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_ledger_accounts_updated_at
    BEFORE UPDATE ON ledger_accounts
    FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

-- ── RBAC: Ledger permissions ─────────────────────────────────────────────────

INSERT INTO permissions (id, code, module) VALUES
    (gen_random_uuid(), 'ledger.read',  'ledger'),
    (gen_random_uuid(), 'ledger.write', 'ledger')
ON CONFLICT (code) DO NOTHING;

-- franchise_owner: full ledger access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'franchise_owner'
  AND p.code IN ('ledger.read', 'ledger.write')
ON CONFLICT DO NOTHING;

-- accountant: full ledger access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'accountant'
  AND p.code IN ('ledger.read', 'ledger.write')
ON CONFLICT DO NOTHING;

-- branch_manager: read-only ledger
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'branch_manager'
  AND p.code = 'ledger.read'
ON CONFLICT DO NOTHING;
