import { Router } from "express";
import db from "../../../../../../external/mongo/db";
import { SYMBOL_TachiData } from "../../../../../../lib/constants/tachi";
import { GetUserFromParam } from "./middleware";

const router: Router = Router({ mergeParams: true });

router.use(GetUserFromParam);

/**
 * Get the user at this ID or name.
 * @name GET /api/v1/users/:userID
 */
router.get("/", (req, res) => {
    const user = req[SYMBOL_TachiData]!.requestedUser!;

    return res.status(200).json({
        success: true,
        description: `Found user ${user.username}.`,
        body: user,
    });
});

/**
 * Returns all of the game-stats this user has.
 * This endpoint doubles up as a way of checking what games a user has played.
 *
 * @name GET /api/v1/users/:userID/stats
 */
router.get("/stats", async (req, res) => {
    const user = req[SYMBOL_TachiData]!.requestedUser!;

    // a user has played a game if and only if they have stats for it.
    const stats = await db["game-stats"].find({ userID: user.id });

    return res.status(200).json({
        success: true,
        description: `Returned ${stats.length} stats objects.`,
        body: stats,
    });
});

export default router;
