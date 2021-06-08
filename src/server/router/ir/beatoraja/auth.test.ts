import t from "tap";
import { ValidateAuthToken, ValidateIRClientVersion } from "./auth";
import expMiddlewareMock from "express-request-mock";
import ResetDBState from "../../../../test-utils/resets";
import { SYMBOL_TachiData } from "../../../../lib/constants/tachi";
import { CloseAllConnections } from "../../../../test-utils/close-connections";

t.test("#ValidateIRClientVersion", (t) => {
    t.test("Should reject clients that are not supported", async (t) => {
        const { res } = await expMiddlewareMock(ValidateIRClientVersion, {
            headers: {
                "X-TachiIR-Version": "1.2.0",
            },
        });

        const json = res._getJSONData();

        t.equal(res.statusCode, 400);
        t.equal(json.success, false);
        t.match(json.description, /Invalid TachiIR client version/u);

        t.end();
    });

    t.test("Should reject no client header", async (t) => {
        const { res } = await expMiddlewareMock(ValidateIRClientVersion, {});

        const json = res._getJSONData();

        t.equal(res.statusCode, 400);
        t.equal(json.success, false);
        t.match(json.description, /Invalid TachiIR client version/u);

        t.end();
    });

    t.test("Should accept 2.0.0", async (t) => {
        const { res } = await expMiddlewareMock(ValidateIRClientVersion, {
            headers: {
                "X-TachiIR-Version": "2.0.0",
            },
        });

        t.equal(res.statusCode, 200);

        t.end();
    });

    t.end();
});

t.test("#ValidateAuthToken", (t) => {
    t.beforeEach(ResetDBState);

    t.test("Should reject invalid auth types", async (t) => {
        const { res } = await expMiddlewareMock(ValidateAuthToken, {
            headers: {
                authorization: "NOTBEARER token",
            },
        });

        const json = res._getJSONData();

        t.equal(res.statusCode, 400);
        t.equal(json.success, false);
        t.match(json.description, /Invalid Authorization Type/u);

        t.end();
    });

    t.test("Should reject unknown auth tokens", async (t) => {
        const { res } = await expMiddlewareMock(ValidateAuthToken, {
            headers: {
                authorization: "Bearer InvalidToken",
            },
        });

        const json = res._getJSONData();

        t.equal(res.statusCode, 401);
        t.equal(json.success, false);
        t.match(json.description, /Unauthorised/u);

        t.end();
    });

    t.test("Should reject no auth tokens", async (t) => {
        const { res } = await expMiddlewareMock(ValidateAuthToken, {});

        const json = res._getJSONData();

        t.equal(res.statusCode, 400);
        t.equal(json.success, false);
        t.match(json.description, /No Authorization provided/u);

        t.end();
    });

    t.test("Should allow existing auth tokens", async (t) => {
        const { res, req } = await expMiddlewareMock(ValidateAuthToken, {
            headers: {
                authorization: "Bearer token",
            },
        });

        t.equal(res.statusCode, 200);

        t.hasStrict(
            req[SYMBOL_TachiData]?.beatorajaAuthDoc,
            { token: "token", userID: 1 },
            "Should attach the authDoc to the request TachiData"
        );

        t.end();
    });

    t.end();
});

t.teardown(CloseAllConnections);
