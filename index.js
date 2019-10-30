'use strict';

const http = require('http');
const express = require('express');
const request = require('request');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { dialogflowClient } = require('./dialogflowClient');

// Environment variables
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const FLICKR_API = process.env.FLICKR_API;

const app = express();

app.use(express.json()); // creates express http server
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 1337;

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response;

  // Checks if the message contains text
  if (received_message.text) {
    // Creates the payload for a basic text message, which
    // will be added to the body of our request to the Send API

    let responseMsg = await dialogflowClient(received_message.text);
    console.log(responseMsg);
    // let responseMsg = `You sent the message: "${received_message.text}". Now send me an attachment!`;
    if (responseMsg.includes('http')) {
      response = {
        attachment: {
          type: 'image',
          payload: {
            url: responseMsg,
            is_reusable: true
          }
        }
      };
    } else if (received_message.attachments) {
      // Gets the URL of the message attachment
      let attachment_url = received_message.attachments[0].payload.url;
      response = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: 'Is this the right picture?',
                subtitle: 'Tap a button to answer.',
                image_url: attachment_url,
                buttons: [
                  {
                    type: 'postback',
                    title: 'Yes!',
                    payload: 'yes'
                  },
                  {
                    type: 'postback',
                    title: 'No!',
                    payload: 'no'
                  }
                ]
              }
            ]
          }
        }
      };
    } else {
      response = {
        text: responseMsg
      };
    }

    // Send the response message
    callSendAPI(sender_psid, response);
  }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { text: 'Thanks!' };
  } else if (payload === 'no') {
    response = { text: 'Oops, try sending another image.' };
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    message: response
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: 'https://graph.facebook.com/v4.0/me/messages',
      qs: { access_token: FB_PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: request_body
    },
    (err, res, body) => {
      if (!err) {
        console.log('message sent!');
      } else {
        console.error('Unable to send message:' + err);
      }
    }
  );
}

