import express from "express";
import { createClient, defineScript } from "redis";
import { json } from "body-parser";
import * as fs from "fs";

const DEFAULT_BALANCE = 100;
let checkAndChargeScript = {
    script: fs.readFileSync('./luaScripts/checkAndCharge.lua', 'utf8'),
    sha: ""
};

interface CheckInChargeClient {
    checkAndCharge(account: string, charge: number): Promise<string>;
}

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

async function connect(): Promise<ReturnType<typeof createClient> & CheckInChargeClient> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);
    const client = createClient({ url: url,
        scripts: {
            checkAndCharge: defineScript({
                NUMBER_OF_KEYS: 1,
                SCRIPT: checkAndChargeScript.script,
                transformArguments(account, charge) {
                    return [account, charge.toString()];
                },
                transformReply(reply: any, preserved?: any): string {
                    return reply
                }
            }),
        }});
    await client.connect();
    return client;
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    try {
        await client.set(`${account}/balance`, DEFAULT_BALANCE);
    } finally {
        await client.disconnect();
    }
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const client = await connect();
    try {

        const result = await client.checkAndCharge(`${account}/balance`, charges);
        const remainingBalance: number =  parseInt(result ?? "")
        if (remainingBalance || result == "0") {
            return { isAuthorized: true, remainingBalance: remainingBalance, charges };
        } else {
            return { isAuthorized: false, remainingBalance: parseInt((await client.get(`${account}/balance`)) ?? ""), charges: 0 };
        }
    } finally {
        await client.disconnect();
    }
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
