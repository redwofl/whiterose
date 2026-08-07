// POST /.netlify/functions/verify-purchase  body: { "toolId": "n0va", "sessionId": "cs_..." }
// Confirms with Stripe that the session is paid and matches the tool, then returns the download info.

const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: JSON.stringify({ valid: false, error: 'Not configured' }) };
  }

  let toolId, sessionId;
  try {
    ({ toolId, sessionId } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Invalid body' }) };
  }
  if (!toolId || !sessionId) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Missing params' }) };
  }

  // Load tool metadata
  let tools;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'tools.json'), 'utf8');
    tools = JSON.parse(raw).tools;
  } catch {
    return { statusCode: 500, body: JSON.stringify({ valid: false, error: 'Tools data unavailable' }) };
  }

  const tool = tools.find(t => t.id === toolId);
  if (!tool) {
    return { statusCode: 404, body: JSON.stringify({ valid: false, error: 'Tool not found' }) };
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
    });
    const session = await res.json();

    const paid = session.payment_status === 'paid';
    const matchesTool = !session.metadata || session.metadata.toolId === toolId;

    if (!res.ok || !paid || !matchesTool) {
      return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Payment not confirmed' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true, file: tool.file, name: tool.name, version: tool.version })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ valid: false, error: err.message }) };
  }
};