// Add webhook verification
app.get('/webhook', (req, res) => {
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Add webhook endpoint
app.post('/webhook', (req, res) => {
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

//-------------------------------------------------------------------
// Dialogflow webhook
app.post('/dialogflow', (req, res) => {
  console.log(JSON.stringify(req.body));

  //--------------movie intent-------------
  if (req.body.queryResult.action === 'movie') {
    const movieToSearch =
      req.body.queryResult &&
      req.body.queryResult.parameters &&
      req.body.queryResult.parameters.movie
        ? req.body.queryResult.parameters.movie
        : '';

    let reqUrl = '';
    if (movieToSearch !== '') {
      reqUrl = encodeURI(
        `http://www.omdbapi.com/?t=${movieToSearch}&apikey=${OMDB_API_KEY}`
      );
      http.get(
        reqUrl,
        responseFromAPI => {
          let completeResponse = '';
          responseFromAPI.on('data', chunk => {
            completeResponse += chunk;
          });
          responseFromAPI.on('end', () => {
            // console.log(completeResponse);
            const movie = JSON.parse(completeResponse);

            let dataToSend = `${movie.Title} was released in the year ${
              movie.Year
            }. It is directed by ${movie.Director} and stars ${
              movie.Actors
            }.\nHere some glimpse of the plot:\n${movie.Plot}`;

            return res.json({
              fulfillmentText: dataToSend,
              source: 'movie'
            });
          });
        },
        error => {
          return res.json({
            fulfillmentText: 'Could not get results at this time.',
            source: 'movie'
          });
        }
      );
    } else {
      return res.json({
        fulfillmentText: 'The moive cannot be found.',
        source: 'movie'
      });
    }
  }

  //--------------weather intent-------------
  if (req.body.queryResult.action === 'weather') {
    let city = req.body.queryResult.parameters['geo-city'];

    if (city === 'Santa Cruz') city = city.concat(',us');

    let restUrl =
      'http://api.openweathermap.org/data/2.5/weather?APPID=' +
      WEATHER_API_KEY +
      '&q=' +
      city;
    restUrl = restUrl.replace(/ /g, '+');
    console.log(`weather url ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode === 200) {
        let json = JSON.parse(body);
        // console.log(json);
        let tempF = ~~(json.main.temp * 9 / 5 - 459.67);
        let tempC = ~~(json.main.temp - 273.15);
        let msg =
          'The current condition in ' +
          json.name +
          ' is ' +
          json.weather[0].description +
          ' and the temperature is ' +
          tempF +
          ' ℉ (' +
          tempC +
          ' ℃).';
        return res.json({
          fulfillmentText: msg,
          source: 'weather'
        });
      } else {
        let errorMessage = 'I failed to look up the city name.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'weather'
        });
      }
    });
  }

  //--------------image intent-------------
  if (req.body.queryResult.action === 'image') {
    const imageName = req.body.queryResult.parameters['image_name'];

    const apiUrl = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${FLICKR_API}&text=${imageName}&format=json&nojsoncallback=1`;

    // const apiUrl = 'https://api.gettyimages.com/v3/search/images?fields=id,title,thumb,referral_destinations&sort_order=best&phrase=' + imageName;

    console.log(apiUrl);

    request(
      {
        uri: apiUrl,
        methos: 'GET'
        // headers: { 'Api-Key': GETTY_IMAGES_API_KEY }
      },
      (err, response, body) => {
        if (!err && response.statusCode == 200 && JSON.parse(body).photos) {
          // const imageUri = JSON.parse(body).images[0].display_sizes[0].uri;
          const photoRes = JSON.parse(body);
          let flickrFarmId = photoRes.photos.photo[0].farm;
          let flickrServerId = photoRes.photos.photo[0].server;
          let flickrId = photoRes.photos.photo[0].id;
          let flickrSecret = photoRes.photos.photo[0].secret;
          let imageUri = `https://farm${flickrFarmId}.staticflickr.com/${flickrServerId}/${flickrId}_${flickrSecret}_s.jpg`;

          console.log(`image url ${imageUri}`);
          return res.json({
            fulfillmentText: imageUri,
            source: 'image'
          });
        } else {
          let errorMessage = 'I failed to look up the picture.';
          return res.json({
            fulfillmentText: errorMessage,
            source: 'image'
          });
        }
      }
    );
  }

  //--------------course schedule intent-------------
  if (req.body.queryResult.action === 'schedule') {
    console.log('*** schedule ***');
    let course = req.body.queryResult.parameters['course_name'];
    let restUrl =
      'http://chatboting.azurewebsites.net/api/ucsc?Course=' + course;
    restUrl = restUrl.replace(/ /g, '%20');
    console.log(`course url ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = '';

        if (json.length > 1) {
          json.forEach((e, i) => {
            msg += `Section ${i + 1}: ${e.Schedule}\n`;
          });
          return res.json({
            fulfillmentText: msg,
            source: 'schedule'
          });
        } else {
          let schedule = json[0].Schedule;
          msg = `${json[0].Course[0]}\'s schedule is ${schedule}.`;
          return res.json({
            fulfillmentText: msg,
            source: 'schedule'
          });
        }
      } else {
        let errorMessage = 'I failed to look up the course schedule.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'schedule'
        });
      }
    });
  }

  //--------------course location intent-------------
  if (req.body.queryResult.action === 'location') {
    console.log('*** location ***');
    let course = req.body.queryResult.parameters['course_name'];
    let restUrl =
      'http://chatboting.azurewebsites.net/api/ucsc?Course=' + course;
    restUrl = restUrl.replace(/ /g, '%20');
    console.log(`course url ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = '';

        if (json.length > 1) {
          json.forEach((e, i) => {
            msg += `Section ${i + 1}: ${e.Location}\n`;
          });
          return res.json({
            fulfillmentText: msg,
            source: 'location'
          });
        } else {
          let location = json[0].Location;
          msg = `${json[0].Course[0]} is located in ${location}.`;
          return res.json({
            fulfillmentText: msg,
            source: 'location'
          });
        }
      } else {
        let errorMessage = 'I failed to look up the course location.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'location'
        });
      }
    });
  }

  //--------------course professor intent-------------
  if (req.body.queryResult.action === 'professor') {
    console.log('*** professor ***');
    let course = req.body.queryResult.parameters['course_name'];
    let restUrl =
      'http://chatboting.azurewebsites.net/api/ucsc?Course=' + course;
    restUrl = restUrl.replace(/ /g, '%20');
    console.log(`course url ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let msg = '';

        if (json.length > 1) {
          json.forEach((e, i) => {
            msg += `${e.Professor[0]} is teaching section ${i + 1}\n`;
          });
          return res.json({
            fulfillmentText: msg,
            source: 'professor'
          });
        } else {
          let professor = json[0].Professor[0];
          msg = `${professor} is teaching ${json[0].Course[0]}.`;
          return res.json({
            fulfillmentText: msg,
            source: 'professor'
          });
        }
      } else {
        let errorMessage = 'I failed to look up the course professor.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'professor'
        });
      }
    });
  }

  //--------------course ge intent-------------
  if (req.body.queryResult.action === 'ge') {
    console.log('*** ge ***');
    let course = req.body.queryResult.parameters['course_name'];
    let restUrl =
      'http://chatboting.azurewebsites.net/api/ucsc?Course=' + course;
    restUrl = restUrl.replace(/ /g, '%20');
    console.log(`course url ${restUrl}`);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200 && course) {
        let json = JSON.parse(body);
        let ge = json[0]['General Education'];
        let msg = '';
        if (!ge.replace(/\s/g, '').length) {
          msg = `${
            json[0].Course[0]
          }\ doesn't fulfill any general education :(`;
        } else {
          msg = `${json[0].Course[0]}\ fulfills ${ge}.`;
        }
        return res.json({
          fulfillmentText: msg,
          source: 'ge'
        });
      } else {
        let errorMessage = 'I failed to look up the course general education.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'ge'
        });
      }
    });
  }

  //--------------course prerequisite intent-------------
  if (req.body.queryResult.action === 'prerequisite') {
    console.log('*** prerequisite ***');
    let course = req.body.queryResult.parameters['course_name'];
    let restUrl =
      'http://chatboting.azurewebsites.net/api/ucsc?Course=' + course;
    restUrl = restUrl.replace(/ /g, '%20');
    console.log(`course url ${restUrl}`);

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
          fulfillmentText: msg,
          source: 'prerequisite'
        });
      } else {
        let errorMessage = 'I failed to look up the course prerequisite.';
        return res.json({
          fulfillmentText: errorMessage,
          source: 'prerequisite'
        });
      }
    });
  }
});

app.listen(PORT, () => console.log(`webhook is listening on port ${PORT}...`));
