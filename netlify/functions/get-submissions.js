exports.handler = async (event, context) => {
  const { user } = context.clientContext || {};

  if (!user || !user.app_metadata?.roles?.includes('admin')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
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
