# Cloudflare HN API

And yet another unofficial API for [Hacker News](http://news.ycombinator.com/). This was ported from the [original by cheeaun](https://www.github.com/cheeaun/node-hnapi). This was mostly copied from the original despite the fact that there is already a CDN proxy.

This was ported to modernize the code and make it slightly more readable. It was also rebuilt to work exclusively on Cloudflare Workers. It was also rebuilt to have greater control over the service for the SolidJS project, which uses this API for HackerNews clones (which are used for testing and validation).

- API Documentation: <https://github.com/cheeaun/node-hnapi/wiki/API-Documentation>

---

## 🚧 PLEASE READ THIS 🚧

If you are planning to scrape a _huge_ amount of posts or (historical) data from HN, please **don't use this API**. Use the official [Hacker News API](https://github.com/HackerNews/API) or [HN Search API](http://hn.algolia.com/api) instead.

---

## Notes

This refactored version also use modern packages such as Cheerio and Itty Router. It also uses Cloudflare Workers KV for storage and simple TTL expirations. Note that this service makes multiple recursive round-trips to the actual HN Firestore API. Cloudflare has a maximum subrequest limit of 50 for this reason the wrangler automatically enables unbound service on your worker (which might be costly in some cases). Please be ware of this limitaiton before using.

## Quick Start

1. `git clone` this repo.
2. `cd` to repo folder.
3. Optionally download, install and start [redis](http://redis.io/download).
4. `npm i`
5. `npm run dev`
6. Load `localhost:1337` in your web browser.

## License

Licensed under the [MIT License](http://cheeaun.mit-license.org/).

## Other APIs

- [The official Hacker News API](https://github.com/HackerNews/API)
- <https://www.github.com/cheeaun/node-hnapi>
- <http://hn.algolia.com/api>
- <http://api.ihackernews.com/>
- <http://hndroidapi.appspot.com/>
- <http://www.hnsearch.com/api>
- <https://github.com/Boxyco/hackernews-api>
