// netlify/functions/signup.js
// This function handles SMS signups and stores phone numbers in Google Sheets

const { google } = require('googleapis');
const twilio = require('twilio');

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Google Sheets
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
    const { phone, name } = JSON.parse(event.body);

    // Validate phone number
    if (!phone || phone.length < 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Valid phone number required' })
      };
    }

    // Format phone number for Twilio (basic E.164 format)
    const formattedPhone = '+1' + phone.replace(/\D/g, '').slice(-10);

    // Check if already subscribed (optional - remove if you want duplicates)
    const authClient = await auth.getClient();
    const readResponse = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: process.env.SUBSCRIBERS_SHEET_ID,
      range: 'Subscribers!A:A',
    });

    const existingNumbers = readResponse.data.values || [];
    if (existingNumbers.some(row => row[0]?.includes(phone.replace(/\D/g, '')))) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'This phone number is already subscribed' })
      };
    }

    // Add to Google Sheets
    const timestamp = new Date().toISOString();
    const authClient2 = await auth.getClient();
    
    await sheets.spreadsheets.values.append({
      auth: authClient2,
      spreadsheetId: process.env.SUBSCRIBERS_SHEET_ID,
      range: 'Subscribers!A:C',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[formattedPhone, name || 'Anonymous', timestamp]]
      }
    });

    // Send confirmation SMS
    await twilioClient.messages.create({
      body: 'Welcome to Save Orange County VA! You\'ll receive alerts about upcoming data center planning meetings. Reply STOP to unsubscribe.',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Successfully signed up! Check your phone for confirmation.' 
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'An error occurred. Please try again later.' 
      })
    };
  }
};
