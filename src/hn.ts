import { decode } from "he";
import { load } from "cheerio";

import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";

import fetchQueue from "./queue";
import { cleanText, cleanContent } from "../src/util";

const HACKNEWS_API = "https://hacker-news.firebaseio.com/v0";
const PAGE_LIMIT = 30;

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

type User = {
  id: string;
  created_time: string;
  created: string;
  karma: string;
  avg: null | string;
  about: string;
};
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
  try {
    let ids = (await fetchQueue.push(
      `${HACKNEWS_API}/${item_type}.json?${params}`,
      null
    )) as string[];
    ids = ids.slice(start, end);
    const stories: (false | Item)[] = await Promise.all(
      ids.map(async (id) => getItem(id))
    );
    return stories.filter(Boolean) as Item[];
  } catch (err) {
    console.log(err);
    throw new Error("Could not fetch items");
  }
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
      const item = (await fetchQueue.push(
        `${HACKNEWS_API}/item/${id}.json`,
        null
      )) as any;
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
 * Retrieves a user record from the HackerNews Firestore database.
 *
 * @param id {string} HackerNews user ID.
 * @returns {User} Returns a fully populated user record.
 */
export async function queryUser(id: string): Promise<User> {
  let retries = 3;
  while (retries > 0) {
    try {
      const user = (await fetchQueue.push(
        `${HACKNEWS_API}/user/${id}.json`,
        null
      )) as any;
      let output: User = {
        id: user.id,
        created_time: user.created,
        created: timeAgo.format(new Date(user.created * 1000)),
        karma: user.karma,
        avg: null, // No average yo
        about: cleanText(user.about),
      };
      return output;
    } catch (err) {
      retries--;
    }
  }
  throw new Error("Could not retrieve user");
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
          `${HACKNEWS_API}/item/${item_id}.json`,
          null
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
          comments:
            comment.kids && comment.kids.length !== 0
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
export function parseNews(body: string) {
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

/**
 * Pulls data from specific HackerNews pages and extracts data via the DOM.
 *
 * @param item_type {string} Record/item collection to retrieve from the API.
 * @param page {number} Page number to retrieve the object
 * @returns
 */
export function parseComments(body: string): Comment[] {
  if (!/[<>]/.test(body)) {
    new Error("Not HTML content");
  } else {
    try {
      const $ = load(body);
      const rows = $("tr:nth-child(3) tr:has(.comment)");
      let comments = [];
      // Create flat array of comments
      for (let i = 0, l = rows.length; i < l; i++) {
        const row = $(rows[i]);
        let level = 0;
        const levelRow = row.find('img[src*="s.gif"]');
        const metadata = row.find(".comhead").has("a");
        let user = "";
        let time_ago = "";
        let id = "";
        let content = "[deleted]";
        if (levelRow.length) {
          level = parseInt(levelRow.attr("width"), 10) / 40;
        }
        if (metadata.length) {
          var userLink = metadata.find("a[href^=user]");
          user = userLink.text();
          time_ago = metadata.find(".age").attr("title");
          if (time_ago) {
            time_ago = timeAgo.format(new Date(time_ago));
          }
          var commentEl = row.find(".comment");
          var replyLink = commentEl.find("a[href^=reply]");

          // Sometimes the markup becomes nice, and 'reply' link is not part of the comments
          if (replyLink.length) {
            // Remove 'reply' link
            if (replyLink.parent("u").length) {
              replyLink.parent().remove();
            } else {
              replyLink.remove();
            }
          }
          content = cleanContent(commentEl.html());
        }
        comments.push({
          id: id,
          level: level,
          user: user,
          time_ago,
          content: content,
          comments: [],
        });
      }
      // Comments are not nested yet, this 2nd loop will nest 'em up
      for (var i = 0, l = comments.length; i < l; i++) {
        const comment = comments[i];
        const level = comment.level;
        if (level > 0) {
          let index = i,
            parentComment;
          do {
            parentComment = comments[--index];
          } while (parentComment.level >= level);
          parentComment.comments.push(comment);
        }
      }
      return comments.filter((comment) => comment.level == 0);
    } catch (e) {
      throw e;
    }
  }
  return [];
}
