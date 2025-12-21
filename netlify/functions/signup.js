// netlify/functions/signup.js
// This function handles SMS signups and adds users to a Twilio Messaging List

const twilio = require('twilio');

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// The name of our messaging list for bulk messages
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

    // Format phone number for Twilio (E.164 format)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone.slice(-10);

    // Get or create Messaging List
    let messagingListSid;
    
    try {
      // Try to find existing list
      const lists = await twilioClient.messaging.messagingLists.list({ limit: 20 });
      const existingList = lists.find(list => list.friendlyName === MESSAGING_LIST_NAME);
      
      if (existingList) {
        messagingListSid = existingList.sid;
        console.log('Found existing messaging list:', messagingListSid);
      } else {
        // Create new list if it doesn't exist
        const newList = await twilioClient.messaging.messagingLists.create({
          friendlyName: MESSAGING_LIST_NAME
        });
        messagingListSid = newList.sid;
        console.log('Created new messaging list:', messagingListSid);
      }
    } catch (e) {
      console.error('Error managing messaging list:', e.message);
      throw new Error('Failed to manage messaging list');
    }

    // Add phone number to the messaging list
    try {
      await twilioClient.messaging.messagingLists(messagingListSid).addresses.create({
        address: formattedPhone
      });
      console.log('Added to list:', formattedPhone);
    } catch (e) {
      // Phone number might already be in the list - that's okay
      if (e.message && e.message.includes('already exists')) {
        console.log('Phone number already in list:', formattedPhone);
      } else {
        throw e;
      }
    }

    // Send welcome SMS
    const message = await twilioClient.messages.create({
      body: 'Welcome to Save Orange County VA! You\'ll receive text alerts about upcoming data center planning meetings. Reply STOP to unsubscribe.',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log('Welcome SMS sent:', message.sid);

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
