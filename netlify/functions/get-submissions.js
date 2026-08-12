// GET /.netlify/functions/get-submissions
// Verifies the caller's Netlify Identity JWT directly against the Identity
// user endpoint, then returns contact-form submissions from the Netlify API.
// Uses the JWT in the Authorization header because clientContext.user is no
// longer reliably populated (Netlify Identity is deprecated).

exports.handler = async (event, context) => {
  const auth = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized', reason: 'missing bearer token', cc: !!context.clientContext, ccUser: !!(context.clientContext && context.clientContext.user) }) };
  }
  const token = auth.slice(7);

  let user = null;

  // 1) Prefer identity info Netlify may have already decoded from the JWT.
  if (context.clientContext && context.clientContext.user) {
    user = context.clientContext.user;
  }

  // 2) Otherwise ask Identity who this token belongs to.
  if (!user) {
    const host = (event.headers && (event.headers.host || event.headers.Host)) || '';
    if (!host) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing host header' }) };
    }
    try {
      const userRes = await fetch(`https://${host}/.netlify/identity/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bodyText = await userRes.text();
      if (userRes.status !== 200) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized', reason: 'identity rejected token', status: userRes.status, tokenSegments: token.split('.').length, body: bodyText.slice(0, 300) }) };
      }
      user = JSON.parse(bodyText);
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Could not verify identity', reason: err.message }) };
    }
  }

  const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  if (!roles.includes('admin')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden - admin role required', email: user && user.email, roles }) };
  }

  const SITE_ID = process.env.NETLIFY_SITE_ID;
  const API_TOKEN = process.env.NETLIFY_API_TOKEN;

  if (!SITE_ID || !API_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing NETLIFY_SITE_ID or NETLIFY_API_TOKEN environment variables' }) };
  }

  try {
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    });
    const forms = await formsRes.json();
    const contactForm = forms.find(f => f.name === 'contact');

    if (!contactForm) {
      return { statusCode: 200, body: JSON.stringify({ total: 0, submissions: [] }) };
    }

    const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${contactForm.id}/submissions`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    });
    const submissions = await subsRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        total: submissions.length,
        submissions: submissions.map(s => ({
          name: s.data.name || '',
          email: s.data.email || '',
          phone: s.data.phone || '',
          company: s.data.company || '',
          service: s.data.service || '',
          message: s.data.message || '',
          created_at: s.created_at
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};