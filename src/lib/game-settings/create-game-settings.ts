import { integer, Game, Playtypes } from "tachi-common";

import db from "../../external/mongo/db";
import CreateLogCtx from "../logger/logger";

const logger = CreateLogCtx(__filename);

/**
 * Create GameSettings for a UGPT (which contains their preferences).
 */
export async function CreateGameSettings(userID: integer, game: Game, playtype: Playtypes[Game]) {
	const exists = await db["game-settings"].findOne({
		userID,
		game,
		playtype,
	});

	if (exists) {
		logger.error(
			`Cannot create ${userID} ${game} ${playtype} game-settings as one already exists?`
		);

		throw new Error(
			`Cannot create ${userID} ${game} ${playtype} game-settings as one already exists?`
		);
	}

	// @TODO: #238 set sane defaults for game-settings stats.
	// const gptConfig = GetGamePTConfig(game, playtype);

	await db["game-settings"].insert({
		userID,
		game,
		playtype,
		preferences: {
			preferredProfileAlg: null,
			preferredSessionAlg: null,
			preferredScoreAlg: null,
			stats: [],
		},
	});

	logger.info(`Created game settings for ${userID} (${game} ${playtype}).`);
}