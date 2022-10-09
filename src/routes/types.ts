import { Request } from "itty-router";
import { failure, send } from "../util";
import { queryFullItem, queryItems } from "../hn";

export async function news({ query, url }: Request, type: string) {
  let page = query && query.page ? Number(query.page) : 1;
  if (url.includes("/news2")) {
    type = 'news';
    page = 2;
  }
  try {
    return send(await queryItems(type, page));
  } catch (err: any) {
    return failure(500, err.message);
  }
}

export async function item({ params }: Request) {
  try {
    if (!params || !params.id) throw new Error('Missing identifier');
    return send(await queryFullItem(params.id));
  } catch (err: any) {
    console.log('SEND ERRROR', err);
    return failure(500, err.message);
  }
}
