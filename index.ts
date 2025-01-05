import { Webhooks } from "@octokit/webhooks";
import { type WebhookEventName } from "./node_modules/@octokit/webhooks/dist-types/types";
import { readdir } from "node:fs/promises";
import { exec, execSync } from "node:child_process";

if (Bun.env.WEBHOOK_SECRET == undefined) {
  console.log("Webhook secret needs to be set");
  process.exit();
}

let branch = "";

if (Bun.env.GIT_BRANCH == undefined) {
  branch = "main";
} else {
  branch = Bun.env.GIT_BRANCH;
}

console.log("Serving on localhost:3000");

const webhooks = new Webhooks({
  secret: Bun.env.WEBHOOK_SECRET,
});

webhooks.on("push", async (event) => {
  if (event.payload.ref.split("/").at(-1) === branch) {
    for (const file of await readdir("./hooks")) {
      const splitFile = file.split(".", 2);
      const isAlphanumericPlusDashUnderscore = splitFile
        .map((value) => /^[a-zA-Z0-9_-]+$/.test(value))
        .reduce((val1, val2) => val1 && val2);
      if (
        !file.trim().endsWith(".sh") ||
        file.includes(" ") ||
        !isAlphanumericPlusDashUnderscore
      )
        continue;

      try {
        const stdout = execSync(`chmod +x ./hooks/${file}`, {
          cwd: process.cwd(),
        });
        console.log(stdout.toString("utf-8"));
      } catch (error) {
        console.error(error);
      }

      try {
        exec(
          `./hooks/${file}`,
          { cwd: process.cwd() },
          (err, stdout, stderr) => {
            console.log(stdout);
            console.error(stderr);
            if (err) {
              console.error(err);
            }
          }
        );
      } catch (error) {
        console.error(error);
      }
    }
  }
});

Bun.serve({
  async fetch(request, server) {
    if (request.method !== "POST") return new Response(null, { status: 404 });
    const id = request.headers.get("X-GitHub-Delivery")!;
    const signatureSHA256 = request.headers.get("X-Hub-Signature-256")!;
    const event = request.headers.get("X-GitHub-Event") as WebhookEventName;
    const payload = await request.text();
    try {
      await webhooks.verifyAndReceive({
        id: id,
        name: event,
        payload,
        signature: signatureSHA256,
      });
    } catch (error) {
      console.log(error);
      return new Response(null, { status: 500 });
    }
    return new Response(null, { status: 202 });
  },
  port: 3000,
});
