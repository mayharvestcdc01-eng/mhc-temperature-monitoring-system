# Hourly Room Temperature Monitoring System 🌡️
### May Harvest Corporation (MHC)
**Cold Storage • Holding Rooms • Blast Freezing • Production Support Areas**

A real-time, multi-device, cloud-connected temperature logging and quality verification system modeled after `mhc-dispatch-system`.

---

## 🚀 Key Features

1. **Central Cloud Database (Turso Cloud SQLite)**:
   - Lahat ng shift personnel (Day, Mid, Night) ay konektado sa iisang database.
   - Hindi mawawala ang data kahit mag-refresh, magpalit ng device, o mag-sleep ang Render free tier.
2. **Real-Time Synchronization (Socket.io)**:
   - Kapag nag-save ang monitor sa holding room o blast freezer gamit ang phone/tablet, mag-a-update agad ang screen sa office at records dashboard nang hindi kailangan i-refresh ang page.
3. **Hourly Monitoring & Deviation Detection**:
   - Automatic time & date capture sa bawat reading.
   - Automatic checking sa standard limits (Holding Rooms: -2°C to 0°C, Cold Storage: ≤-18°C, Blast Freezers: ≤-30°C, Preparation Areas: ≤10°C).
   - Flagging para sa temperature deviations na may remarks.
4. **Independent Counter Checking (OIC / PLI)**:
   - Pagkumpara ng reading ng monitor vs. counter checker gamit ang hiwalay na thermometer (±1.0°C discrepancy rule).
   - Digital signature pad para sa OIC/PLI.
5. **Weekly Quality Verification**:
   - Review at pag-apruba ng buong linggo (Monday to Sunday) ng QA/QC team.
   - Digital signature pad para sa Quality Verifier.
6. **Printable Monitoring & Counter Check Sheets**:
   - Professional PDF/paper print layout na fit sa official audit standards.
7. **CSV Export**:
   - One-click export ng lahat ng temperature logs para sa Excel reporting.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Responsive CSS, Canvas Signatures, Real-time Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Database Engine**: `@libsql/client` (Turso Cloud SQLite na may local fallback)
- **Deployment**: Render Web Service (`render.yaml`)

---

## 💻 Local Quick Start

1. I-double click ang **`start-server.bat`**
2. Buksan ang browser sa:
   ```
   http://localhost:3000
   ```

---

## ☁️ Deployment Instructions (GitHub + Render + Turso)

### 1. Setup Turso Database (Cloud Storage)
1. Pumunta sa [turso.tech](https://turso.tech) at mag-login gamit ang GitHub.
2. Gumawa ng bagong database (halimbawa: `mhc-temp-db`).
3. Kunin ang:
   - **Database URL** (`libsql://mhc-temp-db-yourname.turso.io`)
   - **Auth Token** (Generate Token)

### 2. Push to GitHub
```bash
git add .
git commit -m "Initial commit: MHC Temperature Monitoring System with Cloud Storage"
git branch -M main
git remote add origin https://github.com/mattdev18/mhc-temperature-monitoring-system.git
git push -u origin main
```

### 3. Deploy to Render
1. Pumunta sa [render.com](https://render.com) > **New +** > **Web Service**.
2. Ikonekta ang repository na `mhc-temperature-monitoring-system`.
3. Sa **Environment Variables**, idagdag ang:
   - `TURSO_DB_URL` = (Iyong Turso Database URL)
   - `TURSO_DB_TOKEN` = (Iyong Turso Auth Token)
4. I-click ang **Create Web Service**.
