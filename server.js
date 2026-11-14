process.env.TZ = 'Asia/Manila';
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- REST API Endpoints ---

// 1. Bootstrap: Fetch all data at once on app load
app.get('/api/bootstrap', async (req, res) => {
    try {
        const [records, counterChecks, sheetSigsList, counterSigsList, weeklyVerList] = await Promise.all([
            db.all('SELECT * FROM monitoring_records ORDER BY id DESC'),
            db.all('SELECT * FROM counter_checks ORDER BY id DESC'),
            db.all('SELECT * FROM sheet_signatures ORDER BY id ASC'),
            db.all('SELECT * FROM counter_sheet_signatures ORDER BY id ASC'),
            db.all('SELECT * FROM weekly_verifications ORDER BY id ASC')
        ]);

        // Transform signatures into objects keyed by sheet_key / sheet_date for frontend convenience
        const sheetSigs = {};
        sheetSigsList.forEach(s => {
            if (!sheetSigs[s.sheet_key]) sheetSigs[s.sheet_key] = [];
            sheetSigs[s.sheet_key].push({ id: s.id, name: s.name, sig: s.sig });
        });

        const counterSigs = {};
        counterSigsList.forEach(s => {
            if (!counterSigs[s.sheet_date]) counterSigs[s.sheet_date] = [];
            counterSigs[s.sheet_date].push({ id: s.id, name: s.name, sig: s.sig });
        });

        const weeklyVerifications = {};
        weeklyVerList.forEach(v => {
            if (!weeklyVerifications[v.week_key]) weeklyVerifications[v.week_key] = [];
            weeklyVerifications[v.week_key].push({
                id: v.id,
                verifier: v.verifier,
                date: v.date,
                decision: v.decision,
                remarks: v.remarks,
                sig: v.sig,
                count: v.count
            });
        });

        res.json({
            success: true,
            records,
            counterChecks,
            sheetSigs,
            counterSigs,
            weeklyVerifications
        });
    } catch (err) {
        console.error('Error fetching bootstrap data:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Batch Save Monitoring Records
app.post('/api/records', async (req, res) => {
    try {
        const { records } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, error: 'No records provided' });
        }

        for (const r of records) {
            await db.run(`
                INSERT INTO monitoring_records 
                (id, monitor, shift, date, time, area, temp, standard, thermo, calibration, remarks, assessment, verification, verifier, verifyDate, decisionRemarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                r.id,
                r.monitor,
                r.shift,
                r.date,
                r.time,
                r.area,
                r.temp,
                r.standard,
                r.thermo,
                r.calibration,
                r.remarks || '',
                r.assessment,
                r.verification || 'Pending Verification',
                r.verifier || '',
                r.verifyDate || '',
                r.decisionRemarks || ''
            ]);
        }

        io.emit('data:changed', { type: 'records', count: records.length });
        res.json({ success: true, count: records.length });
    } catch (err) {
        console.error('Error saving records:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Save Counter Check
app.post('/api/counter-checks', async (req, res) => {
    try {
        const r = req.body;
        await db.run(`
            INSERT INTO counter_checks
            (id, date, time, checker, shift, area, temp, standard, thermo, calibration, remarks, assessment, linkedId, linkedTemp, linkedMonitor, linkedStamp, diff, result, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            r.id,
            r.date,
            r.time,
            r.checker,
            r.shift,
            r.area,
            r.temp,
            r.standard,
            r.thermo,
            r.calibration,
            r.remarks || '',
            r.assessment,
            String(r.linkedId || ''),
            r.linkedTemp !== undefined && r.linkedTemp !== '' ? Number(r.linkedTemp) : null,
            r.linkedMonitor || '',
            r.linkedStamp || '',
            r.diff !== null && r.diff !== undefined ? Number(r.diff) : null,
            r.result || '',
            r.signature || ''
        ]);

        io.emit('data:changed', { type: 'counter-check', id: r.id });
        res.json({ success: true, id: r.id });
    } catch (err) {
        console.error('Error saving counter check:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Save Monitoring Sheet Signature
app.post('/api/sheet-signatures', async (req, res) => {
    try {
        const { key, name, sig } = req.body;
        if (!key || !name || !sig) {
            return res.status(400).json({ success: false, error: 'Missing required signature data' });
        }

        // Remove previous signature of the same person on this sheet key
        await db.run('DELETE FROM sheet_signatures WHERE sheet_key = ? AND name = ?', [key, name]);
        await db.run('INSERT INTO sheet_signatures (sheet_key, name, sig) VALUES (?, ?, ?)', [key, name, sig]);

        io.emit('data:changed', { type: 'sheet-sig', key, name });
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving sheet signature:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Remove Monitoring Sheet Signature
app.delete('/api/sheet-signatures', async (req, res) => {
    try {
        const { key, name } = req.body;
        await db.run('DELETE FROM sheet_signatures WHERE sheet_key = ? AND name = ?', [key, name]);
        io.emit('data:changed', { type: 'sheet-sig-remove', key, name });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting sheet signature:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Save Counter Sheet Signature
app.post('/api/counter-signatures', async (req, res) => {
    try {
        const { date, name, sig } = req.body;
        if (!date || !name || !sig) {
            return res.status(400).json({ success: false, error: 'Missing required signature data' });
        }

        await db.run('DELETE FROM counter_sheet_signatures WHERE sheet_date = ? AND name = ?', [date, name]);
        await db.run('INSERT INTO counter_sheet_signatures (sheet_date, name, sig) VALUES (?, ?, ?)', [date, name, sig]);

        io.emit('data:changed', { type: 'counter-sig', date, name });
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving counter signature:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. Remove Counter Sheet Signature
app.delete('/api/counter-signatures', async (req, res) => {
    try {
        const { date, name } = req.body;
        await db.run('DELETE FROM counter_sheet_signatures WHERE sheet_date = ? AND name = ?', [date, name]);
        io.emit('data:changed', { type: 'counter-sig-remove', date, name });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting counter signature:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Submit Weekly Verification
app.post('/api/weekly-verifications', async (req, res) => {
    try {
        const { weekKey, verifier, verifyDate, decision, remarks, sig, recordIds } = req.body;

        if (Array.isArray(recordIds) && recordIds.length > 0) {
            for (const id of recordIds) {
                await db.run(`
                    UPDATE monitoring_records
                    SET verification = ?, verifier = ?, verifyDate = ?, decisionRemarks = ?
                    WHERE id = ?
                `, [decision, verifier, verifyDate, remarks, id]);
            }
        }

        await db.run(`
            INSERT INTO weekly_verifications (week_key, verifier, date, decision, remarks, sig, count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [weekKey, verifier, verifyDate, decision, remarks, sig, recordIds ? recordIds.length : 0]);

        io.emit('data:changed', { type: 'weekly-verification', weekKey });
        res.json({ success: true });
    } catch (err) {
        console.error('Error submitting weekly verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. Reset All Records
app.post('/api/reset-all', async (req, res) => {
    try {
        await db.run('DELETE FROM monitoring_records');
        await db.run('DELETE FROM counter_checks');
        await db.run('DELETE FROM sheet_signatures');
        await db.run('DELETE FROM counter_sheet_signatures');
        await db.run('DELETE FROM weekly_verifications');

        io.emit('data:changed', { type: 'reset-all' });
        res.json({ success: true });
    } catch (err) {
        console.error('Error resetting records:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Catch-all route to serve the frontend SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
async function start() {
    try {
        await db.initDB();
        server.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🚀 MHC Temperature Monitoring System running!`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`⏱ Timezone: ${process.env.TZ || 'Asia/Manila'}`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
