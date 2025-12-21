// netlify/functions/signup.js
// This function handles SMS signups and adds users to Twilio Messaging List for bulk SMS

const twilio = require('twilio');
const fetch = require('node-fetch');

// Initialize Twilio SDK for sending SMS
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio REST API base URL
const TWILIO_BASE_URL = `https://messaging.twilio.com/v1`;
const TWILIO_AUTH = Buffer.from(
  `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
).toString('base64');

const MESSAGING_LIST_NAME = 'SaveOrangeCountyVA';

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

    // Format phone number (E.164 format)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone.slice(-10);

    // Step 1: Get or create the Messaging List
    let listSid;
    try {
      const listsResponse = await fetch(`${TWILIO_BASE_URL}/Services`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TWILIO_AUTH}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!listsResponse.ok) {
        throw new Error(`Failed to fetch lists: ${listsResponse.statusText}`);
      }

      const listsData = await listsResponse.json();
      const existingList = listsData.messaging_services?.find(
        s => s.friendly_name === MESSAGING_LIST_NAME
      );

      if (existingList) {
        listSid = existingList.sid;
        console.log('Found existing list:', listSid);
      } else {
        // Create new Messaging Service (acts as our list)
        const createResponse = await fetch(`${TWILIO_BASE_URL}/Services`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${TWILIO_AUTH}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `FriendlyName=${encodeURIComponent(MESSAGING_LIST_NAME)}`
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create list: ${createResponse.statusText}`);
        }

        const newList = await createResponse.json();
        listSid = newList.sid;
        console.log('Created new list:', listSid);
      }
    } catch (e) {
      console.error('Error managing Twilio list:', e.message);
      // Continue anyway - SMS is most important
    }

    // Step 2: Add phone to list (if we have a list)
    if (listSid) {
      try {
        const addResponse = await fetch(
          `${TWILIO_BASE_URL}/Services/${listSid}/PhoneNumbers`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${TWILIO_AUTH}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `PhoneNumber=${encodeURIComponent(formattedPhone)}`
          }
        );

        if (addResponse.ok) {
          console.log('Added phone to list:', formattedPhone);
        } else {
          const error = await addResponse.text();
          console.log('Note: Could not add to list (may already exist):', error);
        }
      } catch (e) {
        console.log('Warning: Could not add to list:', e.message);
        // Continue - SMS is the priority
      }
    }

    // Step 3: Send welcome SMS (most important!)
    try {
      const message = await twilioClient.messages.create({
        body: 'Welcome to Save Orange County VA! You\'ll receive text alerts about upcoming data center planning meetings. Reply STOP to unsubscribe.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      console.log('Welcome SMS sent to:', formattedPhone);
    } catch (e) {
      console.error('SMS send error:', e.message);
      throw new Error('Failed to send welcome SMS');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Successfully signed up! Check your phone for a welcome text message.' 
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
