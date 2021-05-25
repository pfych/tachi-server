import t from "tap";
import { RequireNeutralAuthentication } from "../../../../test-utils/api-common";
import { CloseAllConnections } from "../../../../test-utils/close-connections";
import { CreateFakeAuthCookie } from "../../../../test-utils/fake-session";
import ResetDBState from "../../../../test-utils/reset-db-state";
import mockApi from "../../../../test-utils/mock-api";
import { TestingBarbatosScore } from "../../../../test-utils/test-data";
import db from "../../../../external/mongo/db";

t.test("POST /api/v1/ir/barbatos/score/submit", async (t) => {
    const cookie = await CreateFakeAuthCookie(mockApi);

    t.beforeEach(ResetDBState);

    // @TODO NEEDS TO USE PROPER AUTHENTICATION!!!
    RequireNeutralAuthentication("/api/v1/ir/barbatos/score/submit", "POST");

    t.test("Should import a valid score", async (t) => {
        const res = await mockApi
            .post("/api/v1/ir/barbatos/score/submit")
            .set("Cookie", cookie)
            .send(TestingBarbatosScore);

        t.equal(res.body.success, true, "Should be successful");

        t.equal(res.body.body.errors.length, 0, "Should have 0 failed scores.");

        const scores = await db.scores.count({
            service: "Barbatos",
        });

        t.equal(scores, 1, "Should import 1 score.");

        t.end();
    });

    t.test("Should reject an invalid body", async (t) => {
        const res = await mockApi
            .post("/api/v1/ir/barbatos/score/submit")
            .set("Cookie", cookie)
            .send({});

        t.equal(res.body.success, false, "Should not be successful.");
        t.equal(res.status, 400, "Should return 400.");

        t.end();
    });

    t.end();
});

t.teardown(CloseAllConnections);