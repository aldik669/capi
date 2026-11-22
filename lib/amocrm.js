function baseUrl(project) {
  const domain = project.amo_base_domain || 'amocrm.ru';
  return `https://${project.amo_subdomain}.${domain}`;
}

async function amoGet(project, path) {
  const url = `${baseUrl(project)}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${project.amo_token}` },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

function getLead(project, leadId) {
  return amoGet(project, `/api/v4/leads/${leadId}?with=contacts`);
}

function getContact(project, contactId) {
  return amoGet(project, `/api/v4/contacts/${contactId}`);
}

function getPipelines(project) {
  return amoGet(project, '/api/v4/leads/pipelines');
}

function extractFieldValue(contact, fieldCode) {
  const field = (contact.custom_fields_values || []).find((f) => f.field_code === fieldCode);
  if (!field || !field.values || field.values.length === 0) return null;
  return field.values[0].value || null;
}

module.exports = { baseUrl, getLead, getContact, getPipelines, extractFieldValue };
