import { decode } from "he";
import TimeAgo from "javascript-time-ago";
import { load } from "cheerio";
import fetchQueue from "./queue";
import en from "javascript-time-ago/locale/en";
import { cleanText } from "../src/util";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");
const HACKNEWS_API = "https://hacker-news.firebaseio.com/v0";
const PAGE_LIMIT = 30;

type Comment = {
  id: string;
  level: number;
  user: string;
  time: number;
  time_ago: string;
  deleted?: boolean;
  dead?: boolean;
  content: string;
  comments: Comment[];
};
type Item = {
  id: string;
  title: string;
  url?: string;
  content?: string;
  domain?: string;
  user: string | null;
  points: number | null;
  time: number;
  time_ago: string;
  comments_count: number;
  type: string;
  comments?: (Comment | number)[];
};

/**
 * Helper method acts as a general records retrievel utility for HackerNews.
 *
 * @param item_type {string} Record/item collection to retrieve from the API.
 * @param page {number} Page number to retrieve the object
 * @returns
 */
export async function queryItems(
  item_type: string,
  page: number
): Promise<Item[]> {
  const start = (page - 1) * PAGE_LIMIT;
  const end = start + PAGE_LIMIT;
  const params = new URLSearchParams({
    orderBy: '"$key"',
    limitToFirst: (PAGE_LIMIT * page).toString(),
  });
  const resp = await fetch(`${HACKNEWS_API}/${item_type}.json?${params}`);
  if (resp.status !== 200) {
    const result: { error: string } = await resp.json();
    throw new Error(result.error);
  }
  let ids: string[] = await resp.json();
  ids = ids.slice(start, end);
  const stories: (false | Item)[] = await Promise.all(
    ids.map(async (id) => getItem(id))
  );
  return stories.filter(Boolean) as Item[];
}

/**
 * Retrieves a single raw item from HackerNews. Comments may also be
 * requested recursively with the same method.
 *
 * @param id {string} HackerNews item ID.
 * @param allowComments {boolean} Allow recursive comments to be fetched.
 * @returns {Item | boolean} False for failed or the full item record.
 */
export async function getItem(
  id: string,
  returnComments = false
): Promise<Item | false> {
  // Allow for 3 retries because Firebase can be unreliable
  // If a comment only allow once because they matter less
  let retries = 3;
  while (retries > 0) {
    try {
      const resp = await fetch(`${HACKNEWS_API}/item/${id}.json`);
      const item: any = await resp.json();
      let output: Item = {
        id: item.id,
        title: item.title ? decode(item.title) : undefined,
        points: item.score,
        comments_count: item.descendants || 0,
        user: item.by,
        time: item.time, // Unix timestamp
        time_ago: timeAgo.format(new Date(item.time * 1000)),
        type: item.type == "story" ? "link" : item.type,
        comments: returnComments ? item.kids : undefined,
      };
      // Prettify the URL
      if (item.url) {
        output.url = item.url;
        output.domain = new URL(item.url).hostname.replace(/^www\./i, "");
      } else {
        output.url = `item?id=${item.id}`;
      }
      // If it's a job, username and points are useless
      if (item.type == "job") {
        output.user = output.points = null;
      }
      // Identify type=ask
      if (
        item.type == "story" &&
        output.url?.match(/^item/i) &&
        item.title.match(/^ask/i)
      ) {
        output.type = "ask";
      }
      return output;
    } catch (err) {
      retries--;
    }
  }
  return false;
}

/**
 * Retrieves a set of recursive comments.
 *
 * @param id {string} HackerNews item ID.
 * @returns {HNItem | boolean} False for failed or the full item record.
 */
export async function getComments(
  items: number[],
  level: number = 0
): Promise<Comment[]> {
  return await Promise.all(
    items.map(async (item_id) => {
      try {
        const comment: any = await fetchQueue.push(
          `${HACKNEWS_API}/item/${item_id}.json`
        );
        let content = "";
        if (comment.deleted) {
          content = "[deleted]";
        } else if (comment.text) {
          content = cleanText(comment.text);
        }
        return {
          id: comment.id,
          level: level,
          user: comment.by,
          time: comment.time,
          time_ago: timeAgo.format(new Date(comment.time * 1000)),
          content,
          deleted: comment.deleted,
          dead: comment.dead,
          comments: comment.kids
            ? await getComments(comment.kids, level + 1)
            : [],
        } as Comment;
      } catch (err) {
        console.log(err);
        return {} as Comment;
      }
    })
  );
}

/**
 * Retrieves a full item from HackerNews including comments.
 *
 * @param id {string} HackerNews item ID.
 * @returns {HNItem | boolean} False for failed or the full item record.
 */
export async function queryFullItem(id: string): Promise<Item> {
  let item = await getItem(id, true);
  if (item === false) {
    throw new Error("Item does not exist");
  }
  if (item.comments) {
    item.comments = await getComments(item.comments as number[], 0);
  }
  return item;
}

/**
 * Pulls data from specific HackerNews pages and extracts data via the DOM.
 *
 * @param item_type {string} Record/item collection to retrieve from the API.
 * @param page {number} Page number to retrieve the object
 * @returns
 */
export function parseStories(body: string) {
  if (!/[<>]/.test(body)) {
    throw new Error("Not HTML content");
  } else {
    try {
      const $ = load(body);
      let posts = [];
      let rows: any = $("td table:has(td.title) tr");
      rows = rows.has("td.title, td.subtext");
      for (let i = 0, l = rows.length; i < l; i += 2) {
        let row1 = $(rows[i]);
        let row2 = $(rows[i + 1]);
        if (!row2.length) break;

        const voteLink = row1.find("td a[id^=up]");
        let id =
          voteLink && voteLink.length
            ? (voteLink.attr("id")?.match(/\d+/) || [])[0]
            : null;

        const cell1 = row1.find("td.title").has("a");
        const link = cell1.find("a:first");
        const title = link.text().trim();
        let url = link.attr("href");
        const domain = (cell1
          .find(".comhead")
          .text()
          .match(/\(\s?([^()]+)\s?\)/i) || [, null])[1];

        const cell2 = row2.find("td.subtext");
        const points = parseInt(cell2.find("span[id^=score]").text(), 10);
        const userLink = cell2.find("a[href^=user]");
        const user = userLink.text() || null;
        const postLinks = cell2.find("a[href^=item]");
        const timeAgoLink = $(postLinks[0]);
        let timeAgo = timeAgoLink.text().trim();
        const commentsCountLink = $(postLinks[1]);
        const commentsCount =
          commentsCountLink && /\d/.test(commentsCountLink.text())
            ? parseInt(commentsCountLink.text(), 10)
            : 0;

        let type = "link";
        if (url?.match(/^item/i)) type = "ask";
        if (!user) {
          // No users post this = job ads
          type = "job";
          id = (url?.match(/\d+/) || [])[0];
          timeAgo = cell2.text().trim();
        }
        posts.push({
          id: id,
          title: title,
          url: url,
          domain: domain,
          points: points,
          user: user,
          time_ago: timeAgo,
          comments_count: commentsCount,
          type: type,
        });
      }
      return posts;
    } catch (e) {
      throw e;
    }
  }
}
