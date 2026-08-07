// POST /.netlify/functions/create-checkout  body: { "toolId": "n0va" }
// Creates a Stripe Checkout Session and returns { url } to redirect the buyer to.
// Uses the Stripe REST API via fetch — no npm SDK needed.

const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Checkout not configured' }) };
  }

  let toolId;
  try {
    toolId = JSON.parse(event.body || '{}').toolId;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid body' }) };
  }

  // Load tool metadata
  let tools;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'tools.json'), 'utf8');
    tools = JSON.parse(raw).tools;
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Tools data unavailable' }) };
  }

  const tool = tools.find(t => t.id === toolId);
  if (!tool) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Tool not found' }) };
  }
  if (!tool.price || tool.price <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tool is free' }) };
  }

  const origin = event.headers.origin || event.headers.referer || 'https://whiterose.example.com';
  const base = new URL(origin).origin;

  try {
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(tool.price * 100)),
      'line_items[0][price_data][product_data][name]': `${tool.name} — White Rose Security Labs`,
      'line_items[0][price_data][product_data][description]': tool.description.slice(0, 100),
      success_url: `${base}/tools.html?purchased=${tool.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/tools.html`,
      'metadata[toolId]': tool.id
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: data.error?.message || 'Stripe error' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
