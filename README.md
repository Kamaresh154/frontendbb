# KidzVenture ERP — Full User Manual

> **Version:** Phase 5 — Complete  
> **Data storage:** IndexedDB (persistent across browser restarts) + localStorage mirror  
> **Roles:** Super Admin · Admin · Employee · Franchise Manager

---

## Table of Contents
1. [How Data is Saved (No More Data Loss)](#how-data-is-saved)
2. [Roles & What Each Can Do](#roles--access)
3. [First-Time Setup — Do This in Order](#first-time-setup)
4. [Centres](#centres)
5. [Employees](#employees)
6. [User Management — Creating Accounts](#user-management)
7. [Leave Management](#leave-management)
8. [Attendance](#attendance)
9. [Orders & Payments (GPay / Cash / COD)](#orders--payments)
10. [Invoices](#invoices)
11. [Payroll & Salary](#payroll--salary)
12. [Finance Ledger](#finance-ledger)
13. [Reports & Analytics](#reports--analytics)
14. [Role Access Matrix](#role-access-matrix)
15. [Common Workflows (Quick Reference)](#common-workflows)

---

## How Data is Saved

**All data is now stored in IndexedDB** — a proper browser database that survives:
- ✅ Page refresh
- ✅ Browser tab close and reopen
- ✅ Computer restart (same browser profile)
- ✅ Logging out and logging back in

**What is stored locally vs on the server:**

| Data | Where stored |
|------|-------------|
| Employees (added via app) | IndexedDB + localStorage mirror |
| Centres | IndexedDB + localStorage mirror |
| Invoices | IndexedDB + localStorage mirror |
| Ledger entries | IndexedDB + localStorage mirror |
| Payslips | IndexedDB + localStorage mirror |
| Leave requests | IndexedDB + localStorage mirror |
| Attendance records | IndexedDB + localStorage mirror |
| Orders | IndexedDB + localStorage mirror |
| User accounts | Server (API) |
| API-created employees | Server (API) + synced to IndexedDB |

> **Note:** Data is per-browser-profile. If you switch to a different browser or device, local data won't be there. For multi-device use, ensure the backend API is running so data posts to the server too.

---

## Roles & Access

| Role | Who uses it | Portal access |
|------|-------------|---------------|
| **Super Admin** | Platform owner | Everything — all orgs, all users, all data |
| **Admin** | Franchise admin | Full org: employees, invoices, ledger, reports, payroll |
| **Employee** | Staff member | Attendance (own), students, invoices (can send), orders, leave |
| **Franchise Manager** | Partner/franchise | Orders only (place + track) |

---

## First-Time Setup

Do these steps in this exact order:

### Step 1 — Add a Centre
Go to **Invoices → Manage Centres tab** → fill name, address, phone → **Add Centre**  
Centres must exist before any invoice can be created.

### Step 2 — Add Employees
Go to **Employees** → click **+ Add** → fill the form → **Save Employee**  
The employee appears immediately (saved to IndexedDB even if API is offline).

### Step 3 — Create Employee User Accounts
Go to **User Management** → **+ Create User** → set Role: `employee`  
The employee now appears in both the **Users list** AND the **Employees list** automatically.

### Step 4 — Add Products to Catalogue  
Go to **Products** → add the products you sell (name, price, SKU).

### Step 5 — Start Using the System
- Take orders via **Orders** page
- Create invoices via **Invoices** page
- Mark attendance via **Attendance** page

---

## Centres

**Where:** Invoices → Manage Centres tab  
**Who:** Admin, Super Admin

Centres are your physical KidzVenture locations (branches).

| Action | How |
|--------|-----|
| Add centre | Invoices → tab "Manage Centres" → fill name/address/phone → Add Centre |
| View all centres | Same tab — table below the form |
| Use in invoice | Select from dropdown in any invoice form |

> Centres are saved to IndexedDB — they persist permanently until you manually delete them.

---

## Employees

**Where:** Employees (sidebar)  
**Who:** Admin, Super Admin (manage); Employee (view own + leave)

### Adding an Employee

1. Click **+ Add** (top of left panel)
2. Fill: Full Name *(required)*, Employee Code, Designation, Department, Basic Salary, Date of Joining, Phone, Email
3. Click **Save Employee**
4. ✅ Employee appears in list **immediately** (even if API is offline)

> When you create a user account with role "employee" via User Management, that person also appears automatically in the Employees list.

### Employee Detail Panels

Click any employee to open the detail view on the right. Tabs:

| Tab | Contents |
|-----|----------|
| **Details** | All info fields |
| **Payslips** | Salary slips — history |
| **Leave 🗓** | Leave balance + apply/approve/reject |
| **Call Logs** | Recent call history |
| **Messages** | Internal chat |

### Leave badge on avatar

If an employee has **pending leave requests**, a yellow number badge appears on their avatar in the list. Admins can see at a glance who needs review.

---

## User Management

**Where:** User Management (sidebar)  
**Who:** Admin, Super Admin only

### Creating a User Account

1. Click **+ Create User**
2. Fill: Full Name, Email, Password, Role
3. Click **Create Account**

> When role is **employee**: the person is **also added to the Employees list** automatically so they appear in payroll, attendance, and leave management immediately.

### Roles

| Role value | Access level |
|------------|-------------|
| `employee` | Employee portal |
| `franchise_manager` | Franchise portal (orders only) |
| `admin` | Full org admin |

---

## Leave Management

**Where:** Employees → select employee → **Leave** tab  
**Who can apply:** Admin, Super Admin (on behalf), Employee (own leave)  
**Who can approve/reject:** Admin, Super Admin only

### Leave Quotas (per year)

| Type | Quota |
|------|-------|
| Casual Leave | 12 days |
| Sick Leave | 12 days |
| Earned Leave | 15 days |
| Unpaid Leave | Unlimited |
| Other | 5 days |

### Applying for Leave

1. Go to **Employees** → select the employee
2. Click **Leave** tab
3. Click **+ Apply Leave**
4. Fill:
   - **Leave Type** (Casual / Sick / Earned / Unpaid / Other)
   - **From Date** and **To Date** — days are calculated automatically
   - **Reason** (required)
5. Click **Submit Request**
6. Status becomes **Pending** ⏳

### Employee Applying Their Own Leave

1. Log in as Employee
2. Go to **Employees** → click your own name in the list
3. **Leave** tab → **+ Apply Leave** → fill form → Submit

### Approving or Rejecting Leave (Admin Only)

1. Go to **Employees** → look for the 🔴 badge on an employee avatar (= pending leave)
2. Click the employee → **Leave** tab
3. Find the pending request (filter: Pending)
4. Click **Review Leave Request**
5. Optionally type a note (reason for approval/rejection)
6. Click **✓ Approve** or **✕ Reject**
7. ✅ Status updates immediately and saves to IndexedDB

### Leave Balance Cards

At the top of the Leave tab — shows remaining days for the current year per type, auto-calculated from approved leaves.

---

## Attendance

**Where:** Attendance (sidebar)  
**Who:** Admin, Super Admin (manage all); Employee (own check-in/out); Franchise ❌ blocked

### Employee Self Login / Logout

1. Log in as **Employee**
2. Go to **Attendance**
3. Click 🟢 **Login / Check In** → records your check-in time
4. At end of day → click 🔴 **Logout / Check Out** → records check-out time
5. Data saved to IndexedDB — persists permanently

### Admin Managing Attendance

1. Log in as **Admin** or **Super Admin**
2. Go to **Attendance** — pick the date
3. "Not Marked" panel shows who hasn't been recorded yet
4. Click **✓ Check In** (mark present) or **✗ Absent** for each person
5. In the log table → click **Check Out** when someone leaves

---

## Orders & Payments

**Where:** Orders (sidebar)  
**Who can place:** Everyone (including Franchise)  
**Who can process:** Employee, Admin, Super Admin

### Payment Methods

Three payment options when placing an order:

| Method | How it works |
|--------|-------------|
| 📱 **GPay / UPI** | After order — "Collect Payment" button shows UPI QR + deeplink. On payment confirmation → invoice auto-created and bill auto-printed |
| 🚚 **Cash on Delivery (COD)** | Payment collected when delivered. "Collect Payment" button appears on the order row |
| 💵 **Cash** | Immediate cash payment. Confirm → invoice auto-created and bill auto-printed |

### Placing an Order

1. Click **🛒 New Order**
2. Enter Customer Name (required), Phone, Delivery Address
3. Select **Payment Method**: GPay, COD, or Cash
4. Add products: select from dropdown → set qty → click **Add**
5. Optionally set discount, assign to employee, add notes
6. Click **Place Order** → status: **Pending**

### Collecting Payment (GPay)

1. Find the order → click **💳 Collect Payment**
2. Payment modal opens with:
   - 📱 GPay / UPI deeplink button (opens any UPI app)
   - UPI ID shown for manual payment
   - Field for UPI Transaction ID (optional, for records)
3. Once customer pays → click **✓ Confirm GPay / UPI Payment**
4. ✅ Invoice auto-created · Bill auto-printed in new tab · Order marked paid

### Collecting Payment (Cash)

1. Order row → **💳 Collect Payment** → click **💵 Confirm Cash Payment**
2. ✅ Invoice auto-created · Bill auto-printed · Order marked paid

### Order Pipeline

```
⏳ Pending → ✅ Confirmed → 🚚 Dispatched → 📦 Delivered
```

| Role | Can do |
|------|--------|
| Franchise | Place → track (read-only) |
| Employee | Confirm + Dispatch + Deliver + Collect Payment |
| Admin | Everything + Cancel |

---

## Invoices

**Where:** Invoices (sidebar)  
**Who:** Admin, Super Admin, Employee (can create + Send); Franchise ❌ blocked

### Types of Invoices

#### 1. Order Invoice 🛒
Auto-created when payment is collected from Orders page.  
Can also be manually created:
1. **+ New Invoice** → **Order Invoice** tab
2. Select order (auto-fills items + customer)
3. Select centre, attended-by employee
4. **Create Invoice** → 3 copies printed: Customer, Employee, Admin/Super Admin

#### 2. Tuition Fee Invoice 🎓
For monthly fees, admissions, activity charges:
1. **+ New Invoice** → **Tuition Fee** tab
2. Enter student name, centre, description, amount, GST%
3. **Create Invoice** → 3 copies printed

#### 3. Material Purchase Invoice 📦
For vendor/supplier purchases:
1. **+ New Invoice** → **Material Purchase** tab
2. Enter vendor name, centre, purchase date
3. Add line items (material, qty, unit, price) — subtotal/GST auto-calculated
4. **Create Purchase Invoice** → 2 copies printed (Accounts + Vendor)

### Invoice Actions

| Action | Who can do it |
|--------|--------------|
| 🖨 **Print** | Everyone with invoice access |
| **Send** | Admin, Super Admin, **Employee** ✅ |
| **Mark Paid** | Admin, Super Admin only |

### Auto-Ledger

Every invoice auto-posts to the Ledger:
- Revenue invoice created → **Credit entry** added automatically
- Purchase invoice created → **Debit entry** added automatically

### Invoice Copies

- **Order / Tuition:** Customer Copy · Employee Copy · Admin/Super Admin Copy
- **Purchase:** Accounts Copy · Vendor Copy

Each copy shows: invoice number, date, parties involved (placed by, attended by, created by), all line items with GST, and totals.

---

## Payroll & Salary

**Where:** Salary & Payroll (sidebar)  
**Who:** Admin, Super Admin, Employee (view own tab)

### Staff Tab

Shows all employees pulled directly from the **local employee store** — no API required. Employees added via the Employees page or User Management appear here automatically.

### Generating a Payslip

1. Click **+ Generate Payslip**
2. Select **Employee** from dropdown (all employees from the store are listed with their basic salary)
3. Select **Pay Period** (month/year)
4. Enter Allowances, Deductions, Bonus (optional)
5. Preview shows: Gross Pay, Deductions, **Net Pay** — calculated live
6. Click **Generate Draft** → payslip created

### Payslip Workflow

```
Draft → Approve → Mark Paid
```

| Step | Button | Who |
|------|--------|-----|
| Generated | — | Admin/Super Admin |
| Approve | Approve button | Admin/Super Admin |
| Pay salary | Mark Paid | Admin/Super Admin |

When **Mark Paid** is clicked → salary amount is **automatically posted as a Debit to the Ledger**.

### Printing a Payslip

Click **🖨 Slip** on any payslip row → full printable payslip opens with:
- Employee name, code, designation, department
- Earnings breakdown (Basic, Allowances, Bonus, Gross)
- Deductions breakdown
- **Net Pay** prominently displayed

---

## Finance Ledger

**Where:** Ledger (sidebar)  
**Who:** Admin, Super Admin only

### Automatic Entries

The ledger is populated automatically — you don't need to manually enter anything for normal operations:

| Trigger | Ledger entry created |
|---------|---------------------|
| Revenue invoice created | ➕ Credit entry |
| Purchase invoice created | ➖ Debit entry |
| Payslip marked as Paid | ➖ Debit entry (payroll) |

### Manual Entry

1. Click **+ Manual Entry**
2. Select: Type (Credit/Debit), Category, Amount, Date, Description, Reference
3. Click **Post Entry** → immediately visible in both tabs

### Summary Tab

Groups all entries by **month** — shows for each month:
- Total revenue in
- Total expenses out
- Net income for that month
- All individual entries in a table

### Entries Tab

Filterable list of all entries by category (Revenue / Purchase / Expense / Payroll / Other).

---

## Reports & Analytics

**Where:** Reports (sidebar)  
**Who:** Admin, Super Admin only

Reports are built **entirely from local invoice and ledger data**. Create invoices → they appear in reports automatically.

### Tab 1: Revenue Overview
- **Date range filter** (from month → to month)
- KPI cards: Total Revenue, Total Expenses, Net Income, Invoices raised
- **Bar charts:** Monthly Revenue · Monthly Expenses · Net Income
- **Month-by-month table** with % change vs previous month

### Tab 2: Invoice Analysis
- Count and value by type (Order, Tuition, Purchase)
- Status breakdown (Draft, Sent, Paid, Cancelled) with amounts
- Full invoice log table

### Tab 3: Ledger Entries
- Total credits, total debits, entry count
- Full ledger entry table with all details

### Tab 4: Leave Report
- Summary: Total, Pending, Approved, Rejected
- Leave by type — bar visualization (Casual, Sick, Earned, Unpaid)
- Per-employee leave summary (days used, pending count)
- Full leave request log table

---

## Role Access Matrix

| Feature | Super Admin | Admin | Employee | Franchise |
|---------|:-----------:|:-----:|:--------:|:---------:|
| Dashboard | ✅ Platform | ✅ Org | ✅ Limited | ✅ Limited |
| Students | ✅ | ✅ | ✅ | ❌ |
| Parents | ✅ | ✅ | ✅ | ❌ |
| Employees (view) | ✅ | ✅ | ✅ | ❌ |
| Employees (add/edit) | ✅ | ✅ | ❌ | ❌ |
| Apply Leave | ✅ | ✅ | ✅ (own) | ❌ |
| Approve Leave | ✅ | ✅ | ❌ | ❌ |
| Attendance (self check-in) | ✅ | ✅ | ✅ | ❌ |
| Attendance (manage all) | ✅ | ✅ | ❌ | ❌ |
| Payroll / Salary | ✅ | ✅ | ✅ view | ❌ |
| Generate Payslip | ✅ | ✅ | ❌ | ❌ |
| CRM / Leads | ✅ | ✅ | ✅ | ❌ |
| Create Invoice | ✅ | ✅ | ✅ | ❌ |
| **Send Invoice** | ✅ | ✅ | ✅ ← fixed | ❌ |
| Mark Invoice Paid | ✅ | ✅ | ❌ | ❌ |
| Ledger | ✅ | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ |
| Franchise Management | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ |
| Place Orders | ✅ | ✅ | ✅ | ✅ |
| Collect Payment (orders) | ✅ | ✅ | ✅ | ❌ |
| Process Orders (confirm/dispatch/deliver) | ✅ | ✅ | ✅ | ❌ |
| Cancel Orders | ✅ | ✅ | ❌ | ❌ |
| Product Catalogue | ✅ | ✅ | ✅ | ✅ |
| Inventory | ❌ | ❌ | ❌ | ❌ |

---

## Common Workflows

### New Order → Payment → Auto Invoice → Print Bill

1. **Orders** → New Order → fill customer + items → choose **GPay** or **Cash** → Place Order
2. Order row → **💳 Collect Payment**
3. GPay: customer scans / opens UPI → enter transaction ID → **Confirm GPay Payment**  
   Cash: click **Confirm Cash Payment**
4. ✅ Invoice auto-created · Bill prints automatically in new tab · Ledger updated

### New Employee → Account → Payslip

1. **Employees** → + Add → fill details (name, salary, etc.) → Save Employee
2. **User Management** → + Create User → role: Employee → Create Account
3. Employee appears in Employees list automatically
4. **Salary & Payroll** → + Generate Payslip → select employee (auto-filled from list) → Generate Draft → Approve → Mark Paid
5. Salary debit auto-posted to Ledger

### Leave Request → Approval

1. **Employees** → select employee → Leave tab → + Apply Leave → fill form → Submit
2. Yellow badge appears on employee avatar
3. Admin: Employees → select employee (badge visible) → Leave tab → filter Pending → Review Leave Request → Approve/Reject
4. Status updates instantly, saved to IndexedDB

### Monthly Tuition Collection → Revenue Report

1. **Invoices** → + New Invoice → Tuition Fee tab → enter student, amount → Create Invoice
2. **Ledger** → Credit entry auto-posted
3. **Reports** → Revenue Overview → see this month's revenue updated

### Purchase Materials → Track Expense

1. **Invoices** → + New Invoice → Material Purchase tab → enter vendor + line items → Create Purchase Invoice
2. **Ledger** → Debit entry auto-posted under "Purchase" category
3. **Reports** → Revenue Overview → expenses updated; Ledger Entries → Purchase filter shows this entry

