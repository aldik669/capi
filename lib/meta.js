const crypto = require('crypto');
const os = require('os');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashEmail(email) {
  return sha256(email.trim().toLowerCase());
}

function hashPhone(phone) {
  const normalized = phone.replace(/\D/g, '');
  return sha256(normalized);
}

function buildEventPayload({ event_name, email, phone, ctwa_clid, value, currency, source }) {
  const isWhatsApp = Boolean(ctwa_clid) || source === 'whatsapp';

  const userData = {};
  if (email) userData.em = [hashEmail(email)];
  if (phone) userData.ph = [hashPhone(phone)];
  if (ctwa_clid) userData.ctwa_clid = ctwa_clid;

  const eventId = `${event_name}_${Date.now()}`;

  const payload = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: isWhatsApp ? 'business_messaging' : 'system_generated',
    user_data: userData,
  };

  if (isWhatsApp) {
    payload.messaging_channel = 'whatsapp';
  }

  if (value !== undefined) payload.custom_data = { ...(payload.custom_data || {}), value };
  if (currency !== undefined) payload.custom_data = { ...(payload.custom_data || {}), currency };

  return payload;
}

async function sendEvent({ pixelId, accessToken, apiVersion, testEventCode, eventPayload }) {
  const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  const body = { data: [eventPayload] };
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  console.log(
    '[meta.sendEvent] outgoing request',
    JSON.stringify({
      pid: process.pid,
      host: os.hostname(),
      pixelId,
      apiVersion,
      test_event_code: testEventCode ?? null,
      test_event_code_length: testEventCode ? testEventCode.length : 0,
      body,
    })
  );

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    const error = new Error('Meta Conversions API request failed');
    error.status = response.status;
    error.details = json;
    throw error;
  }

  return json;
}

module.exports = { hashEmail, hashPhone, buildEventPayload, sendEvent };
