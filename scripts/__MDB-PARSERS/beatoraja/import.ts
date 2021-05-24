import fs from "fs";
import path from "path";
import CreateLogCtx from "../../../src/common/logger";
import db from "../../../src/db/db";
const logger = CreateLogCtx("scripts/__MDB-PARSERS/beatoraja/import.ts");

const charts = JSON.parse(fs.readFileSync(path.join(__dirname, "./charts.json"), "utf-8"));
const songs = JSON.parse(fs.readFileSync(path.join(__dirname, "./songs.json"), "utf-8"));

(async () => {
    logger.info("starting chart import.");
    await db.charts.bms.insert(charts);
    logger.info("imported charts.");

    await db.songs.bms.insert(songs);

    logger.info("done.");
})();
