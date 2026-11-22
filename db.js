const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'projects.db');
console.log(`[db] pid=${process.pid} host=${os.hostname()} using SQLite database at: ${dbPath}`);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pixel_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    test_event_code TEXT,
    amo_subdomain TEXT,
    amo_base_domain TEXT,
    amo_token TEXT,
    status_map TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('projects', 'amo_subdomain', 'TEXT');
ensureColumn('projects', 'amo_base_domain', 'TEXT');
ensureColumn('projects', 'amo_token', 'TEXT');
ensureColumn('projects', 'status_map', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS sent_events (
    project_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, lead_id, event_name)
  )
`);

function listProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
}

function getProject(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function createProject({
  id,
  name,
  pixel_id,
  access_token,
  test_event_code,
  amo_subdomain,
  amo_base_domain,
  amo_token,
  status_map,
}) {
  db.prepare(
    `INSERT INTO projects
      (id, name, pixel_id, access_token, test_event_code, amo_subdomain, amo_base_domain, amo_token, status_map)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    pixel_id,
    access_token,
    test_event_code || null,
    amo_subdomain || null,
    amo_base_domain || null,
    amo_token || null,
    status_map || null
  );
  return getProject(id);
}

function updateProject(id, {
  name,
  pixel_id,
  access_token,
  test_event_code,
  amo_subdomain,
  amo_base_domain,
  amo_token,
  status_map,
}) {
  const existing = getProject(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE projects
     SET name = ?, pixel_id = ?, access_token = ?, test_event_code = ?,
         amo_subdomain = ?, amo_base_domain = ?, amo_token = ?, status_map = ?
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    pixel_id ?? existing.pixel_id,
    access_token ? access_token : existing.access_token,
    test_event_code !== undefined ? (test_event_code || null) : existing.test_event_code,
    amo_subdomain !== undefined ? (amo_subdomain || null) : existing.amo_subdomain,
    amo_base_domain !== undefined ? (amo_base_domain || null) : existing.amo_base_domain,
    amo_token ? amo_token : existing.amo_token,
    status_map !== undefined ? (status_map || null) : existing.status_map,
    id
  );

  return getProject(id);
}

function deleteProject(id) {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

function tryClaimEvent(projectId, leadId, eventName) {
  const result = db
    .prepare('INSERT OR IGNORE INTO sent_events (project_id, lead_id, event_name) VALUES (?, ?, ?)')
    .run(projectId, leadId, eventName);
  return result.changes > 0;
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  tryClaimEvent,
};
