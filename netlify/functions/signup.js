// netlify/functions/signup.js
// This function handles SMS signups and stores phone numbers in Google Sheets

const twilio = require('twilio');

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

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
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Valid phone number required' })
      };
    }

    // Format phone number for Twilio (E.164 format)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone.slice(-10);

    // Check if already subscribed
    try {
      const readUrl = `${SHEETS_API_URL}/${process.env.SUBSCRIBERS_SHEET_ID}/values/Subscribers!A:A?key=${process.env.GOOGLE_API_KEY}`;
      const readResponse = await fetch(readUrl);
      const readData = await readResponse.json();
      
      const existingNumbers = readData.values || [];
      if (existingNumbers.some(row => row[0]?.includes(cleanPhone.slice(-10)))) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'This phone number is already subscribed' })
        };
      }
    } catch (e) {
      console.log('Check existing number skipped (not critical):', e.message);
    }

    // Add to Google Sheets
    const timestamp = new Date().toISOString();
    const appendUrl = `${SHEETS_API_URL}/${process.env.SUBSCRIBERS_SHEET_ID}/values/Subscribers!A:C:append?valueInputOption=USER_ENTERED&key=${process.env.GOOGLE_API_KEY}`;
    
    const appendResponse = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[formattedPhone, name || 'Anonymous', timestamp]]
      })
    });

    if (!appendResponse.ok) {
      const errorData = await appendResponse.json();
      throw new Error(`Google Sheets API error: ${errorData.error?.message || 'Unknown error'}`);
    }

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
    console.error('Signup error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'An error occurred. Please try again later.' 
      })
    };
  }
};
