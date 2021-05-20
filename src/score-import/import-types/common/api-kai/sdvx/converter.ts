import { FindSDVXChartOnInGameIDVersion } from "../../../../../common/database-lookup/chart";
import { ConverterFunction, DryScore } from "../../../../../types";
import { KaiContext, KaiSDVXScore } from "../types";
import p from "prudence";
import {
    InternalFailure,
    InvalidScoreFailure,
    KTDataNotFoundFailure,
} from "../../../../framework/common/converter-failures";
import { FormatPrError } from "../../../../../common/prudence";
import { FindSongOnID } from "../../../../../common/database-lookup/song";
import {
    GenericGetGradeAndPercent,
    ParseDateFromString,
} from "../../../../framework/common/score-utils";
import { Lamps } from "kamaitachi-common";

const PR_KaiSDVXScore = {
    music_id: p.isPositiveInteger,
    music_difficulty: p.isBoundedInteger(0, 4),
    played_version: p.isBoundedInteger(1, 5),
    clear_type: p.isBoundedInteger(0, 4),
    max_chain: p.isPositiveInteger,
    score: p.isBoundedInteger(0, 10_000_000),
    critical: p.isPositiveInteger,
    near: p.isPositiveInteger,
    error: p.isPositiveInteger,
    early: p.isPositiveInteger,
    late: p.isPositiveInteger,
    gauge_rate: p.isBoundedInteger(0, 100),
    timestamp: "string",
};

export const ConvertAPIKaiSDVX: ConverterFunction<unknown, KaiContext> = async (
    data,
    context,
    importType,
    logger
) => {
    const err = p(data, PR_KaiSDVXScore, {}, { allowExcessKeys: true });

    if (err) {
        throw new InvalidScoreFailure(FormatPrError(err));
    }

    // prudence checks this above.
    const score = data as KaiSDVXScore;

    const difficulty = ConvertDifficulty(score.music_difficulty);

    const chart = await FindSDVXChartOnInGameIDVersion(
        score.music_id,
        difficulty,
        score.played_version.toString()
    );

    if (!chart) {
        throw new KTDataNotFoundFailure(
            `Could not find chart with songID ${score.music_id} (${difficulty} - Version ${score.played_version})`,
            importType,
            data,
            context
        );
    }

    const song = await FindSongOnID("sdvx", chart.songID);

    if (!song) {
        logger.severe(`Song-Chart desync with song ID ${chart.songID} (sdvx).`);
        throw new InternalFailure(`Song-Chart desync with song ID ${chart.songID} (sdvx).`);
    }

    const lamp = ResolveKaiLamp(score.clear_type);

    const { percent, grade } = GenericGetGradeAndPercent("sdvx", score.score, chart);

    const timeAchieved = ParseDateFromString(score.timestamp);

    const dryScore: DryScore<"sdvx:Single"> = {
        comment: null,
        game: "sdvx",
        importType,
        timeAchieved,
        service: context.service,
        scoreData: {
            grade,
            percent,
            score: score.score,
            lamp,
            hitData: {},
            hitMeta: {
                fast: score.early,
                slow: score.late,
                gauge: score.gauge_rate,
                maxCombo: score.max_chain,
            },
        },
        scoreMeta: {},
    };

    return { song, chart, dryScore };
};

function ConvertDifficulty(diff: number) {
    switch (diff) {
        case 0:
            return "NOV";
        case 1:
            return "ADV";
        case 2:
            return "EXH";
        case 3:
            return "ANY_INF";
        case 4:
            return "MXM";
    }

    throw new InvalidScoreFailure(`Invalid difficulty of ${diff} - Could not convert.`);
}

function ResolveKaiLamp(clear: number): Lamps["sdvx:Single"] {
    switch (clear) {
        case 0:
            return "FAILED";
        case 1:
            return "CLEAR";
        case 2:
            return "EXCESSIVE CLEAR";
        case 3:
            return "ULTIMATE CHAIN";
        case 4:
            return "PERFECT ULTIMATE CHAIN";
    }

    throw new InvalidScoreFailure(`Invalid lamp of ${clear} - Could not convert.`);
}