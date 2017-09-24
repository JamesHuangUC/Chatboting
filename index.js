/*jshint esversion: 6 */

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const apiai = require('apiai');

const token = process.env.FB_PAGE_ACCESS_TOKEN;
const access = process.env.FB_ACCESS_TOKEN;
const APIAI_TOKEN = process.env.APIAI_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const GETTY_IMAGES_API_KEY = process.env.GETTY_IMAGES_API_KEY;

const apiaiApp = apiai(APIAI_TOKEN);

const app = express();

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
    res.send('Hello world');
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === token) {
        res.send(req.query['hub.challenge']);
    }
    res.send('No entry');
});

// Receive Messages
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
  
function receivedMessage(event) {
  // Putting a stub for now, we'll expand it in the following steps
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log("BBB: "+JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  // Handle API.AI
  const apiaiHandle = apiaiApp.textRequest(messageText, {
      sessionId: 'randomSessionId'
  });

  if (messageText) {

    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'generic':
        sendGenericMessage(senderID);
        break;

      default:
        apiaiHandle.on('response', function(response) {
          console.log("CCC: "+response);

          let aiText = response.result.fulfillment.speech;

          if (response.result.metadata.intentName === 'images.search') {
            aiText.includes("http")? sendImage(senderID, aiText) : sendTextMessage(senderID, aiText);
          } else if (response.result.metadata.intentName === 'courses.schedule'){
            console.log("GGG");
            sendTextMessage(senderID, aiText);
          } else if (response.result.metadata.intentName === 'courses.location'){
            console.log("HHH");
            sendTextMessage(senderID, aiText);
          } else if (response.result.metadata.intentName === 'courses.professor'){
            console.log("III");
            sendTextMessage(senderID, aiText);
          } else if (response.result.metadata.intentName === 'courses.ge'){
            console.log("JJJ");
            sendTextMessage(senderID, aiText);
          } else if (response.result.metadata.intentName === 'courses.prerequisite'){
            console.log("JJJ");
            sendTextMessage(senderID, aiText);
          } else {
            sendTextMessage(senderID, aiText);
          }
        });

        apiaiHandle.on('error', function(error) {
          console.log(error);
        });
        apiaiHandle.end();
    }
  }
    
  else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
} 


function sendGenericMessage(recipientId, messageText) {
  console.log("DDD");
    var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}


function sendTextMessage(recipientId, aiText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: aiText
    }
  };
  console.log("EEE");
  callSendAPI(messageData);
}


function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: access },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;
      console.log("FFF");

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}


const sendImage = (senderId, imageUri) => {
  return request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: access },
    method: 'POST',
    json: {
      recipient: { id: senderId },
      message: {
        attachment: {
            type: 'image',
            payload: { url: imageUri }
        }
      }
    }
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;
      console.log("FFF");

      console.log("Successfully sent generic image with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send image.");
      console.error(response);
      console.error(error);
    }
  });
};


// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'));
});

