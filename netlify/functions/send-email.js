const RESEND_API_KEY = 're_NZ5yoCAX_aZEbSHxqTqJb25FpV2tDnjiv';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const origin = event.headers['origin'] || event.headers['referer'] || '';
  const allowed = ['https://saveorangecountyva.com', 'https://www.saveorangecountyva.com'];
  if (!allowed.some(o => origin.startsWith(o))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, subject, message, senderName, replyTo } = data;

  if (!to || !subject || !message || !senderName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const htmlContent = `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid #2a5438; padding-bottom: 14px; margin-bottom: 20px;">
        <h2 style="color: #2a5438; margin: 0;">Message from ${senderName}</h2>
        ${replyTo ? `<p style="color: #666; margin: 5px 0 0; font-size: 13px;">${replyTo}</p>` : ''}
      </div>
      <div style="white-space: pre-wrap; line-height: 1.7; color: #222;">${message}</div>
      <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
        Sent via <a href="https://saveorangecountyva.com" style="color: #2a5438;">SaveOrangeCountyVA.com</a>
      </div>
    </div>`;

  const emailPayload = {
    from: 'SaveOrangeCountyVA Action <Action@saveorangecountyva.com>',
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlContent,
    text: message + '\n\n---\nSent via SaveOrangeCountyVA.com'
  };

  if (replyTo) emailPayload.reply_to = replyTo;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: result.message || 'Failed to send' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, id: result.id }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
