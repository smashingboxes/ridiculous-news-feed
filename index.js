'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');
const app = express();

var inMemoryCache = getClearCache();

app.use(express.static('public'));


function getPageContent (newsItems) {
  return `
    <!DOCTYPE html><html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Ridiculous News Feed</title>
        <link rel="stylesheet" href="/main.css" />
        <meta name="viewport" content="width=device-width" />
      </head>
      <body>
        <div class="wrapper">
          <div class="splash">
            <h1>Welcome to the Ridiculous News Feed (RNF).</h1>
            <h2>The RNF pulls a key word from CNN trending news stories using the CNN RSS Newsfeed and marries that to the Giphy API. The resulting mashup is simply ridiculous!<sup>*</sup></h2>
            <small>The following news feed contains juxtapositions of party material that typically results in offensive material. As a matter of course, this content should not be viewed by anyone. View, laugh, and enjoy solely at your own risk.</small>
          </div>
          ${buildImageLoop(newsItems)}
        </div>
        <img class="powered-by-giphy" src="/powered-by-giphy.png" alt="" />
      </body>
    </html>
  `;
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

function getClearCache () {
  console.log('Getting new cache!');
  return {
    date: Date.now(),
    clear: 1000*60*5,
    cnn: null,
    giphy: {}
  }
}

function checkCache (key, deepKey) {
  if ( inMemoryCache.date && inMemoryCache.date + inMemoryCache.clear > Date.now() ) {
    if (inMemoryCache[key] && !deepKey) {
      return inMemoryCache[key];
    } else if ( inMemoryCache[key] && deepKey && inMemoryCache[key][deepKey] ) {
      return inMemoryCache[key][deepKey];
    }
  } else {
    inMemoryCache = getClearCache();
  }
  return null;
}

function putCache (data, key, deepKey) {
  if (!deepKey) {
    inMemoryCache[key] = data;
  } else {
    inMemoryCache[key][deepKey] = data;
  }
  return data;
}

function getCNNFeed () {
  return new Promise((resolve, reject) => {
    if (checkCache('cnn')) {
      resolve( checkCache('cnn') );
      return;
    }
    request.get('http://rss.cnn.com/rss/cnn_latest.rss', (err, cnnRes) => {
      if (err) {
        reject(err);
        return;
      }
      resolve( putCache(cnnRes.body, 'cnn') );
    });
  });
}

function getNewsItems(cnnResBody) {
  return new Promise((resolve, reject) => {
    parseXMLString(cnnResBody, (err, result) => {
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
    if (checkCache('giphy', newsItem.title)) {
      resolve( addGiphyToNewsItem( checkCache('giphy', newsItem.title), newsItem, search) );
      return;
    }
    request.get(`http://api.giphy.com/v1/gifs/search?limit=4&q=${encodeURIComponent(search)}&api_key=${config.API_KEY}`,
      (err, giphyRes) => {
        if (err) {
          reject(err);
          return;
        }

        resolve( addGiphyToNewsItem( putCache(giphyRes.body, 'giphy', newsItem.title), newsItem, search) );
      });
  });
}

function addGiphyToNewsItem (giphyResBody, newsItem, search) {
  let giphyData = JSON.parse(giphyResBody).data;

  if ( giphyData.length ) {
    newsItem.giphyurl = `https://media.giphy.com/media/${randItem(giphyData).id}/giphy.gif`;
    newsItem.search = search;
  } else {
    newsItem.giphyurl = 'https://api.giphy.com/img/giphy_search.gif';
    newsItem.search = null;
  }
  return newsItem;
}

function filterStopWords (arr) {
  return arr; //not used
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

function setupRoutes() {

  app.get('/', (req, res) => {
    console.log('GET / ', Date.now());
    getCNNFeed()
      .then((cnnResBody) => {
        return getNewsItems(cnnResBody);
      })
      .then((newsItems) => {
        return Promise.all( newsItems.map(getNewsGiphy) );
      })
      .then((promises) => {
        sendPageResponse(res, promises);
      });
  });

  app.listen(config.PORT, () => {
    console.log(`App listening on port ${config.PORT}!`);
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

setupRoutes();
