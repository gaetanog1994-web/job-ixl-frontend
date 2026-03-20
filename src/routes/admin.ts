import { Router } from "express";
import type { Request, Response } from "express";
import { withTx } from "../db.js";
import type { AuthedRequest } from "../auth.js";
import { audit } from "../audit.js";

export const adminRouter = Router();


// POST /api/admin/test-scenarios/:id/initialize
adminRouter.post("/test-scenarios/:id/initialize", async (req: Request, res: Response) => {
    const scenarioId = req.params.id;
    const r = req as AuthedRequest;
    const correlationId = (req as any).correlationId;

    try {
        const result = await withTx(async (client) => {
            // 1) Leggi scenario rows (debug/telemetria)
            const scenarioRows = await client.query(
                `
        select user_id, position_id, priority
        from test_scenario_applications
        where scenario_id = $1
        `,
                [scenarioId]
            );

            // 2) Reset globale: wipe applications + utenti a inactive + counters a 0
            await client.query(`delete from applications`);
            await client.query(`update users set availability_status = 'inactive', application_count = 0`);

            // 3) Insert applications (difensivo su FK)
            const inserted = await client.query(
                `
        insert into applications (user_id, position_id)
        select tsa.user_id, tsa.position_id
        from test_scenario_applications tsa
        join users u on u.id = tsa.user_id
        join positions p on p.id = tsa.position_id
        where tsa.scenario_id = $1
        `,
                [scenarioId]
            );

            // 4) Attiva (available) gli utenti coinvolti nello scenario
            await client.query(
                `
        update users
        set availability_status = 'available'
        where id in (
          select distinct user_id
          from test_scenario_applications
          where scenario_id = $1
        )
        `,
                [scenarioId]
            );

            // 5) Recompute application_count (consistenza)
            await client.query(`
        update users u
        set application_count = coalesce(a.cnt, 0)
        from (
          select user_id, count(*)::int as cnt
          from applications
          group by user_id
        ) a
        where u.id = a.user_id
      `);

            await client.query(`
        update users
        set application_count = 0
        where id not in (select distinct user_id from applications)
      `);

            return {
                scenarioRows: scenarioRows.rowCount,
                insertedApplications: inserted.rowCount ?? null,
            };
        });

        await audit("scenario_initialize", r.user.id, { scenarioId }, result, correlationId);
        return res.status(200).json({ ok: true, result, correlationId });
    } catch (e: any) {
        await audit(
            "scenario_initialize",
            r.user.id,
            { scenarioId },
            { error: String(e?.message ?? e) },
            correlationId
        );
        return res.status(500).json({ error: "Initialize failed", correlationId });
    }
});


// POST /api/admin/users/:id/deactivate
adminRouter.post("/users/:id/deactivate", async (req: Request, res: Response) => {
    const userId = req.params.id;
    const r = req as AuthedRequest;
    const correlationId = (req as any).correlationId;

    try {
        const out = await withTx(async (client) => {
            await client.query(
                `update users set availability_status = 'inactive', application_count = 0 where id = $1`,
                [userId]
            );
            await client.query(`delete from applications where user_id = $1`, [userId]);
            return { deactivatedUserId: userId };
        });

        await audit("user_deactivate", r.user.id, { userId }, out, correlationId);
        return res.status(200).json({ ok: true, out, correlationId });
    } catch (e: any) {
        await audit(
            "user_deactivate",
            r.user.id,
            { userId },
            { error: String(e?.message ?? e) },
            correlationId
        );
        return res.status(500).json({ error: "Deactivate failed", correlationId });
    }
});

