import { Router, Request } from "itty-router";
import { failure, handleOptions, send } from "./util";
import { status, robots, nocontent } from "./routes/general";
import { item, news } from "./routes/types";

const router = Router();

// Basic news routes
Object.entries({
  'news': 'topstories',
  'newest': 'newstories',
  'best': 'beststories',
  'ask': 'askstories',
  'show': 'showstories',
  'jobs': 'jobstories'
}).map(([path, type]) => {
  router.get(`/${path}`, (req: Request) => news(req, type));
});

// Story routes
['shownew', 'active', 'noobstories'].map((type) => {
  router.get(`/${type}`, (req: Request) => stories(req, type));
});

// Other routes
router.get('/newcomments', () => send('Item'));
router.get('/item/:id', item);

// Misc
router.get('/', status);
router.get('/favicon.ico', nocontent);
router.get('/robots.txt', robots);
router.all('*', () => failure(404, 'No content available.'));

addEventListener("fetch", (event: FetchEvent) => {
	if (event.request.method === "OPTIONS") {
		return event.respondWith(handleOptions(event.request));
	}
	return event.respondWith(router.handle(event.request));
});
