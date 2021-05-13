import t from "tap";
import { CloseMongoConnection } from "../../../../db/db";
import CreateLogCtx from "../../../../logger";
import ScoreImportFatalError from "../../../framework/score-importing/score-import-error";
import { ParseBatchManualFromObject as ParserFn } from "./parser";
import { BatchManual } from "./types";
import escapeRegex from "../../../../common/escape-string-regexp";
import deepmerge from "deepmerge";

const mockErr = (...msg: string[]) =>
    (({
        statusCode: 400,
        message: new RegExp(msg.map((e) => `${escapeRegex(e)}.*`).join(""), "u"),
        name: "Error",
    } as unknown) as ScoreImportFatalError);

const logger = CreateLogCtx("parser.test.ts");

const baseBatchManual = {
    body: [],
    head: { service: "foo", game: "iidx" },
};

const baseBatchManualScore = {
    score: 1000,
    lamp: "HARD CLEAR",
    matchType: "songID",
    identifier: "123",
    playtype: "SP",
    difficulty: "ANOTHER",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dm(sc: any) {
    return deepmerge(
        baseBatchManual,
        { body: [deepmerge(baseBatchManualScore, sc)] },
        { arrayMerge: (r, c) => c }
    );
}

t.test("#ParserFn", (t) => {
    t.test("Non-Object", (t) => {
        t.throws(
            () => ParserFn(false, "file/batch-manual", logger),
            new ScoreImportFatalError(
                400,
                "Invalid BATCH-MANUAL (Not an object, recieved boolean.)"
            ),
            "Should throw an error."
        );

        t.end();
    });

    t.test("No Header", (t) => {
        t.throws(
            () => ParserFn({ body: [] }, "file/batch-manual", logger),
            new ScoreImportFatalError(
                400,
                "Could not retrieve head.game - is this valid BATCH-MANUAL?"
            ),
            "Should throw an error."
        );

        t.end();
    });

    t.test("No Game", (t) => {
        t.throws(
            () => ParserFn({ body: [], head: { service: "foo" } }, "file/batch-manual", logger),
            new ScoreImportFatalError(
                400,
                "Could not retrieve head.game - is this valid BATCH-MANUAL?"
            ),
            "Should throw an error."
        );

        t.end();
    });

    t.test("Invalid Game", (t) => {
        t.throws(
            () =>
                ParserFn(
                    { body: [], head: { service: "foo", game: "invalid_game" } },
                    "file/batch-manual",
                    logger
                ),
            new ScoreImportFatalError(
                400,
                "Invalid game invalid_game - expected any of iidx, museca, maimai, jubeat, popn, sdvx, ddr, bms, chunithm, gitadora, usc"
            ),
            "Should throw an error."
        );

        t.throws(
            () =>
                ParserFn(
                    { body: [], head: { service: "foo", game: 123 } },
                    "file/batch-manual",
                    logger
                ),
            new ScoreImportFatalError(
                400,
                "Invalid game 123 - expected any of iidx, museca, maimai, jubeat, popn, sdvx, ddr, bms, chunithm, gitadora, usc"
            ),
            "Should throw an error."
        );

        t.end();
    });

    t.test("Invalid Service", (t) => {
        t.throws(
            () =>
                ParserFn(
                    { body: [], head: { service: "1", game: "iidx" } },
                    "file/batch-manual",
                    logger
                ),
            new ScoreImportFatalError(
                400,
                "Invalid BATCH-MANUAL: head.service | Expected a string with length between 3 and 15. | Received 1 [string]."
            ),
            "Should throw an error."
        );

        t.throws(
            () =>
                ParserFn(
                    { body: [], head: { service: 1, game: "iidx" } },
                    "file/batch-manual",
                    logger
                ),
            new ScoreImportFatalError(
                400,
                "Invalid BATCH-MANUAL: head.service | Expected a string with length between 3 and 15. | Received 1 [number]."
            ),
            "Should throw an error."
        );

        t.end();
    });

    t.test("Valid Empty BATCH-MANUAL", (t) => {
        let res = ParserFn(
            { body: [], head: { service: "foo", game: "iidx" } },
            "file/batch-manual",
            logger
        );

        t.hasStrict(res, {
            game: "iidx",
            context: {
                service: "foo",
                game: "iidx",
                version: null,
            },
            iterable: [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        t.end();
    });

    t.test("Valid BATCH-MANUAL", (t) => {
        t.test("Basic BATCH-MANUAL", (t) => {
            let res = ParserFn(
                {
                    body: [
                        {
                            score: 1000,
                            lamp: "HARD CLEAR",
                            matchType: "songID",
                            identifier: "123",
                            playtype: "SP",
                            difficulty: "ANOTHER",
                        },
                        {
                            score: 1000,
                            lamp: "HARD CLEAR",
                            matchType: "kamaitachiSongID",
                            identifier: "123",
                            playtype: "DP",
                            difficulty: "HYPER",
                        },
                        {
                            score: 1000,
                            lamp: "HARD CLEAR",
                            matchType: "songTitle",
                            identifier: "5.1.1.",
                        },
                        {
                            score: 1000,
                            lamp: "HARD CLEAR",
                            matchType: "title",
                            identifier: "5.1.1.",
                        },
                    ],
                    head: { service: "foo", game: "iidx" },
                } as BatchManual,
                "file/batch-manual",
                logger
            );

            t.hasStrict(res, {
                game: "iidx",
                context: {
                    service: "foo",
                    game: "iidx",
                    version: null,
                },
                iterable: [
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "songID",
                        identifier: "123",
                        playtype: "SP",
                        difficulty: "ANOTHER",
                    },
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "kamaitachiSongID",
                        identifier: "123",
                        playtype: "DP",
                        difficulty: "HYPER",
                    },
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "songTitle",
                        identifier: "5.1.1.",
                    },
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "title",
                        identifier: "5.1.1.",
                    },
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            t.end();
        });

        t.test("Valid HitMeta", (t) => {
            let res = ParserFn(
                dm({ hitMeta: { bp: 10, gauge: 100, gaugeHistory: null, comboBreak: 7 } }),
                "file/batch-manual",
                logger
            );

            t.hasStrict(res, {
                game: "iidx",
                context: {
                    service: "foo",
                    game: "iidx",
                    version: null,
                },
                iterable: [
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "songID",
                        identifier: "123",
                        playtype: "SP",
                        difficulty: "ANOTHER",
                        hitMeta: {
                            bp: 10,
                            gauge: 100,
                            gaugeHistory: null,
                            comboBreak: 7,
                        },
                    },
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            t.end();
        });

        t.test("Valid HitData", (t) => {
            let res = ParserFn(
                dm({ hitData: { pgreat: 1, great: null, bad: 0 } }),
                "file/batch-manual",
                logger
            );

            t.hasStrict(res, {
                game: "iidx",
                context: {
                    service: "foo",
                    game: "iidx",
                    version: null,
                },
                iterable: [
                    {
                        score: 1000,
                        lamp: "HARD CLEAR",
                        matchType: "songID",
                        identifier: "123",
                        playtype: "SP",
                        difficulty: "ANOTHER",
                        hitData: {
                            pgreat: 1,
                            great: null,
                            bad: 0,
                        },
                    },
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            t.end();
        });

        t.end();
    });

    t.test("Invalid BATCH-MANUAL", (t) => {
        t.test("Invalid Lamp For Game", (t) => {
            let fn = () =>
                ParserFn(
                    {
                        body: [
                            {
                                score: 1000,
                                lamp: "ALL JUSTICE", // not an iidx lamp
                                matchType: "songID",
                                identifier: "123",
                                playtype: "SP",
                                difficulty: "ANOTHER",
                            },
                        ],
                        head: { service: "foo", game: "iidx" },
                    },
                    "file/batch-manual",
                    logger
                );

            t.throws(
                fn,
                new ScoreImportFatalError(
                    400,
                    "Invalid BATCH-MANUAL: body[0].lamp | Expected any of NO PLAY, FAILED, ASSIST CLEAR, EASY CLEAR, CLEAR, HARD CLEAR, EX HARD CLEAR, FULL COMBO. | Received ALL JUSTICE [string]."
                )
            );

            t.end();
        });

        t.test("Non-numeric score", (t) => {
            let fn = () => ParserFn(dm({ score: "123" }), "file/batch-manual", logger);

            t.throws(
                fn,
                new ScoreImportFatalError(
                    400,
                    "Invalid BATCH-MANUAL: body[0].score | Expected number. | Received 123 [string]."
                )
            );

            t.end();
        });

        t.test("Invalid timeAchieved", (t) => {
            let fn = () => ParserFn(dm({ timeAchieved: "string" }), "file/batch-manual", logger);

            t.throws(
                fn,
                new ScoreImportFatalError(
                    400,
                    "Invalid BATCH-MANUAL: body[0].timeAchieved | Expected a number greater than 1 Trillion - did you pass unix seconds instead of miliseconds? | Received string [string]."
                )
            );

            let fn2 = () =>
                ParserFn(
                    dm({ timeAchieved: 1_620_768_609_637 / 1000 }),
                    "file/batch-manual",
                    logger
                );

            t.throws(
                fn2,
                new ScoreImportFatalError(
                    400,
                    "Invalid BATCH-MANUAL: body[0].timeAchieved | Expected a number greater than 1 Trillion - did you pass unix seconds instead of miliseconds? | Received 1620768609.637 [number]."
                ),
                "Should throw if timeAchieved is less than 10_000_000_000."
            );

            t.end();
        });

        t.test("Invalid Playtype", (t) => {
            // this is not a valid playtype for IIDX
            let fn = () => ParserFn(dm({ playtype: "Single" }), "file/batch-manual", logger);

            t.throws(
                fn,
                new ScoreImportFatalError(
                    400,
                    "Invalid BATCH-MANUAL: body[0].playtype | Expected any of SP, DP. | Received Single [string]."
                )
            );

            t.end();
        });

        t.test("Invalid Identifier", (t) => {
            // this is not a valid playtype for IIDX
            let fn = () => ParserFn(dm({ identifier: null }), "file/batch-manual", logger);

            t.throws(fn, mockErr("body[0].identifier | Expected string", "Received null [null]"));

            t.end();
        });

        t.test("Invalid MatchType", (t) => {
            let fn = () =>
                ParserFn(dm({ matchType: "Invalid_MatchType" }), "file/batch-manual", logger);

            t.throws(
                fn,
                mockErr(
                    "body[0].matchType | Expected any of",
                    "Received Invalid_MatchType [string]"
                )
            );

            t.end();
        });

        t.test("Invalid HitData", (t) => {
            let fn = () => ParserFn(dm({ hitData: { not_key: 123 } }), "file/batch-manual", logger);

            t.throws(fn, mockErr("body[0].hitData | Invalid Key not_key"));

            let fn2 = () =>
                ParserFn(dm({ hitData: { pgreat: "123" } }), "file/batch-manual", logger);

            t.throws(
                fn2,
                mockErr("body[0].hitData | Key pgreat had an invalid value of 123 [string]")
            );

            t.end();
        });

        t.test("Invalid HitMeta", (t) => {
            let fn = () => ParserFn(dm({ hitMeta: { not_key: 123 } }), "file/batch-manual", logger);

            t.throws(fn, mockErr("body[0].hitMeta | Unexpected"));

            let fn2 = () => ParserFn(dm({ hitMeta: { bp: -1 } }), "file/batch-manual", logger);

            t.throws(fn2, mockErr("body[0].hitMeta.bp | Expected a positive integer"));

            t.end();
        });

        t.end();
    });

    t.end();
});

t.teardown(CloseMongoConnection);