import { send } from "../util";

export function status() {
  return send({
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

export function robots() {
  return send("User-agent: *\nDisallow: /", {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

export function nocontent() {
  return send("", { status: 204 });
}
