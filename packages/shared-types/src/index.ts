export type UserStatus = "active" | "invited" | "suspended";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  roles: string[];
  permissions: string[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Center {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address: Record<string, unknown>;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  organization_id: string;
  center_id: string;
  batch_id: string | null;
  admission_no: string | null;
  full_name: string;
  dob: string | null;
  gender: string | null;
  qr_code: string | null;
  medical_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StudentListResponse {
  items: Student[];
  total: number;
  page: number;
  page_size: number;
}

export interface Parent {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentDetail extends Parent {
  students: {
    id: string;
    full_name: string;
    admission_no: string | null;
    relationship: string | null;
    is_primary: boolean;
  }[];
}

export interface ParentListResponse {
  items: Parent[];
  total: number;
  page: number;
  page_size: number;
}

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  center_id: string;
  student_id: string;
  student_name?: string | null;
  check_in_at: string;
  check_out_at: string | null;
  method: string;
  notes: string | null;
  created_at: string;
}

export interface AttendanceListResponse {
  items: AttendanceRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface AttendanceSummary {
  date: string;
  present: number;
  checked_out: number;
  still_in: number;
}

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  organization_id: string;
  center_id: string;
  invoice_no: string;
  student_id: string | null;
  parent_id: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  due_date: string | null;
  notes: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  lines?: InvoiceLine[];
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

// ── Phase 3: Finance Ledger ──────────────────────────────────────────────────

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type EntryDirection = "debit" | "credit";
export type EntryType = "revenue" | "expense" | "payment" | "refund" | "adjustment";

export interface LedgerAccount {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  currency: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  organization_id: string;
  center_id: string | null;
  account_id: string;
  invoice_id: string | null;
  direction: EntryDirection;
  amount: number;
  currency: string;
  entry_type: EntryType;
  description: string;
  reference_no: string | null;
  entry_date: string;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryListResponse {
  items: LedgerEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface AccountBalance {
  account_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  currency: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export interface LedgerSummaryResponse {
  organization_id: string;
  from_date: string | null;
  to_date: string | null;
  accounts: AccountBalance[];
  total_revenue: number;
  total_expense: number;
  net_income: number;
}

// ── Phase 4: Payroll ─────────────────────────────────────────────────────────

export interface StaffProfile {
  id: string;
  organization_id: string;
  center_id: string | null;
  user_id: string | null;
  full_name: string;
  designation: string | null;
  department: string | null;
  employee_code: string | null;
  date_of_joining: string | null;
  basic_salary: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StaffListResponse {
  items: StaffProfile[];
  total: number;
  page: number;
  page_size: number;
}

export interface Payslip {
  id: string;
  organization_id: string;
  staff_id: string;
  pay_period: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  bonus: number;
  gross_pay: number;
  net_pay: number;
  status: string;
  breakdown: Record<string, unknown>;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayslipListResponse {
  items: Payslip[];
  total: number;
  page: number;
  page_size: number;
}

// ── Phase 4: Inventory ───────────────────────────────────────────────────────

export interface InventoryProduct {
  id: string;
  organization_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  unit_cost: number;
  reorder_level: number;
  current_stock: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  items: InventoryProduct[];
  total: number;
  page: number;
  page_size: number;
}

export interface StockEntry {
  id: string;
  organization_id: string;
  center_id: string | null;
  product_id: string;
  quantity: number;
  entry_type: string;
  reference_no: string | null;
  unit_cost: number | null;
  notes: string | null;
  entry_date: string;
  created_at: string;
}

// ── Phase 4: CRM ─────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "trial_scheduled" | "trial_done" | "enrolled" | "lost";

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  center_id: string | null;
  child_name: string;
  child_age: number | null;
  parent_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  assigned_to: string | null;
  follow_up_date: string | null;
  notes: string | null;
  converted_student_id: string | null;
  activities: LeadActivity[];
  created_at: string;
  updated_at: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
}
