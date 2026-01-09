import * as fs from "@std/fs";
import { DatabaseSync } from "node:sqlite";
import * as path from "@std/path";
import { dataDir, getSourceDir, isTabStorageDb, tabDir } from "./util.ts";
import { getNextTabID } from "./tab.ts";

let dbPath = path.join(dataDir, "config.db");

let isInitDatabase = false;

if (!await fs.exists(dbPath)) {
    isInitDatabase = true;
    await Deno.copyFile(path.join(getSourceDir(), "./extra/config-template.db"), dbPath);
}

export const db = new DatabaseSync(dbPath);
export const kv = await Deno.openKv(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
    CREATE TABLE IF NOT EXISTS tab_file (
        tab_id INTEGER PRIMARY KEY,
        filename TEXT NOT NULL,
        data BLOB NOT NULL
    );
`);

if (isInitDatabase) {
    await addDemoTab();
}

export function isInitDB() {
    return isInitDatabase;
}

export function hasUser() {
    const row = db.prepare("SELECT COUNT(*) as count FROM user").get();
    if (!row) {
        throw new Error("User table not found");
    }
    if (typeof row.count !== "number") {
        throw new Error("Invalid count value");
    }
    return row.count > 0;
}

export async function addDemoTab() {
    try {
        const demoTabPath = path.join(getSourceDir(), "./extra/demo-tab.gp");
        const id = await getNextTabID();
        const demoData = await Deno.readFile(demoTabPath);
        const filename = "tab.gp";

        if (!isTabStorageDb()) {
            const dir = path.join(tabDir, id.toString());
            await Deno.mkdir(dir);
            await Deno.writeFile(path.join(dir, filename), demoData);
        } else {
            storeTabFile(id, filename, demoData);
        }

        // Add Tab
        await kv.set(["tab", id], {
            id,
            title: "Hare no Hi ni (Bass Only)",
            artist: "Reira Ushio",
            filename,
            originalFilename: "汐れいら-ハレの日に (Bass Only)-09-18-2025.gp",
            createdAt: "2025-09-26T07:29:56.450Z",
            public: false,
        });

        // Add Youtube Source
        const videoID = "VuKSlOT__9s";
        await kv.set(["youtube", id, videoID], {
            videoID,
            syncMethod: "simple",
            simpleSync: 2900,
            advancedSync: "",
        });
    } catch (e) {
        console.log("Skip: Failed to add demo tab:", e);
    }
}

export function storeTabFile(tabID: number, filename: string, data: Uint8Array) {
    const stmt = db.prepare("INSERT OR REPLACE INTO tab_file (tab_id, filename, data) VALUES (?, ?, ?)");
    return runWithDbRetry(() => stmt.run(tabID, filename, data));
}

export function getTabFileRow(tabID: number) {
    const stmt = db.prepare("SELECT filename, data FROM tab_file WHERE tab_id = ?");
    return stmt.get(tabID) as { filename: string; data: Uint8Array } | undefined;
}

export function deleteTabFile(tabID: number) {
    const stmt = db.prepare("DELETE FROM tab_file WHERE tab_id = ?");
    return runWithDbRetry(() => stmt.run(tabID));
}

async function runWithDbRetry(action: () => void, attempts = 5) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return action();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.toLowerCase().includes("database is locked") && attempt < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
}
