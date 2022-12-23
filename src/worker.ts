import { Router, Request } from "itty-router";
import { handleOptions, withCache } from "./util";
import { error, missing } from "itty-router-extras";
import { newComments, comments, item, news, stories, user, status, robots } from "./routes";

const router = Router();

// Basic news routes
Object.entries({
  news: "topstories",
  newest: "newstories",
  best: "beststories",
  ask: "askstories",
  show: "showstories",
  jobs: "jobstories",
}).map(([path, type]) => {
  router.get(`/${path}`, withCache, (req: Request) => stories(req, type));
});

// Story routes
["shownew", "active", "noobstories"].map((type) => {
  router.get(`/${type}`, withCache, (req: Request) => news(req, type));
});

// Other routes
router.get("/comments", withCache, comments);
router.get("/newcomments", withCache, newComments);
router.get("/item/:id", withCache, item);
router.get("/user/:id", withCache, user);

// Misc
router.get("/", status);
router.get("/favicon.ico", missing);
router.get("/robots.txt", robots);
router.all("*", () => error(404, "No content available."));

addEventListener("fetch", (event: FetchEvent) => {
  let response;
  if (event.request.method === "OPTIONS") {
    response = event.respondWith(handleOptions(event.request));
  } else {
    response = event.respondWith(router.handle(event.request));
  }
  return response;
});
