'use strict';

const dialogflow = require('dialogflow');
const uuid = require('uuid');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Environment variables
const DIALOGFLOW_PRIVATE_KEY = process.env.DIALOGFLOW_PRIVATE_KEY;
const DIALOGFLOW_CLIENT_EMAIL = process.env.DIALOGFLOW_CLIENT_EMAIL;
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
/**
 * Send a query to the dialogflow agent, and return the query result.
 */
async function dialogflowClient(receivedMessage) {
  // Dialogflow sessions client cnnfig
  const privateKey =
    process.env.NODE_ENV === 'production'
      ? JSON.parse(DIALOGFLOW_PRIVATE_KEY).private_key
      : DIALOGFLOW_PRIVATE_KEY;

  const config = {
    credentials: {
      private_key: privateKey.replace(new RegExp('\\\\n', 'g'), '\n'),
      client_email: DIALOGFLOW_CLIENT_EMAIL
    }
  };

  // Create a new session
  const sessionClient = new dialogflow.SessionsClient(config);

  // A unique identifier for the given session
  const sessionId = uuid.v4();
  const sessionPath = sessionClient.sessionPath(
    DIALOGFLOW_PROJECT_ID,
    sessionId
  );

  // The text query request.
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: receivedMessage,
        // The language used by the client (en-US)
        languageCode: 'en-US'
      }
    }
  };

  // Send request and log result
  const responses = await sessionClient.detectIntent(request);
  console.log('Detected intent');
  const result = responses[0].queryResult;
  console.log(`  Query: ${result.queryText}`);
  console.log(`  Response: ${result.fulfillmentText}`);
  if (result.intent) {
    console.log(`  Intent: ${result.intent.displayName}`);
  } else {
    console.log(`  No intent matched.`);
  }

  return result.fulfillmentText;
}

module.exports.dialogflowClient = dialogflowClient;
