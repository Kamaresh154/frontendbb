# 📞 Call Recording & VoIP Implementation Guide
## KidzVenture — Airtel SIM-Based Calling Through the App

---

## Overview

You have an Airtel mobile number and want to:
1. Make outbound calls to customers/employees **from within the app**
2. **Record all calls automatically** after the call ends
3. Store recordings **securely** (visible only to Super Admin + Employees)
4. **Super Admin** can delete recordings; employees can only listen

---

## Recommended Architecture: Airtel + Exotel / Twilio SIP Bridge

### Option A — Exotel (India-first, Airtel SIM compatible) ✅ Recommended

**How it works:**
```
App (browser/mobile)
  → Exotel WebRTC SDK (browser call)
  → Exotel Cloud (SIP trunk)
  → Airtel DID (your number)
  → Customer's phone
  ← Call recording stored in Exotel/S3
  ← Webhook fires to KidzVenture backend
  ← Backend saves recording URL in DB
```

**Steps:**
1. Sign up at exotel.com → verify your Airtel number as DID (Directly Inward Dialing)
2. Get App Key, App Secret from Exotel dashboard
3. Install Exotel Web SDK: `npm install @exotel/voice-sdk`
4. Backend creates a call token on demand via Exotel REST API

**Monthly cost:** ₹2,000–5,000/month for ~1,000 calls with recordings

---

### Option B — Twilio (Global, works with Airtel SIM via SIM swap port)

Port your Airtel number to Twilio India (+91 DID) — one-time process.
Use Twilio's Client SDK for browser-based calling.

---

## Backend Implementation

### 1. Install dependencies

```bash
pip install httpx boto3  # boto3 for S3 storage of recordings
```

### 2. Call model (add to backend/app/models/calls.py)

```python
class CallRecord(Base):
    __tablename__ = "call_records"
    id             = Column(String, primary_key=True, default=lambda: "call_" + str(int(time.time())))
    call_sid       = Column(String, unique=True)          # Exotel/Twilio call ID
    from_number    = Column(String)                       # Airtel number
    to_number      = Column(String)                       # Customer number
    employee_id    = Column(String, ForeignKey("staff.id"))
    employee_name  = Column(String)
    customer_name  = Column(String, nullable=True)
    duration_sec   = Column(Integer, default=0)
    status         = Column(String, default="initiated")  # completed/failed/no-answer
    recording_url  = Column(String, nullable=True)        # S3 or Exotel URL
    recording_sid  = Column(String, nullable=True)
    started_at     = Column(DateTime)
    ended_at       = Column(DateTime, nullable=True)
    notes          = Column(Text, nullable=True)
    deleted        = Column(Boolean, default=False)       # soft delete by super admin
```

### 3. API routes (backend/app/api/v1/calls.py)

```python
@router.post("/calls/token")
async def get_call_token(current_user = Depends(get_current_user)):
    """Generate Exotel/Twilio token for WebRTC call."""
    # Exotel example:
    import hmac, hashlib, base64, time
    app_key    = settings.EXOTEL_APP_KEY
    app_secret = settings.EXOTEL_APP_SECRET
    # ... generate signed token
    return {"token": signed_token, "app_key": app_key}

@router.post("/calls/initiate")
async def initiate_call(to_number: str, employee_id: str, db = Depends(get_db)):
    """Initiate outbound call via Exotel REST API."""
    response = await exotel_client.calls.create(
        from_=settings.AIRTEL_DID_NUMBER,
        to=to_number,
        app_id=settings.EXOTEL_APP_ID,
        record=True,                          # auto-record
        record_format="mp3",
    )
    # Save to DB
    record = CallRecord(call_sid=response.sid, ...)
    db.add(record); db.commit()
    return {"call_sid": response.sid}

@router.post("/calls/webhook")
async def call_webhook(request: Request, db = Depends(get_db)):
    """Exotel/Twilio sends POST here when call ends with recording URL."""
    data = await request.form()
    call_sid = data.get("CallSid") or data.get("SmsSid")
    recording_url = data.get("RecordingUrl")
    duration = int(data.get("CallDuration", 0))
    # Update DB record
    record = db.query(CallRecord).filter_by(call_sid=call_sid).first()
    if record:
        record.recording_url = recording_url
        record.duration_sec  = duration
        record.status        = data.get("CallStatus", "completed")
        record.ended_at      = datetime.utcnow()
        db.commit()
    return {"status": "ok"}

@router.get("/calls/recordings")
async def list_recordings(current_user = Depends(get_current_user), db = Depends(get_db)):
    """List all call recordings — super admin + employees only."""
    if "franchise_manager" in current_user.roles and "super_admin" not in current_user.roles:
        raise HTTPException(403, "Access denied")
    records = db.query(CallRecord).filter_by(deleted=False).order_by(CallRecord.started_at.desc()).all()
    return {"items": records}

@router.delete("/calls/recordings/{id}")
async def delete_recording(id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    """Soft-delete recording — super admin only."""
    if "super_admin" not in current_user.roles:
        raise HTTPException(403, "Only Super Admin can delete recordings")
    record = db.query(CallRecord).filter_by(id=id).first()
    if not record:
        raise HTTPException(404)
    record.deleted = True
    db.commit()
    return {"deleted": True}
```

