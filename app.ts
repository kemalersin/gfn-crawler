import fs from "fs";
import env from "dotenv";
import Queue from "queue";
import Crawler from "crawler";
import IGDB from "igdb-api-node";

env.config();

interface Game {
  id?: number;
  name?: string;
  cover?: {
    id: number;
    url: string;
  };
  genres?: [
    {
      id: number;
      name: string;
    }
  ];
  screenshots?: [
    {
      id: number;
      url: string;
    }
  ];
  websites?: [
    {
      id: number;
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

      $(".gameName.freestyle.optimal").each(
        async (_idx: Number, el: HTMLElement) => {
          const name: string = $(el)
            .text()
            .trim()
            .replace(/ *\([^)]*\) */g, "");

          queue.push((cb: any) => {
            setTimeout(() => {
              igdb
                .fields(
                  "id, name, cover.url, genres.name, websites.category, websites.url, screenshots.url"
                )
                .search(name)
                .limit(1)
                .request("/games")
                .then((game: any) => {
                  console.log(name);

                  games.push(
                    !!game.data.length ? <Game>game.data[0] : { name }
                  );

                  cb();
                });
            }, 250 * ++n);
          });
        }
      );

      queue.start((err: any) => {
        if (err) {
          throw err;
        }

        fs.writeFileSync("games.json", JSON.stringify(games));        
      });
    }

    done();
  },
});

crawler.queue("https://www.nvidia.com/en-us/geforce/geforce-experience/games");
