'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');

let search = 'funny cat';
const app = express();
app.use(express.static('public'));

function filterStopWords (arr) {
  return arr;
}

function getTitleWordArray (title) {
  return title.split(' ').filter((word) => {
    return word.length > 4;
  });
}

function getSearchWord (title) {
  let wordArray = getTitleWordArray(title);
  return randItem(wordArray);
}

function randItem (arr) {
  return arr[ Math.floor(Math.random()*arr.length) ];
}

function buildImageLoop (newsItems) {
  let imageStack = [];
  newsItems.forEach((newsItem, i) => {
    imageStack.push(`
      <div class="article">
        <h2>
          <a href="${newsItem.url}" target="_blank">
            ${highlightSearchTerm(newsItem.title, newsItem.search)}
          </a>
        </h2>
        <img src="${newsItem.giphyurl}" alt="" />
      </div>
    `);
  });
  return imageStack.join(' \n');
}

function highlightSearchTerm (title, search) {
  if ( search ) title = title.replace(search, '<strong>'+search+'<\/strong>');
  //console.log(title, ' -- ', search);
  return title;
}

function getPageContent (newsItems) {
  return `
    <!DOCTYPE html><html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Offensive News Feed</title>
        <link rel="stylesheet" href="/main.css" />
      </head>
      <body>
        <div class="wrapper">
          ${buildImageLoop(newsItems)}
        </div>
      </body>
    </html>
  `;
}

function getCNNFeed () {
  return new Promise((resolve, reject) => {
    request.get('http://rss.cnn.com/rss/cnn_latest.rss', (err, cnnRes) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(cnnRes);
    });
  });
}

function getNewsItems(cnnRes) {
  return new Promise((resolve, reject) => {
    parseXMLString(cnnRes.body, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      let cnnXML = result;
      let newsItems = cnnXML.rss.channel[0].item.map((newsItem, i) => {
        return {
          title: newsItem.title[0],
          url: newsItem.guid[0]['_'],
          giphyurl: null,
          search: null
        }
      });
      resolve(newsItems);
    });
  });
}

function getNewsGiphy (newsItem) {
  return new Promise((resolve, reject) => {
    let search = getSearchWord(newsItem.title);
    request.get(`http://api.giphy.com/v1/gifs/search?limit=4&q=${encodeURIComponent(search)}&api_key=${config.API_KEY}`,
      (err, giphyRes) => {
        if (err) {
          reject(err);
          return;
        }

        let giphyData = JSON.parse(giphyRes.body).data;

        if ( giphyData.length ) {
          newsItem.giphyurl = `https://media.giphy.com/media/${randItem(giphyData).id}/giphy.gif`;
          newsItem.search = search;
        } else {
          newsItem.giphyurl = 'https://api.giphy.com/img/giphy_search.gif';
          newsItem.search = null;
        }
        resolve(newsItem);
      });
  });
}

function sendPageResponse(res, newsItems) {
  getPageContent(newsItems).split('\n').forEach((pageLine, i, arr) => {
    process.nextTick(() => {
      //console.log(pageLine);
      res.write(pageLine);
      if ( i === arr.length-1) {
        res.end();
      }
    });
  })
}

function setupRoutes() {

  app.get('/', (req, res) => {
    console.log('GET / ', Date.now())
    getCNNFeed()
      .then((cnnRes) => {
        return getNewsItems(cnnRes);
      })
      .then((newsItems) => {
        return Promise.all( newsItems.map(getNewsGiphy) );
      })
      .then((promises) => {
        //console.log(promises);
        //res.end('duh');
        sendPageResponse(res, promises);
      });
  });

  app.listen(config.PORT, () => {
    console.log(`App listening on port ${config.PORT}!`);
  });

}

setupRoutes();
