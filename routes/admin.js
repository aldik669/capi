const express = require('express');
const os = require('os');
const db = require('../db');

const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function cleanTestEventCode(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 4) return '****';
  return `${'*'.repeat(token.length - 4)}${token.slice(-4)}`;
}

function toPublicProject(project) {
  return {
    id: project.id,
    name: project.name,
    pixel_id: project.pixel_id,
    access_token_masked: maskToken(project.access_token),
    test_event_code: project.test_event_code,
    created_at: project.created_at,
  };
}

const router = express.Router();

router.get('/api/projects', (req, res) => {
  res.json(db.listProjects().map(toPublicProject));
});

router.get('/api/projects/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(toPublicProject(project));
});

router.post('/api/projects', (req, res) => {
  const { id, name, pixel_id, access_token, test_event_code } = req.body || {};

  if (!id || !PROJECT_ID_RE.test(id)) {
    return res.status(400).json({ error: 'id is required and must match ^[a-zA-Z0-9_-]{1,64}$' });
  }
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!pixel_id) return res.status(400).json({ error: 'pixel_id is required' });
  if (!access_token) return res.status(400).json({ error: 'access_token is required' });

  if (db.getProject(id)) {
    return res.status(409).json({ error: `Project with id "${id}" already exists` });
  }

  const project = db.createProject({ id, name, pixel_id, access_token, test_event_code: cleanTestEventCode(test_event_code) });
  res.status(201).json(toPublicProject(project));
});

router.put('/api/projects/:id', (req, res) => {
  const existing = db.getProject(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const { name, pixel_id, access_token, test_event_code } = req.body || {};
  const project = db.updateProject(req.params.id, {
    name,
    pixel_id,
    access_token,
    test_event_code: cleanTestEventCode(test_event_code),
  });
  console.log(
    `[admin.updateProject] pid=${process.pid} host=${os.hostname()} id=${req.params.id} saved test_event_code=${JSON.stringify(project.test_event_code)}`
  );
  res.json(toPublicProject(project));
});

router.delete('/api/projects/:id', (req, res) => {
  const deleted = db.deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Project not found' });
  res.status(204).end();
});

module.exports = router;
