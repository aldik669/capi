const express = require('express');
const db = require('../db');
const { buildEventPayload, sendEvent } = require('../lib/meta');

const { GRAPH_API_VERSION = 'v21.0' } = process.env;

const router = express.Router();

router.get('/lead/:projectId', (req, res) => {
  res.status(405).json({
    error: 'This endpoint only accepts POST requests with a JSON body from your CRM — it is not meant to be opened in a browser.',
  });
});

router.post('/lead/:projectId', async (req, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: `Unknown project id "${req.params.projectId}"` });
  }

  const { event_name, email, phone, ctwa_clid, value, currency, source } = req.body || {};

  if (!event_name) {
    return res.status(400).json({ error: 'event_name is required' });
  }

  if (!email && !phone) {
    return res.status(400).json({ error: 'At least one of email or phone is required' });
  }

  const eventPayload = buildEventPayload({ event_name, email, phone, ctwa_clid, value, currency, source });

  try {
    const result = await sendEvent({
      pixelId: project.pixel_id,
      accessToken: project.access_token,
      apiVersion: GRAPH_API_VERSION,
      testEventCode: project.test_event_code,
      eventPayload,
    });

    res.json({ success: true, event_id: eventPayload.event_id, meta_response: result });
  } catch (err) {
    console.error(`Meta Conversions API error [project=${project.id}]:`, err.status, JSON.stringify(err.details || err.message));
    res.status(502).json({ error: 'Failed to forward event to Meta Conversions API', details: err.details || err.message });
  }
});

module.exports = router;
