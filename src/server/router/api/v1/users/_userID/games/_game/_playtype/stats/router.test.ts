import db from "external/mongo/db";
import { IIDX_GRADES, IIDX_LAMPS } from "lib/constants/game";
import t from "tap";
import { CloseAllConnections } from "test-utils/close-connections";
import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import { TestingIIDXFolderSP10, Testing511SPA, TestingIIDXSPScorePB } from "test-utils/test-data";
import { CreateFolderChartLookup } from "utils/folder";
import deepmerge from "deepmerge";
import { PrivateUserDocument } from "tachi-common";

t.beforeEach(ResetDBState);
t.beforeEach(async () => {
	await CreateFolderChartLookup(TestingIIDXFolderSP10);

	await db["game-settings"].remove({});

	await db["game-settings"].insert({
		userID: 1,
		game: "iidx",
		playtype: "SP",
		preferences: {
			preferredProfileAlg: null,
			preferredScoreAlg: null,
			preferredSessionAlg: null,
			stats: [
				{
					folderID: TestingIIDXFolderSP10.folderID,
					mode: "folder",
					property: "lamp",
					gte: IIDX_LAMPS.HARD_CLEAR,
				},
				{
					chartID: Testing511SPA.chartID,
					mode: "chart",
					property: "score",
				},
			],
		},
	});

	await db["personal-bests"].insert(deepmerge(TestingIIDXSPScorePB, {}));
});

t.test("GET /api/v1/users/:userID/games/:game/:playtype/stats", (t) => {
	t.test("Should return the evaluated stats for this user.", async (t) => {
		const res = await mockApi.get("/api/v1/users/1/games/iidx/SP/stats");

		t.hasStrict(res.body.body, [
			{
				stat: {
					mode: "folder",
				},
				value: {
					value: 1,
					outOf: 1,
				},
			},
			{
				stat: {
					mode: "chart",
				},
				value: {
					value: 1479,
				},
			},
		]);

		t.end();
	});

	t.test("Should project another users stats over this one if projectUser is set.", async (t) => {
		await db["game-settings"].insert({
			userID: 2,
			game: "iidx",
			playtype: "SP",
			preferences: {
				preferredProfileAlg: null,
				preferredScoreAlg: null,
				preferredSessionAlg: null,
				stats: [
					{
						mode: "folder",
						folderID: TestingIIDXFolderSP10.folderID,
						property: "score",
						gte: 1480,
					},
				],
			},
		});

		// hack
		await db.users.insert({
			username: "test_acc",
			id: 2,
		} as PrivateUserDocument);

		const res = await mockApi.get("/api/v1/users/1/games/iidx/SP/stats?projectUser=2");

		t.hasStrict(res.body.body, [
			{
				stat: {
					mode: "folder",
				},
				value: {
					value: 0,
					outOf: 1,
				},
			},
		]);

		t.end();
	});

	t.test("Should return 404 if the user has not played this game.", async (t) => {
		const res = await mockApi.get("/api/v1/users/1/games/bms/7K/stats");

		t.equal(res.statusCode, 404);

		t.match(res.body.description, /not played/iu);

		t.end();
	});

	t.end();
});

t.test("GET /api/v1/users/:userID/games/:game/:playtype/stats/custom", (t) => {
	t.test("Should return a custom folder evaluated stat on a user.", async (t) => {
		const res = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=folder&prop=grade&gte=3&folderID=${TestingIIDXFolderSP10.folderID}`
		);

		t.strictSame(res.body.body, {
			value: 1,
			outOf: 1,
		});

		t.end();
	});

	t.test("Should return a custom chart evaluated stat on a user.", async (t) => {
		const res = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=chart&prop=grade&chartID=${Testing511SPA.chartID}`
		);

		t.strictSame(res.body.body, {
			value: IIDX_GRADES.AAA,
		});

		t.end();
	});

	t.test("Should reject for invalid folderID.", async (t) => {
		const res = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=folder&prop=grade&gte=4`
		);

		t.equal(res.statusCode, 400, "Should reject for no folderID");

		const res2 = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=folder&prop=grade&gte=4&folderID=foo&folderID=bar`
		);

		t.equal(res2.statusCode, 400, "Should reject for non-string folderID");

		t.end();
	});

	t.test("Should reject for invalid chartID.", async (t) => {
		const res = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=chart&prop=grade&gte=4`
		);

		t.equal(res.statusCode, 400, "Should reject for no chartID");

		const res2 = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=chart&prop=grade&chartID=foo&chartID=bar`
		);

		t.equal(res2.statusCode, 400, "Should reject for non-string chartID");

		t.end();
	});

	t.test("Should reject for invalid mode", async (t) => {
		const res = await mockApi.get(
			`/api/v1/users/1/games/iidx/SP/stats/custom?mode=nonsense&prop=grade&gte=4&chartID=foo`
		);

		t.equal(res.statusCode, 400);

		t.end();
	});

	t.end();
});

// @todo #239 PUT UGPT-Stats needs some tests for input validation.
t.test("PUT /api/v1/users/:userID/games/:game/:playtype/stats", (t) => {
	t.test("Requires the user to be authed as the requested user.", async (t) => {
		await db["api-tokens"].insert({
			userID: 2,
			identifier: "alt_token",
			permissions: {
				customise_profile: true,
			},
			token: "alt_token",
		});

		const res = await mockApi
			.put("/api/v1/users/1/games/iidx/SP/stats")
			.set("Authorization", `Bearer alt_token`);

		t.equal(res.statusCode, 403);

		t.end();
	});

	t.test("Requires the permission customise_profile", async (t) => {
		await db["api-tokens"].insert({
			userID: 1,
			identifier: "alt_token",
			permissions: {
				customise_profile: false,
			},
			token: "alt_token",
		});

		const res = await mockApi
			.put("/api/v1/users/1/games/iidx/SP/stats")
			.set("Authorization", `Bearer alt_token`);

		t.equal(res.statusCode, 403);

		t.end();
	});

	t.test("Should replace a user's preferences.stats with the contained stats.", async (t) => {
		await db["api-tokens"].insert({
			userID: 1,
			identifier: "alt_token",
			permissions: {
				customise_profile: true,
			},
			token: "alt_token",
		});

		const res = await mockApi
			.put("/api/v1/users/1/games/iidx/SP/stats")
			.set("Authorization", `Bearer alt_token`)
			.send([
				{
					mode: "chart",
					chartID: Testing511SPA.chartID,
					property: "lamp",
				},
			]);

		t.equal(res.statusCode, 200);

		const data = await db["game-settings"].findOne({ userID: 1, game: "iidx", playtype: "SP" });

		t.hasStrict(
			data?.preferences.stats,
			[
				{
					mode: "chart",
					chartID: Testing511SPA.chartID,
					property: "lamp",
				},
			],
			"Should update preferences.stats in the database."
		);

		t.hasStrict(
			res.body.body.preferences.stats,
			[
				{
					mode: "chart",
					chartID: Testing511SPA.chartID,
					property: "lamp",
				},
			],
			"Should return the updated preferences"
		);

		t.end();
	});

	t.end();
});

t.teardown(CloseAllConnections);