---

## Frontend Implementation

### In EmployeesPage.tsx — Calls Panel

Replace the static mock data in the `calls` panel with:

```tsx
// State
const [callRecordings, setCallRecordings] = useState([]);
const [callLoading, setCallLoading] = useState(false);

// Load
useEffect(() => {
  if (panel === "calls") {
    setCallLoading(true);
    api.get("/calls/recordings?employee_id=" + selected.id)
       .then(r => setCallRecordings(r.data.items))
       .finally(() => setCallLoading(false));
  }
}, [panel, selected]);

// In the calls panel JSX:
{callRecordings.map(rec => (
  <div key={rec.id} className="...">
    <div className="flex-1">
      <p className="text-sm font-semibold">{rec.customer_name || rec.to_number}</p>
      <p className="text-xs text-slate-500">
        {rec.to_number} · {new Date(rec.started_at).toLocaleString("en-IN")}
        · {Math.floor(rec.duration_sec / 60)}:{String(rec.duration_sec % 60).padStart(2, "0")} min
      </p>
    </div>
    {/* Play button — super admin + employees only */}
    {rec.recording_url && (isSuperAdmin || isEmployee) && (
      <audio controls src={rec.recording_url} className="h-8" />
    )}
    {/* Delete — super admin only */}
    {isSuperAdmin && (
      <button onClick={() => api.delete(`/calls/recordings/${rec.id}`).then(loadRecordings)}
        className="text-red-400 hover:text-red-600 text-xs">🗑</button>
    )}
  </div>
))}
```

### Make a Call Button

Add in EmployeesPage header (next to employee name):

```tsx
{(isSuperAdmin || isEmployee) && selected.phone && (
  <button onClick={async () => {
    const tokenRes = await api.post("/calls/token");
    // Initialize Exotel Web SDK with token
    const client = new ExotelVoice({ token: tokenRes.data.token });
    client.call(selected.phone);
    // SDK handles recording automatically via webhook
  }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
    📞 Call {selected.full_name}
  </button>
)}
```

---

## Alternative: Airtel IQ API (Native Airtel Solution)

Airtel has their own **Airtel IQ** (formerly Airtel MTLS/CloudConnect):
- **Direct SIM integration** — no porting needed
- Works with existing Airtel number natively
- Recording stored on Airtel cloud

**Contact:** enterprise.airtel.in/iq → register as enterprise customer
**API Docs:** developer.airtel.in

---

## Security Access Matrix

| Feature                    | Super Admin | Employee | Franchise Manager |
|----------------------------|-------------|----------|-------------------|
| Make calls                 | ✅          | ✅       | ❌                |
| View call logs             | ✅          | ✅       | ❌                |
| Listen to recordings       | ✅          | ✅       | ❌                |
| Delete recordings          | ✅          | ❌       | ❌                |
| See all employees' calls   | ✅          | Own only | ❌                |

---

## Environment Variables to Add

```env
# .env
EXOTEL_APP_KEY=your_app_key
EXOTEL_APP_SECRET=your_app_secret
EXOTEL_APP_ID=your_app_id
EXOTEL_SID=your_account_sid
AIRTEL_DID_NUMBER=+91XXXXXXXXXX   # your Airtel number
CALL_WEBHOOK_URL=https://yourdomain.com/api/v1/calls/webhook

# For recording storage (optional - Exotel stores by default)
AWS_S3_BUCKET=kidzventure-recordings
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Quick Start Commands

```bash
# Install Exotel SDK (frontend)
cd apps/admin-web
npm install @exotel/voice-sdk

# Install backend deps
cd backend
pip install httpx aioboto3 --break-system-packages

# Run WebSocket chat server
python ws_server.py &

# Run backend as usual
uvicorn app.main:app --reload
```

---

## Summary

The key integration steps are:
1. **Register with Exotel/Airtel IQ** → verify your Airtel number as DID
2. **Add the backend webhook endpoint** → receives recording URL after each call
3. **Add WebRTC dialer in frontend** using Exotel Voice SDK
4. **DB stores every call record** with recording URL
5. **Frontend playback** gated by role (super_admin + employees only)
6. **Delete** only by super admin (soft delete)
