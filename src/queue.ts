import TimeQueue from "timequeue";

async function worker(url: string) {
  const resp = await fetch(url);
  return await resp.json();
}
const fetchQueue = new TimeQueue(worker, { concurrency: 750, every: 1000 });

export default fetchQueue;
