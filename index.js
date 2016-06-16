'use strict';
const request = require('request');
const express = require('express');
const parseXMLString = require('xml2js').parseString;
const config = require('./config');
const app = express();
const RANDOM_GIF_STACK = [
  '3o8doM1LK2PVaxawpO',
  'szHmu14WGIgtW',
  '3ornk2ZJkSbfspoywE',
  'co7p6NZDj2IX6',
  '1nLCRW0Cf1xm0',
  'KGZ6jhUxQ09C8',
  '3osxYuBK7ekDvwEkcE',
  'l3V0niupDZOaeCXYs',
  '6IVq9lErsYbEA',
  'CXU8axmXoPHUY',
  'pHYv3mfrEHG3m'
];

let REGEX_URL = new RegExp("((%[0-9A-Fa-f]{2}|[-()_.!~*';/?:@&=+$,A-Za-z0-9])+)([).!';/?:,][[:blank:]])?$");
let REGEX_TEXT = new RegExp('^[a-zA-Z0-9.,?:\'\ -]+$');

let inMemoryCache = getClearCache();

app.use(express.static('public'));


function getPageContent (newsItems, hideSplash, footerAddon, titleAddon) {
  return `
    <!DOCTYPE html><html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Ridiculous News Feed${titleAddon||''}</title>
        <link rel="stylesheet" href="/main.css" />
        <meta name="viewport" content="width=device-width" />
        <script type="text/javascript">var switchTo5x=true;</script>
        <script type="text/javascript" src="https://ws.sharethis.com/button/buttons.js"></script>
        <script type="text/javascript">stLight.options({publisher: "7b6849dd-9634-4f66-93be-b0595e0fad6b", doNotHash: false, doNotCopy: false, hashAddressBar: false});</script>
      </head>
      <body>
        <div class="wrapper">
          <div class="splash" style="${hideSplash||''}">
            <a href="http://smashingboxes.com/?utm_source=ridiculous-newsfeed-lp&utm_medium=lp&utm_campaign=sb-product" target="_blank" class="logo"><img src="/sb_logo_white.svg" alt="" /></a>
            <small>presents</small>
            <h1>The Ridiculous News Feed (RNF)</h1>
            <h2>The RNF pulls a key word from CNN trending news headline using the CNN RSS Newsfeed and marries that to images from the Giphy API. The resulting mashup is simply ridiculous!<sup>*</sup></h2>
            <small>*The following news feed contains juxtapositions of material that typically results in an offensive combination. Plus, the image feed is uncensored. As a matter of course, this content should not be viewed by anyone. View, laugh, share, and enjoy solely at your own risk.</small>
          </div>
          ${buildImageLoop(newsItems)}
          ${footerAddon||''}
        </div>
        <img class="powered-by-giphy" src="/powered-by-giphy.png" alt="" />
        <script>
          (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
          (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
          m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
          })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
          ga('create', 'UA-29292622-22', 'auto');
          ga('send', 'pageview');
        </script>
      </body>
    </html>
  `;
}
function buildShareWidget (newsItem) {
  let shareURL = `http://ridiculous-newsfeed.smashingboxes.com/${btoa(newsItem.search)}/${btoa(newsItem.giphyid)}/${btoa(newsItem.url)}/${btoa(newsItem.title)}`;
  return `
  <span class="shareWrap">
    <span class="st_sharethis_large" st_url="${shareURL}" st_title="A Ridiculous News Item: ${newsItem.title}" st_image="https://media.giphy.com/media/${newsItem.giphyid}/giphy.gif"></span>
    <span class='st_facebook_large' displayText='Facebook' st_url="${shareURL}" st_title="A Ridiculous News Item: ${newsItem.title}" st_image="https://media.giphy.com/media/${newsItem.giphyid}/giphy.gif"></span>
    <span class='st_twitter_large' displayText='Tweet' st_url="${shareURL}" st_title="A Ridiculous News Item: ${newsItem.title}" st_image="https://media.giphy.com/media/${newsItem.giphyid}/giphy.gif"></span>
  </span>
  `;
}
function buildImageLoop (newsItems) {
  let imageStack = [];
  newsItems.forEach((newsItem, i) => {
    imageStack.push(`
      <div class="article">
        <h2>
          <a title="Interested in actual news? Click here to go to the real thing." href="http://www.cnn.com/${newsItem.url}" target="_blank" data-meta="${newsItem.search}">
            ${highlightSearchTerm(newsItem.title, newsItem.search)}
          </a>
        </h2>
        <a href="/${btoa(newsItem.search)}/${btoa(newsItem.giphyid)}/${btoa(newsItem.url)}/${btoa(newsItem.title)}">
          <img src="https://media.giphy.com/media/${newsItem.giphyid}/giphy.gif" alt="" />
        </a>
        ${buildShareWidget(newsItem)}
      </div>
    `);
  });
  return imageStack.join(' \n');
}
function buildTakeMeBackButton () {
  return `<h3 class="takeMeBack">Want to see more? Go to the <a href="/">Ridiculous News Feed</a>!</h3>`;
}

function btoa (str) {
  let bfr = (new Buffer(str || ''));
  return bfr.toString('base64');
}
function atob (str) {
  let bfr = (new Buffer(str || '', 'base64'));
  return bfr.toString('ascii');
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

function getNewsItemLink (newsItem) {
  return ((newsItem.guid[0] || newsItem.link[0]).replace) ?
    (newsItem.guid[0] || newsItem.link[0]).replace('http://www.cnn.com/','')
    : (newsItem.guid[0]._ && newsItem.guid[0]._.replace) ?
      newsItem.guid[0]._.replace('http://www.cnn.com/','')
      : '';
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
          url: getNewsItemLink(newsItem),
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
    request.get(`http://api.giphy.com/v1/gifs/search?limit=10&q=${encodeURIComponent(search)}&api_key=${config.API_KEY}`,
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

  //console.log(newsItem,search);
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
      })
      .catch((err, other) => {
        console.log(err);
        res.json(err);
      });
  });

  app.get('/:search/:giphyid/:cnnurl/:cnntitle', (req, res) => {
    let params = req.params;
    let item = {
      title: REGEX_TEXT.test( atob(params.cnntitle) ) ? atob(params.cnntitle) : '',
      url: REGEX_URL.test( atob(params.cnnurl) ) ? atob(params.cnnurl) : '',
      giphyid: REGEX_TEXT.test( atob(params.giphyid) ) ? atob(params.giphyid) : '',
      search: REGEX_TEXT.test( atob(params.search) ) ? atob(params.search) : ''
    };
    sendPageResponse(res, [item], 'display: none;', buildTakeMeBackButton(), ' | '+item.title);
    console.log(item);
  });

  app.listen(config.PORT, () => {
    console.log(`App listening on port ${config.PORT}!`);
  });

}

function sendPageResponse(res, newsItems, hideSplash, footerAddon, titleAddon) {
  getPageContent(newsItems, hideSplash, footerAddon, titleAddon).split('\n').forEach((pageLine, i, arr) => {
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
