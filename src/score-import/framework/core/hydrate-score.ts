import { ChartDocument, config, integer, ScoreDocument, SongDocument } from "kamaitachi-common";
import { Logger } from "winston";
import { DryScore } from "../../../types";
import { CreateCalculatedData } from "./calculated-data/calculated-data";

/**
 * Takes an "intermediate" score and appends the rest of the data it needs.
 * @param dryScore The intermediate score to make into a real score.
 * @param userID The userID this score is for.
 */
export default async function HydrateScore(
    userID: integer,
    dryScore: DryScore,
    chart: ChartDocument,
    song: SongDocument,
    scoreID: string,
    logger: Logger
): Promise<ScoreDocument> {
    const calculatedData = await CreateCalculatedData(dryScore, chart, song, logger); // @todo

    const { scoreData: dryScoreData, ...rest } = dryScore;

    // Fill out the rest of the fields we want for scoreData
    const scoreData = Object.assign(
        {
            // @todo lamps may need to be separate upon game someday. Maybe. We need to check this out
            lampIndex: config.lamps[dryScore.game].indexOf(dryScore.scoreData.lamp as string),
            gradeIndex: config.grades[dryScore.game].indexOf(dryScore.scoreData.lamp as string),
        },
        dryScoreData
    );

    let score: ScoreDocument = {
        // extract all of the non-scoreData props from a dry score and push them here
        ...rest,
        // then push our score data.
        scoreData,
        // everything below this point is sane
        highlight: false,
        timeAdded: Date.now(),
        userID,
        calculatedData,
        songID: song.id,
        chartID: chart.chartID,
        scoreID,
        difficulty: chart.difficulty,
        playtype: chart.playtype,
        // these will be sorted out in post-processing
        isLampPB: false,
        isScorePB: false,
    };

    return score;
}