'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');

let search = 'funny cat';
const app = express();

function setup() {

  app.get('/', (req, res) => {
    request.get('http://rss.cnn.com/rss/cnn_latest.rss', (err, cnnRes) => {

      parseXMLString(cnnRes.body, (err, result) => {

        let cnnXML = result;
        //res.end( JSON.stringify(cnnXML, null, 4) );
        let newsItemTitles = cnnXML.rss.channel[0].item.map((newsItem, i) => {
          return newsItem.title[0];
        });

        let asyncCounter = 0;
        let giphyURLS = [];
        newsItemTitles.forEach((title) => {

          request.get(`http://api.giphy.com/v1/gifs/search?limit=4&q=${encodeURIComponent(search)}&api_key=${config.API_KEY}`,
            (err, giphyRes) => {
              let giphyData = JSON.parse(giphyRes.body).data;
              if ( giphyData.length ) {

              }
              res.json(giphyRes.body);
            });
        });


      });

    });

  });

  app.listen(config.PORT, () => {
    console.log(`App listening on port ${config.PORT}!`);
  });

}

setup();
