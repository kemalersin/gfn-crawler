import fs from "fs";
import env from "dotenv";
import Queue from "queue";
import Crawler from "crawler";
import IGDB from "igdb-api-node";

env.config();

interface Game {
  id?: number;
  name: string;
  cover?: string;
  genres?: Array<string>;
  screenshots?: Array<string>;
  websites?: [
    {
      category: number;
      url: string;
    }
  ];
}

const igdb: any = IGDB(
  process.env.IGDB_CLIENT_ID,
  process.env.IGDB_ACCESS_TOKEN
);

const queue = Queue({ results: [] });

let games: Array<Game> = [];

const transformGameData = (data: any): Game => {
  if (data.cover) data.cover = data.cover.image_id;

  if (data.genres)
    data.genres = <Array<any>>data.genres.map((genre: any) => genre.name);

  if (data.screenshots)
    data.screenshots = <Array<any>>(
      data.screenshots.map((screenshot: any) => screenshot.image_id)
    );

  if (data.websites)
    data.websites = <Array<any>>(
      data.websites
        .filter((website: any) => [13, 16].includes(website.category))
        .map((website: any) =>
          (({ category, url }) => ({ category, url }))(website)
        )
    );

  return <Game>data;
};

const crawler = new Crawler({
  callback: (
    error: Error,
    res: Crawler.CrawlerRequestOptions,
    done: Function
  ) => {
    if (error) {
      console.log(error);
    } else {
      const $: any = res.$;

      let n: number = 0;
      let scrapedGameNames: Array<string> = [];
      let fetchedGameNames: Array<string> = [];

      $(".gameName:not(.optimal-application-settings)").each(
        async (_idx: Number, el: HTMLElement) => {
          const name: string = $(el)
            .text()
            .trim()
            .replace(/ *\([^)]*\) */g, "")
            .replace(/\*\s*$/, "");

          if (scrapedGameNames.includes(name)) {
            return;
          }

          scrapedGameNames.push(name);

          queue.push((cb: any) => {
            setTimeout(() => {
              igdb
                .fields(
                  "id, name, cover.image_id, genres.name, websites.category, websites.url, screenshots.image_id"
                )
                .search(name)
                .limit(1)
                .request("/games")
                .then((game: any) => {
                  const fetchedGame: Game = !!game.data.length
                    ? transformGameData(<Game>game.data[0])
                    : { name };

                  if (!fetchedGameNames.includes(fetchedGame.name)) {
                    console.log(name);

                    games.push(fetchedGame);
                    fetchedGameNames.push(fetchedGame.name);
                  }

                  cb();
                });
            }, 250 * ++n);
          });
        }
      );

      queue.start((err: any) => {
        if (err) throw err;

        fs.writeFileSync("games.json", JSON.stringify(games));
      });
    }

    done();
  },
});

crawler.queue("https://www.nvidia.com/en-us/geforce/geforce-experience/games");
