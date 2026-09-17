function headersToObject(headers) {
  return Object.fromEntries(headers.entries());
}

async function getPixelInfo(pixelId, accessToken, apiVersion) {
  const url = `https://graph.facebook.com/${apiVersion}/${pixelId}?fields=id,name,creation_time&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const body = await response.json();
  return { status: response.status, headers: headersToObject(response.headers), body };
}

async function getTokenPermissions(accessToken, apiVersion) {
  const url = `https://graph.facebook.com/${apiVersion}/me/permissions?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const body = await response.json();
  return { status: response.status, headers: headersToObject(response.headers), body };
}

async function sendRealTestEvent(pixelId, accessToken, apiVersion, testEventCode) {
  const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  const crypto = require('crypto');
  const eventPayload = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: `Diagnose_${Date.now()}`,
    action_source: 'system_generated',
    user_data: {
      em: [crypto.createHash('sha256').update('diagnose-probe@example.com').digest('hex')],
    },
  };

  const requestBody = { data: [eventPayload] };
  if (testEventCode) requestBody.test_event_code = testEventCode;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const body = await response.json();
  return {
    status: response.status,
    headers: headersToObject(response.headers),
    requestBody,
    body,
  };
}

module.exports = { getPixelInfo, getTokenPermissions, sendRealTestEvent };
