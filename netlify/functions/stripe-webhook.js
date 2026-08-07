// POST /.netlify/functions/stripe-webhook
// Verifies the Stripe webhook signature and handles checkout.session.completed.
// Point Stripe dashboard → Webhooks at: https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook

const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Webhook not configured' }) };
  }

  const signature = event.headers['stripe-signature'];
  if (!signature) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing signature' }) };
  }

  const payload = event.body;
  const parts = {};
  signature.split(',').forEach(p => {
    const [k, v] = p.split('=');
    parts[k.trim()] = v;
  });

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${parts.t}.${payload}`)
    .digest('hex');

  const ok = parts.v1 && expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));

  if (!ok) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  // Replay protection: reject signatures older than 5 minutes
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Signature expired' }) };
  }

  try {
    const eventObj = JSON.parse(payload);
    switch (eventObj.type) {
      case 'checkout.session.completed': {
        const session = eventObj.data.object;
        // Payment confirmed — you could email the buyer the download link here,
        // log the sale, or store the license key. The public page already verifies
        // the session via verify-purchase, so nothing else is required to function.
        console.log('Payment completed:', session.metadata?.toolId, session.customer_email || '');
        return { statusCode: 200, body: JSON.stringify({ received: true }) };
      }
      default:
        return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