/* Webhook for API.ai to get response from the 3rd party API */
app.post('/ai', (req, res) => {
  console.log('*** Webhook for api.ai query ***');
  console.log(req.body.result);

  if (req.body.result.action === 'weather') {
    console.log('*** weather ***');
    let city = req.body.result.parameters['geo-city'];

    if (city === 'Santa Cruz') city = city.concat(',us');

    let restUrl = 'http://api.openweathermap.org/data/2.5/weather?APPID='+WEATHER_API_KEY+'&q='+city;
    restUrl = restUrl.replace(/ /g, "-");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200) {
        let json = JSON.parse(body);
        console.log(json);
        let tempF = ~~(json.main.temp * 9/5 - 459.67);
        let tempC = ~~(json.main.temp - 273.15);
        let msg = 'The current condition in ' + json.name + ' is ' + json.weather[0].description + ' and the temperature is ' + tempF + ' ℉ (' +tempC+ ' ℃).';
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'weather'
        });
      } else {
        let errorMessage = 'I failed to look up the city name.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

  if (req.body.result.action === 'image') {
    const imageName = req.body.result.parameters['image_name'];
    const apiUrl = 'https://api.gettyimages.com/v3/search/images?fields=id,title,thumb,referral_destinations&sort_order=best&phrase=' + imageName;

    console.log(apiUrl);
    
    request({
      uri: apiUrl,
      methos: 'GET',
      headers: {'Api-Key': GETTY_IMAGES_API_KEY}
      }, (err, response, body) => 
      {
        if (!err && response.statusCode == 200 && JSON.parse(body).images[0]) {
          const imageUri = JSON.parse(body).images[0].display_sizes[0].uri;
          return res.json({
              speech: imageUri,
              displayText: imageUri,
              source: 'image_name'
          });
        } else {
            let errorMessage = 'I failed to look up the picture.';
            return res.status(400).json({
              status: {
                code: 400,
                errorType: errorMessage
              }
            });
          }
      }
    );
  }

  if (req.body.result.action === 'schedule') {
    console.log('*** schedule ***');
    let course = req.body.result.parameters['course_name'];
    let restUrl = 'http://chatboting.azurewebsites.net/api/ucsc?Course='+course;
    restUrl = restUrl.replace(/ /g, "%20");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = "";

        if (json.length > 1) {
          json.forEach((e,i) =>{
            msg += `Section ${i+1}: ${e.Schedule}\n`;});
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'schedule'
          });
        } else{
          let schedule = json[0].Schedule;
          msg = `${json[0].Course[0]}\'s schedule is ${schedule}.`; 
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'schedule'
          });
        }

      } else {
        let errorMessage = 'I failed to look up the course schedule.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

  if (req.body.result.action === 'location') {
    console.log('*** location ***');
    let course = req.body.result.parameters['course_name'];
    let restUrl = 'http://chatboting.azurewebsites.net/api/ucsc?Course='+course;
    restUrl = restUrl.replace(/ /g, "%20");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = "";

        if (json.length > 1) {
          json.forEach((e,i) =>{
            msg += `Section ${i+1}: ${e.Location}\n`;});
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'location'
          });
        } else{
          let location = json[0].Location;
          msg = `${json[0].Course[0]} is located in ${location}.`; 
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'location'
          });
        }

      } else {
        let errorMessage = 'I failed to look up the course location.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

  if (req.body.result.action === 'professor') {
    console.log('*** professor ***');
    let course = req.body.result.parameters['course_name'];
    let restUrl = 'http://chatboting.azurewebsites.net/api/ucsc?Course='+course;
    restUrl = restUrl.replace(/ /g, "%20");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = "";

        if (json.length > 1) {
          json.forEach((e,i) =>{
            msg += `${e.Professor[0]} is teaching section ${i+1}\n`;});
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'professor'
          });
        } else{
          let professor = json[0].Professor[0];
          msg = `${professor} is teaching ${json[0].Course[0]}.`; 
          return res.json({
            speech: msg,
            displayText: msg,
            source: 'professor'
          });
        }

      } else {
        let errorMessage = 'I failed to look up the course professor.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

  if (req.body.result.action === 'ge') {
    console.log('*** ge ***');
    let course = req.body.result.parameters['course_name'];
    let restUrl = 'http://chatboting.azurewebsites.net/api/ucsc?Course='+course;
    restUrl = restUrl.replace(/ /g, "%20");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let ge = json[0]['General Education'];
        console.log(`TEST GE:${ge}.`);
        let msg = '';
        if ( !ge.replace(/\s/g, '').length ) {          
          msg = `${json[0].Course[0]}\ doesn't fulfill any general education :(`;          
        } else {
          msg = `${json[0].Course[0]}\ fulfills ${ge}.`;
        }
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'ge'
        });
      } else {
        let errorMessage = 'I failed to look up the course general education.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

  if (req.body.result.action === 'prerequisite') {
    console.log('*** prerequisite ***');
    let course = req.body.result.parameters['course_name'];
    let restUrl = 'http://chatboting.azurewebsites.net/api/ucsc?Course='+course;
    restUrl = restUrl.replace(/ /g, "%20");
    console.log(`TEST ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let prerequisite = json[0].Prerequisite;
        let msg = '';
        if (prerequisite === ' ') {
          msg = `${json[0].Course[0]}\ doesn't have any prerequisite :)`;
        } else {
          msg = `${json[0].Course[0]}\'s prerequisite:\n${prerequisite}`;
        }
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'prerequisite'
        });
      }

      else {
        let errorMessage = 'I failed to look up the course prerequisite.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    });
  }

});

