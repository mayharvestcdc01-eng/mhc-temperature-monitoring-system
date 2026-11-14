process.env.TZ = 'Asia/Manila';
require('dotenv').config();
const { createClient } = require('@libsql/client');

let dbClient = null;

function getClient() {
    if (dbClient) return dbClient;

    const url = process.env.TURSO_DB_URL || process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_DB_TOKEN || process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
        dbClient = createClient({ url, authToken });
        console.log('[DB] Connected to Turso Cloud Database:', url);
    } else {
        const localPath = 'file:mhc_temp_local.db';
        dbClient = createClient({ url: localPath });
        console.log('[DB] TURSO credentials not detected. Using local SQLite fallback:', localPath);
    }

    return dbClient;
}

function rowToObject(row, columns) {
    if (!row) return null;
    if (typeof row === 'object' && !Array.isArray(row)) return row;
    const obj = {};
    columns.forEach((col, idx) => {
        obj[col] = row[idx];
    });
    return obj;
}

async function run(sql, params = []) {
    const client = getClient();
    const result = await client.execute({ sql, args: params });
    return {
        lastID: Number(result.lastInsertRowid ?? 0),
        changes: result.rowsAffected ?? 0
    };
}

async function get(sql, params = []) {
    const client = getClient();
    const result = await client.execute({ sql, args: params });
    if (result.rows && result.rows.length > 0) {
        return rowToObject(result.rows[0], result.columns);
    }
    return null;
}

async function all(sql, params = []) {
    const client = getClient();
    const result = await client.execute({ sql, args: params });
    if (!result.rows) return [];
    return result.rows.map(row => rowToObject(row, result.columns));
}

async function initDB() {
    const client = getClient();
    console.log('[DB] Initializing database tables...');

    // Monitoring Records Table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS monitoring_records (
            id INTEGER PRIMARY KEY,
            monitor TEXT NOT NULL,
            shift TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            area TEXT NOT NULL,
            temp REAL NOT NULL,
            standard TEXT,
            thermo TEXT,
            calibration TEXT,
            remarks TEXT,
            assessment TEXT NOT NULL,
            verification TEXT DEFAULT 'Pending Verification',
            verifier TEXT,
            verifyDate TEXT,
            decisionRemarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Counter Checks Table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS counter_checks (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            checker TEXT NOT NULL,
            shift TEXT NOT NULL,
            area TEXT NOT NULL,
            temp REAL NOT NULL,
            standard TEXT,
            thermo TEXT,
            calibration TEXT,
            remarks TEXT,
            assessment TEXT NOT NULL,
            linkedId TEXT,
            linkedTemp REAL,
            linkedMonitor TEXT,
            linkedStamp TEXT,
            diff REAL,
            result TEXT,
            signature TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Monitoring Sheet Signatures Table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS sheet_signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_key TEXT NOT NULL,
            name TEXT NOT NULL,
            sig TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Counter Sheet Signatures Table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS counter_sheet_signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_date TEXT NOT NULL,
            name TEXT NOT NULL,
            sig TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Weekly Verifications Table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS weekly_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_key TEXT NOT NULL,
            verifier TEXT NOT NULL,
            date TEXT NOT NULL,
            decision TEXT NOT NULL,
            remarks TEXT,
            sig TEXT,
            count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('[DB] All tables initialized successfully.');
}

module.exports = {
    getClient,
    run,
    get,
    all,
    initDB
};
