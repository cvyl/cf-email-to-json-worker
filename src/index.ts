import { R2Bucket } from '@cloudflare/workers-types';
import { extract as parseRawEmail } from 'letterparser';

export interface Env {
  R2_BUCKET: R2Bucket;
}

export default {
  async email(message: any, env: Env, ctx: ExecutionContext) {
    const allowList = ["anyone@example.com", "coworker@example.com"];

    if (!allowList.includes(message.from)) {
      message.setReject("Address not allowed");
      return;
    }

    const existingDataFile = await env.R2_BUCKET.get("email_log.json");
    const existingData = existingDataFile ? JSON.parse(await existingDataFile.text()) : [];
    const nextId = existingData.length > 0 ? existingData[existingData.length - 1].id + 1 : 1;
    const parsedContent = await parseEmailContent(message, env, nextId);

    existingData.push(parsedContent);

    await env.R2_BUCKET.put("email_log.json", JSON.stringify(existingData, null, 2));
  },

  async fetch(request: Request, env: Env) {
    if (request.method === "GET") {
      const logFile = await env.R2_BUCKET.get("email_log.json");

      if (logFile) {
        const logText = await logFile.text();
        return new Response(logText, {
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  }
};

// Helper function to parse email content using letterparser
async function parseEmailContent(message: any, env: Env, id: number) {
  const rawEmail = (await new Response(message.raw).text()).replace(/utf-8/gi, 'utf-8');
  const email = parseRawEmail(rawEmail);

  const parsed = {
    id,  // Use the sequential numeric ID provided
    date: new Date().toISOString(),
    text: email.text || "",
    files: [] as {
      file_name: string;
      mime_type: string;
      url: string;
      date: string;
    }[],
  };

  // Process attachments (if any)
  for (const attachment of email.attachments || []) {
    const fileData = {
      file_name: attachment.filename || "unnamed_file",
      mime_type: attachment.contentType as unknown as string,
      url: `media/${attachment.filename || "unnamed_file"}`,
      date: new Date().toISOString(),
    };

    if (attachment.body) {
      // Upload attachment to R2
      await env.R2_BUCKET.put(`media/${attachment.filename || "unnamed_file"}`, attachment.body);
    }

    parsed.files.push(fileData);
  }

  return parsed;
}
