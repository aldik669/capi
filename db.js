const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'projects.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pixel_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    test_event_code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function listProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
}

function getProject(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function createProject({ id, name, pixel_id, access_token, test_event_code }) {
  db.prepare(
    'INSERT INTO projects (id, name, pixel_id, access_token, test_event_code) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, pixel_id, access_token, test_event_code || null);
  return getProject(id);
}

function updateProject(id, { name, pixel_id, access_token, test_event_code }) {
  const existing = getProject(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE projects
     SET name = ?, pixel_id = ?, access_token = ?, test_event_code = ?
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    pixel_id ?? existing.pixel_id,
    access_token ? access_token : existing.access_token,
    test_event_code !== undefined ? (test_event_code || null) : existing.test_event_code,
    id
  );

  return getProject(id);
}

function deleteProject(id) {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };
