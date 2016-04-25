'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');
const app = express();
const RANDOM_GIF_STACK = [
  'iVXnxXShe6iFW',
  '11eS1vhyWtwkSc',
  'mTBmhUxtB8zYY',
  'D6KqqW9P2ziAo',
  '4Y3JTG2695Q08',
  'NajzuwkWCQFVe',
  '3olneNn6cwHp6',
  '2XflxzIq5kdkiQqaQso',
  'xXQmihxsTUOSQ',
  'Oppj4wEY7Vmes',
  'LY2UeuEPUIpMY'
];

let REGEX_URL = new RegExp("((%[0-9A-Fa-f]{2}|[-()_.!~*';/?:@&=+$,A-Za-z0-9])+)([).!';/?:,][[:blank:]])?$");
let REGEX_TEXT = new RegExp('^[a-zA-Z0-9.,?:\'\ -]+$');

let inMemoryCache = getClearCache();

app.use(express.static('public'));


function getPageContent (newsItems, hideSplash) {
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
          <div class="splash" style="${hideSplash}">
            <h1>Welcome to the Ridiculous News Feed (RNF).</h1>
            <h2>The RNF pulls a key word from CNN trending news stories using the CNN RSS Newsfeed and marries that to the Giphy API. The resulting mashup is simply ridiculous!<sup>*</sup></h2>
            <small>*The following news feed contains juxtapositions of material that typically results in an offensive combination. Plus, the image feed is uncensored. As a matter of course, this content should not be viewed by anyone. View, laugh, and enjoy solely at your own risk.</small>
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
          <a href="http://www.cnn.com/${newsItem.url}" target="_blank" data-meta="${newsItem.search}">
            ${highlightSearchTerm(newsItem.title, newsItem.search)}
          </a>
        </h2>
        <a href="/${encodeURIComponent(newsItem.search)}/${encodeURIComponent(newsItem.giphyid)}/${encodeURIComponent(newsItem.url)}/${encodeURIComponent(newsItem.title)}">
          <img src="https://media.giphy.com/media/${newsItem.giphyid}/giphy.gif" alt="" />
        </a>
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
  return {
    date: Date.now(),
    clear: 1000*60*5,
    cnn: null,
    giphy: {},
    search: {}
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
          url: (newsItem.guid[0] || newsItem.link[0]).replace('http://www.cnn.com/',''),
          giphyid: null,
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

  console.log(newsItem,search);
  if ( giphyData.length ) {
    newsItem.giphyid = randItem(giphyData).id;
    newsItem.search = (search || '').replace(/[^a-zA-Z0-9]*/gi,'');
  } else {
    newsItem.giphyid = RANDOM_GIF_STACK[ Math.floor(Math.random()*RANDOM_GIF_STACK.length) ];
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
  return checkCache('search', title) || putCache( randItem( (getTitleWordArray(title)) ), 'search', title );
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

  app.get('/:search/:giphyid/:cnnurl/:cnntitle', (req, res) => {
    let item = {
      title: REGEX_TEXT.test(req.params.cnntitle) ? req.params.cnntitle : '',
      url: REGEX_URL.test(req.params.cnnurl) ? req.params.cnnurl : '',
      giphyid: REGEX_TEXT.test(req.params.giphyid) ? req.params.giphyid : '',
      search: REGEX_TEXT.test(req.params.search) ? req.params.search : ''
    };
    sendPageResponse(res, [item], 'display: none;');
    console.log(item);
  });

  app.listen(config.PORT, () => {
    console.log(`App listening on port ${config.PORT}!`);
  });

}

function sendPageResponse(res, newsItems, hideSplash) {
  getPageContent(newsItems, hideSplash).split('\n').forEach((pageLine, i, arr) => {
    process.nextTick(() => {
      //console.log(pageLine);
      if (!!pageLine) {
        res.write(pageLine+'\n');
      }
      if ( i === arr.length-1) {
        res.end();
      }
    });
  })
}

setupRoutes();
