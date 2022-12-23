import { Request } from "itty-router";
import { error, json, text } from "itty-router-extras";
import { setCache } from "./util";
import {
  parseNews,
  parseComments,
  queryFullItem,
  queryItems,
  queryUser,
  getComments,
} from "./hn";
import fetchQueue from "./queue";

/**
 * Sends a general request response with version, description etc.
 */
export function status() {
  return json({
    name: "cloudflare-hnapi",
    desc: "Yet another unofficial Hacker News API",
    version: "1.0.0",
    project_url: "https://github.com/davedbase/cloudflare-hnapi/",
    documentation_url:
      "https://github.com/davedbase/cloudflare-hnapi/wiki/API-Documentation",
    author: "davedbase",
    author_url: "http://www.github.com/davedbase/",
  });
}

/**
 * Sends a no crawl message for scrapers
 */
export function robots() {
  return text("User-agent: *\nDisallow: /", {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

/**
 * Handles requests for general stories
 */
export async function stories({ query, url }: Request, type: string) {
  let page = query && query.page ? Number(query.page) : 1;
  if (url.includes("/news2")) {
    type = "news";
    page = 2;
  }
  try {
    const items = await queryItems(type, page);
    setCache(url, items);
    return json(items);
  } catch (err: any) {
    return error(500, err.message);
  }
}

/**
 * Handles requests for item types
 */
export async function item({ params, url }: Request) {
  try {
    if (!params || !params.id) throw new Error("Missing identifier");
    const item = await queryFullItem(params.id);
    setCache(url, item);
    return json(item);
  } catch (err: any) {
    return error(500, err.message);
  }
}

/**
 * Handles requests for comments
 */
export async function newComments(
  // @ts-ignore
  { headers, url }: Request
) {
  try {
    const body = (await fetchQueue.push(
      `https://news.ycombinator.com/newcomments`,
      {
        isPage: true,
        ip: headers.get("CF-Connecting-IP"),
      }
    )) as string;
    const comments = parseComments(body);
    setCache(url, comments);
    return json(comments);
  } catch (err: any) {
    return error(500, err.message);
  }
}

/**
 * Handles requests for comments
 */
export async function comments(
  // @ts-ignore
  { query, url }: Request
) {
  try {
    let ids = [];
    if (query.ids.includes(",")) {
      ids = [...query.ids.split(",")];
    } else {
      ids.push(query.ids);
    }
    const comments = getComments(ids);
    setCache(url, comments);
    return json(comments);
  } catch (err: any) {
    return error(500, err.message);
  }
}

/**
 * Handles requests for user data
 */
export async function user({ params, url }: Request) {
  try {
    if (!params || !params.id) throw new Error("Missing identifier");
    const user = await queryUser(params.id);
    setCache(url, user);
    return json(user);
  } catch (err: any) {
    return error(500, err.message);
  }
}

/**
 * Handles requests for types of news
 */
export async function news(
  // @ts-ignore
  { headers, url }: Request,
  type: string
) {
  try {
    const body = (await fetchQueue.push(
      `https://news.ycombinator.com/${type}`,
      {
        isPage: true,
        ip: headers.get("CF-Connecting-IP"),
      }
    )) as string;
    const news = parseNews(body);
    setCache(url, news);
    return json(news);
  } catch (err: any) {
    return error(500, err.message);
  }
}
