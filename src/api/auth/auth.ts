import { Router } from "express";
import Prudence from "prudence";
import {
    AddNewUser,
    AddNewUserAPIKey,
    PasswordCompare,
    ReinstateInvite,
    ValidatePassword,
    ValidateCaptcha,
} from "../../common/auth";
import {
    FormatUserDoc,
    GetUserCaseInsensitive,
    PRIVATEINFO_GetUserCaseInsensitive,
} from "../../common/user";

import db from "../../external/mongo/db";
import CreateLogCtx from "../../common/logger";
import prValidate from "../../middleware/prudence-validate";
import { RequireLoggedIn } from "../../middleware/require-logged-in";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

const LAZY_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/* istanbul ignore next */
const BASE_DOMAIN = process.env.NODE_ENV === "production" ? ".kamaitachi.xyz" : "127.0.0.1";
const SHOULD_COOKIES_SECURE = process.env.NODE_ENV === "production";

/**
 * Logs in a user.
 * @name POST /api/auth/login
 */
router.post(
    "/login",
    prValidate(
        {
            username: Prudence.regex(/^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u),
            password: ValidatePassword,
            captcha: "string",
        },
        {
            username: "Invalid username.",
            captcha: "Please fill out the captcha.",
        }
    ),
    async (req, res) => {
        if (req.session.ktchi?.userID) {
            logger.info(`Dual log-in attempted from ${req.session.ktchi.userID}`);
            return res.status(409).json({
                success: false,
                description: `You are already logged in as someone.`,
            });
        }

        logger.verbose(`Recieved login request with username ${req.body.username} (${req.ip})`);

        /* istanbul ignore next */
        if (process.env.NODE_ENV === "production") {
            logger.verbose("Validating captcha...");
            const validCaptcha = await ValidateCaptcha(
                req.body.recaptcha,
                req.socket.remoteAddress
            );

            if (!validCaptcha) {
                logger.verbose("Captcha failed.");
                return res.status(400).json({
                    success: false,
                    description: `Captcha failed.`,
                });
            }

            logger.verbose("Captcha validated!");
        } else {
            logger.verbose("Skipped captcha check because not in production.");
        }

        const requestedUser = await PRIVATEINFO_GetUserCaseInsensitive(req.body.username);

        if (!requestedUser) {
            logger.verbose(`Invalid username for login ${req.body.username}.`);
            return res.status(400).json({
                success: false,
                description: `This user does not exist.`,
            });
        }

        const passwordMatch = await PasswordCompare(req.body.password, requestedUser.password);

        if (!passwordMatch) {
            logger.verbose("Invalid password provided.");
            return res.status(400).json({
                success: false,
                description: `Invalid password.`,
            });
        }

        // username and password match up, we're good to check onwards

        let apiKeyDoc = await db["public-api-keys"].findOne({
            assignedTo: requestedUser.id,
            "permissions.selfkey": true,
        });

        if (!apiKeyDoc) {
            logger.warn(
                `User ${FormatUserDoc(requestedUser)} did not have an apikey. Creating a new one.`
            );

            const newApiKey = await AddNewUserAPIKey(requestedUser);

            if (!newApiKey) {
                logger.error(
                    `Bailed on user login ${FormatUserDoc(
                        requestedUser
                    )}. Could not create new apikey.`
                );

                throw new Error("FATAL in /register - apikey was unable to be created?");
            }

            apiKeyDoc = newApiKey;
        }

        req.session.ktchi = {
            userID: requestedUser.id,
            apiKey: apiKeyDoc.apiKey,
        };

        req.session.cookie.maxAge = 3.154e10; // 1 year

        // API wants a cookie called "apikey" in order to make authorised requests. This might change.
        res.cookie("apikey", apiKeyDoc.apiKey, {
            maxAge: 3.154e10,
            domain: BASE_DOMAIN,
            secure: SHOULD_COOKIES_SECURE,
        });

        logger.verbose(`${FormatUserDoc(requestedUser)} Logged in.`);

        return res.status(200).json({
            success: true,
            description: `Successfully logged in as ${FormatUserDoc(requestedUser)}`,
            body: {
                userID: requestedUser.id,
                apiKey: apiKeyDoc.apiKey,
            },
        });
    }
);

/**
 * Registers a new user.
 * @name POST /api/auth/register
 */
router.post(
    "/register",
    prValidate(
        {
            username: Prudence.regex(/^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u),
            password: ValidatePassword,
            email: Prudence.regex(LAZY_EMAIL_REGEX),
            inviteCode: "string",
            captcha: "string",
        },
        {
            username:
                "Usernames must be between 3 and 20 characters long, and can only contain alphanumeric characters!",
            email: "Invalid email.",
            inviteCode: "Invalid invite code.",
            captcha: "Please fill out the captcha.",
        }
    ),
    async (req, res) => {
        logger.verbose(`Recieved register request with username ${req.body.username} (${req.ip})`);

        if (process.env.NODE_ENV === "production") {
            logger.verbose("Validating captcha...");
            const validCaptcha = await ValidateCaptcha(
                req.body.recaptcha,
                req.socket.remoteAddress
            );

            if (!validCaptcha) {
                logger.verbose("Captcha failed.");
                return res.status(400).json({
                    success: false,
                    description: `Captcha failed.`,
                });
            }

            logger.verbose("Captcha validated!");
        } else {
            logger.info("Skipped captcha check because not in production.");
        }

        const existingUser = await GetUserCaseInsensitive(req.body.username);

        if (existingUser) {
            logger.verbose(`Invalid username ${req.body.username}, already in use.`);
            return res.status(409).json({
                success: false,
                description: "This username is already in use.",
            });
        }

        const inviteCodeDoc = await db.invites.findOneAndUpdate(
            {
                code: req.body.inviteCode,
                consumed: false,
            },
            {
                $set: {
                    consumed: true,
                },
            }
        );

        if (!inviteCodeDoc) {
            logger.info(`Invalid invite code given: ${req.body.inviteCode}.`);
            return res.status(401).json({
                success: false,
                description: `This invite code is not valid.`,
            });
        }

        logger.info(`Consumed invite ${inviteCodeDoc.code}.`);

        // if we get to this point, We're good to create the user.

        try {
            const newUser = await AddNewUser(req.body.username, req.body.password, req.body.email);

            if (!newUser) {
                throw new Error("AddNewUser failed to create a user.");
            }

            const apiKeyDoc = await AddNewUserAPIKey(newUser);

            if (!apiKeyDoc) {
                throw new Error("AddNewUserAPIKey failed to create an api key.");
            }

            return res.status(200).json({
                success: true,
                description: `Successfully created account ${req.body.username}!`,
                body: {
                    id: newUser.id,
                    username: newUser.username,
                },
            });
        } catch (err) {
            logger.error(
                `Bailed on user creation ${req.body.username} with invite code ${req.body.inviteCode}.`,
                { err }
            );

            await ReinstateInvite(inviteCodeDoc);

            return res.status(500).json({
                success: false,
                description: "An internal server error has occured.",
            });
        }
    }
);

/**
 * Logs out the requesting user.
 * @name POST /api/auth/logout
 */
router.post("/logout", RequireLoggedIn, (req, res) => {
    req.session.destroy(() => 0);
    res.clearCookie("apikey");

    return res.status(200).json({
        success: true,
        description: `Logged Out.`,
        body: {},
    });
});

export default router;
