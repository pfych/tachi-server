import { GenericAuthDocument } from "tachi-common";
import { RequestHandler } from "express";
import db from "../../../../external/mongo/db";
import { SplitAuthorizationHeader } from "../../../../utils/misc";
import { AssignToReqTachiData } from "../../../../utils/req-tachi-data";

export const ValidateAuthToken: RequestHandler = async (req, res, next) => {
    const header = req.header("Authorization");

    if (!header) {
        return res.status(400).json({
            success: false,
            description: `No Authorization provided.`,
        });
    }

    const { type, token } = SplitAuthorizationHeader(header);

    if (type !== "Bearer") {
        return res.status(400).json({
            success: false,
            description: `Invalid Authorization Type.`,
        });
    }

    const beatorajaAuthDoc = (await db["beatoraja-auth-tokens"].findOne({
        token,
    })) as GenericAuthDocument | null;

    if (!beatorajaAuthDoc) {
        return res.status(401).json({
            success: false,
            description: "Unauthorised.",
        });
    }

    AssignToReqTachiData(req, { beatorajaAuthDoc });

    return next();
};

export const ValidateIRClientVersion: RequestHandler = (req, res, next) => {
    const header = req.header("X-TachiIR-Version");

    if (header !== "2.0.0") {
        return res.status(400).json({
            success: false,
            description: "Invalid TachiIR client version.",
        });
    }

    return next();
};
