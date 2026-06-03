# 🚀 KidzVenture ERP — How to Run (Step-by-Step)

> This guide is for **anyone** — no technical knowledge needed.  
> Follow each step exactly in order.

---

## 🔐 Super Admin Login (Default)

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `superadmin@kidzventure.com`  |
| Password | `SuperAdmin@123`              |

> ⚠️ **Change this password after your first login!**

---

## 📦 What You Need to Install First (One Time Only)

Install these programs on your computer before anything else:

### 1. Install Python 3.11 or newer
- Go to: **https://www.python.org/downloads/**
- Click the big yellow **Download Python** button
- Run the installer
- ✅ **IMPORTANT:** On the first screen, check the box that says **"Add Python to PATH"** before clicking Install

### 2. Install Node.js
- Go to: **https://nodejs.org/**
- Click **"LTS"** (the left button — recommended for most users)
- Run the installer, click Next on all screens

### 3. Install Git
- Go to: **https://git-scm.com/downloads**
- Download for your system (Windows / Mac)
- Run the installer, click Next on all screens

---

## 📁 Step 1 — Extract the Project

1. You received a file called **`kidzventure-updated.zip`**
2. **Right-click** the zip file → **Extract All** (Windows) or double-click (Mac)
3. You will get a folder called **`kidzventure-updated`**
4. Move this folder somewhere easy to find, like your **Desktop** or **Documents**

---

## 🖥️ How to Open a Terminal

You will need to type commands. Here's how to open a terminal:

**Windows:**
1. Press `Windows key + R`
2. Type `cmd` and press Enter
3. A black window opens — this is your terminal

**Mac:**
1. Press `Cmd + Space`
2. Type `Terminal` and press Enter

---

## ⚙️ Step 2 — Set Up the Backend (API Server)

The backend is the engine that stores your data.

### 2a. Go into the backend folder

In your terminal, type these commands one by one. Press **Enter** after each line.

**Windows:**
```
cd Desktop\kidzventure-updated\backend
```

**Mac:**
```
cd ~/Desktop/kidzventure-updated/backend
```

> 💡 If you put the folder in Documents instead of Desktop, replace `Desktop` with `Documents`

### 2b. Create a virtual environment (a safe container for Python)

```
python -m venv venv
```

Wait for it to finish (about 10 seconds).

### 2c. Activate the virtual environment

**Windows:**
```
venv\Scripts\activate
```

**Mac/Linux:**
```
source venv/bin/activate
```

You should now see `(venv)` at the start of your terminal line. This means it worked. ✅

### 2d. Install required packages

```
pip install -r requirements.txt
```

This downloads everything needed. Wait for it to finish (1–3 minutes).

---

## 🗄️ Step 3 — Reset the Database (Clean Start)

This will delete all demo/test data and keep only the Super Admin account.

Make sure you are still in the `backend` folder with `(venv)` active, then run:

```
python reset_db.py
```

You should see:
```
✅ Reset complete!
Super Admin Email   : superadmin@kidzventure.com
Super Admin Password: SuperAdmin@123
```

> You only need to run this **once** when setting up for the first time.  
> **Do NOT run this again** — it will delete all your data!

---

## ▶️ Step 4 — Start the Backend Server

```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

You should see something like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

✅ The backend is now running! **Leave this terminal window open.**

---

## 🌐 Step 5 — Set Up and Start the Frontend (Website)

Open a **new terminal window** (keep the backend one running).

### 5a. Go into the frontend folder

**Windows:**
```
cd Desktop\kidzventure-updated\apps\admin-web
```

**Mac:**
```
cd ~/Desktop/kidzventure-updated/apps/admin-web
```

### 5b. Install frontend packages

```
npm install
```

Wait for it to finish (1–2 minutes).

### 5c. Start the frontend

```
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

✅ The frontend is running!

---

## 🎉 Step 6 — Open the App

Open your web browser (Chrome, Edge, Firefox) and go to:

```
http://localhost:5173
```

You will see the KidzVenture login page.

**Login with:**
- Email: `superadmin@kidzventure.com`
- Password: `SuperAdmin@123`

---

## 🔄 How to Run It Every Day

Every time you want to use the app, you need to start **both** the backend and frontend.

### Start Backend (every time):
```
cd Desktop\kidzventure-updated\backend        ← go to backend folder
venv\Scripts\activate                          ← activate venv (Windows)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Start Frontend (in a new terminal, every time):
```
cd Desktop\kidzventure-updated\apps\admin-web  ← go to frontend folder
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## 🛑 How to Stop the App

In each terminal window, press **Ctrl + C** to stop the server.

---

## 🧹 How to Reset the Database Again (If Needed)

> ⚠️ This will delete ALL your data (employees, invoices, etc.) and only keep the Super Admin!  
> Only do this if you want a completely fresh start.

```
cd Desktop\kidzventure-updated\backend
venv\Scripts\activate
python reset_db.py
```

---

## ❓ Troubleshooting

| Problem | Solution |
|--------|---------|
| `python` not found | Reinstall Python and check "Add to PATH" |
| `npm` not found | Reinstall Node.js |
| Port already in use | Close other programs or restart your computer |
| Can't login | Make sure backend terminal is running, then try again |
| Page won't load | Make sure both backend AND frontend are running |
| `(venv)` not showing | Run the activate command again |

---

## 📂 Project Folder Structure (For Reference)

```
kidzventure-updated/
├── backend/              ← Python API server
│   ├── .env              ← Configuration file
│   ├── reset_db.py       ← Run once to clean database
│   ├── kidzventure_dev.db ← Your data (SQLite database file)
│   └── app/
├── apps/
│   └── admin-web/        ← Frontend website
└── HOW_TO_RUN.md         ← This file
```

---

## 🔒 Security Reminder

Before sharing this app with others on a network:

1. Open `backend/.env`
2. Change `JWT_SECRET` to a long random string
3. Change the Super Admin password after first login

---

*KidzVenture ERP v4 — Setup Guide*
