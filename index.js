'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');

let search = 'funny cat';
const app = express();

function filterStopWords (arr) {
  return arr;
}

function getTitleWordArray (title) {
  return title.split(' ').filter((word) => {
    return word.length > 4;
  });
}

function getWord (title) {
  let wordArray = getTitleWordArray(title);
  return randItem(wordArray);
}

function randItem (arr) {
  return arr[ Math.floor(Math.random()*arr.length) ];
}

function buildImageLoop (newsItemTitles, giphyURLS) {
  let imageStack = [];
  newsItemTitles.forEach((title, i) => {
    imageStack.push(`
      <div class="article">
        <h2>${title}</h2>
        <img src="${giphyURLS[i]}" alt="" />
      </div>
    `);
  });
  return imageStack.join(' \n');
}

function sendPageResponse(res, newsItemTitles, giphyURLS) {
  res.end(`
    <!DOCTYPE html><html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Offensive News Feed</title>
        <style>
          html, body {
            margin: 0;
            font-family: sans-serif;
          }
          .article {
            width: 100%;
            height: 100vh;
            position: relative;
          }
          .article h2 {
            text-align: center;
            padding: 20px;
            background-color: #FFF;
            position: absolute;
            top: 60%;
            right: 0;
            font-size: 200%;
          }
          .article img {
            display: block;
            text-align: center;
            height: 100vh;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          ${buildImageLoop(newsItemTitles, giphyURLS)}
        </div>
      </body>
    </html>
  `);
}

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

          let search = getWord(title);
          request.get(`http://api.giphy.com/v1/gifs/search?limit=4&q=${encodeURIComponent(search)}&api_key=${config.API_KEY}`,
            (err, giphyRes) => {
              asyncCounter++;
              let giphyData = JSON.parse(giphyRes.body).data;
              if ( giphyData.length ) {
                giphyURLS.push(`https://media.giphy.com/media/${randItem(giphyData).id}/giphy.gif`);
              } else {
                giphyURLS.push('https://api.giphy.com/img/giphy_search.gif');
              }
              if (asyncCounter >= newsItemTitles.length) {
                sendPageResponse(res, newsItemTitles, giphyURLS);
              }
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
