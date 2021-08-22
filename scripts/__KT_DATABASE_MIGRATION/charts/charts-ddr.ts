/* eslint-disable @typescript-eslint/no-explicit-any */

import { ChartDocument, SongDocument } from "tachi-common";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import MigrateRecords from "../migrate";
import { gameOrders } from "tachi-common/js/config";
import { oldKTDB } from "../old-db";

const logger = CreateLogCtx(__filename);

async function ConvertFn(c: any): Promise<ChartDocument<"ddr:SP" | "ddr:DP">> {
	const song = (await db.songs.ddr.findOne({
		id: c.id,
	})) as SongDocument<"ddr">;

	const oldSong = await oldKTDB.get("songs-ddr").findOne({
		id: c.id,
	});

	if (!song) {
		logger.severe(`Cannot find song with ID ${c.id}?`);
		throw new Error(`Cannot find song with ID ${c.id}?`);
	}

	const newChartDoc: ChartDocument<"ddr:SP" | "ddr:DP"> = {
		rgcID: null,
		chartID: c.chartID,
		difficulty: c.difficulty,
		songID: c.id,
		playtype: c.playtype,
		levelNum: c.levelNum,
		level: c.level.toString(),
		flags: {
			"IN BASE GAME": true,
			"N-1": true,
		},
		data: {
			inGameID: c.internals.inGameID,
			songHash: oldSong.internals.songHash,
		},
		isPrimary: true,
		versions: [], // sentinel
	};

	const idx = gameOrders.ddr.indexOf(song.firstVersion!);

	if (idx === -1) {
		logger.warn(`Invalid firstAppearance of ${song.firstVersion!}, running anyway.`);
		newChartDoc.versions = [song.firstVersion!];
	} else {
		newChartDoc.versions = gameOrders.ddr.slice(idx);
	}

	return newChartDoc;
}

(async () => {
	await MigrateRecords(db.charts.ddr, "charts-ddr", ConvertFn);

	process.exit(0);
})();