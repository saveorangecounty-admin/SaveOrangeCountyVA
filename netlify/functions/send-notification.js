// netlify/functions/send-notification.js
// This function sends SMS alerts to all subscribers
// Call with: POST /.netlify/functions/send-notification
// Body: { "message": "Your message here", "adminToken": "YOUR_SECRET_TOKEN" }

const { google } = require('googleapis');
const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sheets = google.sheets('v4');

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const { message, adminToken } = JSON.parse(event.body);

    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    if (!message || message.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Message is required' })
      };
    }

    // Get all subscribers from Google Sheets
    const authClient = await auth.getClient();
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: process.env.SUBSCRIBERS_SHEET_ID,
      range: 'Subscribers!A:C',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No subscribers found' })
      };
    }

    // Skip header row and send to all subscribers
    const subscribers = rows.slice(1);
    let successCount = 0;
    let failureCount = 0;

    for (const [phone, name] of subscribers) {
      try {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${phone}:`, error.message);
        failureCount++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Notifications sent successfully`,
        successCount,
        failureCount,
        totalAttempted: subscribers.length
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'An error occurred while sending notifications',
        error: error.message
      })
    };
  }
};
