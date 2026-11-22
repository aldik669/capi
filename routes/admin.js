const express = require('express');
const os = require('os');
const db = require('../db');
const { getPixelInfo, getTokenPermissions, sendRealTestEvent } = require('../lib/diagnose');
const { getPipelines } = require('../lib/amocrm');

const { GRAPH_API_VERSION = 'v21.0' } = process.env;

const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function cleanTestEventCode(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function cleanStatusMap(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === '') return null;

  let parsed;
  try {
    parsed = typeof trimmed === 'string' ? JSON.parse(trimmed) : trimmed;
  } catch {
    throw new Error('status_map must be valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('status_map must be a JSON object mapping status_id to event_name');
  }
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val !== 'string') {
      throw new Error(`status_map value for key "${key}" must be a string event_name`);
    }
  }
  return JSON.stringify(parsed);
}

function parseStatusMap(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    amo_subdomain: project.amo_subdomain,
    amo_base_domain: project.amo_base_domain,
    amo_token_masked: maskToken(project.amo_token),
    status_map: parseStatusMap(project.status_map),
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
  const {
    id,
    name,
    pixel_id,
    access_token,
    test_event_code,
    amo_subdomain,
    amo_base_domain,
    amo_token,
    status_map,
  } = req.body || {};

  if (!id || !PROJECT_ID_RE.test(id)) {
    return res.status(400).json({ error: 'id is required and must match ^[a-zA-Z0-9_-]{1,64}$' });
  }
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!pixel_id) return res.status(400).json({ error: 'pixel_id is required' });
  if (!access_token) return res.status(400).json({ error: 'access_token is required' });

  if (db.getProject(id)) {
    return res.status(409).json({ error: `Project with id "${id}" already exists` });
  }

  let cleanedStatusMap;
  try {
    cleanedStatusMap = cleanStatusMap(status_map);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const project = db.createProject({
    id,
    name,
    pixel_id,
    access_token,
    test_event_code: cleanTestEventCode(test_event_code),
    amo_subdomain: amo_subdomain || null,
    amo_base_domain: amo_base_domain || null,
    amo_token: amo_token || null,
    status_map: cleanedStatusMap,
  });
  res.status(201).json(toPublicProject(project));
});

router.put('/api/projects/:id', (req, res) => {
  const existing = db.getProject(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const {
    name,
    pixel_id,
    access_token,
    test_event_code,
    amo_subdomain,
    amo_base_domain,
    amo_token,
    status_map,
  } = req.body || {};

  let cleanedStatusMap;
  try {
    cleanedStatusMap = cleanStatusMap(status_map);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const project = db.updateProject(req.params.id, {
    name,
    pixel_id,
    access_token,
    test_event_code: cleanTestEventCode(test_event_code),
    amo_subdomain,
    amo_base_domain,
    amo_token,
    status_map: cleanedStatusMap,
  });
  console.log(
    `[admin.updateProject] pid=${process.pid} host=${os.hostname()} id=${req.params.id} saved test_event_code=${JSON.stringify(project.test_event_code)}`
  );
  res.json(toPublicProject(project));
});

router.get('/api/projects/:id/diagnose', async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const [pixelInfo, permissions, testEvent] = await Promise.all([
      getPixelInfo(project.pixel_id, project.access_token, GRAPH_API_VERSION),
      getTokenPermissions(project.access_token, GRAPH_API_VERSION),
      sendRealTestEvent(project.pixel_id, project.access_token, GRAPH_API_VERSION, project.test_event_code),
    ]);

    res.json({
      project_id: project.id,
      pixel_id: project.pixel_id,
      test_event_code: project.test_event_code,
      pixel_info: pixelInfo,
      token_permissions: permissions,
      real_test_event: testEvent,
    });
  } catch (err) {
    res.status(502).json({ error: 'Diagnose request to Meta failed', details: err.message });
  }
});

router.get('/api/projects/:id/amo-pipelines', async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.amo_subdomain || !project.amo_token) {
    return res.status(400).json({ error: 'Project is missing amo_subdomain or amo_token' });
  }

  try {
    const result = await getPipelines(project);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(502).json({ error: 'Request to amoCRM failed', details: err.message });
  }
});

router.delete('/api/projects/:id', (req, res) => {
  const deleted = db.deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Project not found' });
  res.status(204).end();
});

module.exports = router;
