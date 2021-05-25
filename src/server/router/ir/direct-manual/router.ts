import { Router } from "express";
import { GetUserWithID, GetUserWithIDGuaranteed } from "../../../../utils/user";
import CreateLogCtx from "../../../../logger/logger";
import { RequireLoggedIn } from "../../../middleware/require-logged-in";
import { ExpressWrappedScoreImportMain } from "../../../../lib/score-import/framework/express-wrapper";
import ParseDirectManual from "../../../../lib/score-import/import-types/ir/direct-manual/parser";

const router: Router = Router({ mergeParams: true });

const logger = CreateLogCtx(__filename);

/**
 * Imports scores in ir/json:direct-manual form.
 * @name /api/ir/direct-manual/import
 */
router.post("/import", RequireLoggedIn, async (req, res) => {
    const userDoc = await GetUserWithIDGuaranteed(req.session.ktchi!.userID);

    const intent = req.header("X-User-Intent");

    const responseData = await ExpressWrappedScoreImportMain(
        userDoc,
        !!intent,
        "ir/direct-manual",
        (logger) => ParseDirectManual(req.body, logger)
    );

    return res.status(responseData.statusCode).json(responseData.body);
});

export default router;
