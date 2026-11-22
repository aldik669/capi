const express = require('express');
const db = require('../db');

const router = express.Router();

function redactHeaders(headers) {
  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    if (/authorization|cookie|secret|token/i.test(key)) continue;
    redacted[key] = value;
  }
  return redacted;
}

function tentativeParseLeadsStatus(body) {
  const entries = body && body.leads && body.leads.status;
  if (!Array.isArray(entries)) return null;
  return entries
    .map((entry) => ({
      lead_id: entry && entry.id,
      status_id: entry && entry.status_id,
      pipeline_id: entry && entry.pipeline_id,
      price: entry && entry.price,
    }))
    .filter((e) => e.lead_id && e.status_id);
}

function resolvePurchaseValue(rawPrice, defaultPurchaseValue) {
  const price = Number(rawPrice);
  if (Number.isFinite(price) && price > 0) {
    return { value: price, source: 'deal_price' };
  }
  if (defaultPurchaseValue !== null && defaultPurchaseValue !== undefined) {
    const def = Number(defaultPurchaseValue);
    if (Number.isFinite(def) && def > 0) {
      return { value: def, source: 'project_default' };
    }
  }
  return null;
}

router.post('/amocrm/:projectId', (req, res) => {
  res.sendStatus(200);

  const { projectId } = req.params;
  const project = db.getProject(projectId);

  console.log(
    `[amocrm.webhook] project=${projectId} content-type=${req.headers['content-type']} headers=${JSON.stringify(redactHeaders(req.headers))}`
  );
  console.log(`[amocrm.webhook] project=${projectId} raw body: ${req.rawBody}`);
  console.log(`[amocrm.webhook] project=${projectId} parsed body: ${JSON.stringify(req.body)}`);

  if (!project) {
    console.log(`[amocrm.webhook] project=${projectId} unknown project id — ignoring`);
    return;
  }

  const tentative = tentativeParseLeadsStatus(req.body);
  if (!tentative || tentative.length === 0) {
    console.log(
      `[amocrm.webhook] project=${projectId} payload does not match the expected "leads[status][...]" shape — DRY RUN only, nothing was sent to amoCRM or Meta. Share this log so parsing can be confirmed.`
    );
    return;
  }

  let statusMap = {};
  try {
    statusMap = project.status_map ? JSON.parse(project.status_map) : {};
  } catch {
    statusMap = {};
  }

  for (const entry of tentative) {
    const eventName = statusMap[entry.status_id];

    if (!eventName) {
      console.log(
        `[amocrm.webhook] project=${projectId} DRY RUN lead_id=${entry.lead_id} status_id=${entry.status_id} pipeline_id=${entry.pipeline_id} status not in status_map — ignored`
      );
      continue;
    }

    if (eventName === 'Purchase') {
      const resolved = resolvePurchaseValue(entry.price, project.default_purchase_value);
      if (!resolved) {
        console.log(
          `[amocrm.webhook] project=${projectId} DRY RUN lead_id=${entry.lead_id} status_id=${entry.status_id} event_name=Purchase SKIPPED — no deal price and no default_purchase_value configured`
        );
        continue;
      }
      console.log(
        `[amocrm.webhook] project=${projectId} DRY RUN would-process lead_id=${entry.lead_id} status_id=${entry.status_id} pipeline_id=${entry.pipeline_id} event_name=Purchase value=${resolved.value} value_source=${resolved.source} currency=KZT — not yet forwarded to amoCRM/Meta APIs pending format confirmation`
      );
      continue;
    }

    console.log(
      `[amocrm.webhook] project=${projectId} DRY RUN would-process lead_id=${entry.lead_id} status_id=${entry.status_id} pipeline_id=${entry.pipeline_id} mapped_event_name=${eventName} — not yet forwarded to amoCRM/Meta APIs pending format confirmation`
    );
  }
});

module.exports = router;
