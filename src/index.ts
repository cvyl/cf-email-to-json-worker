import { R2Bucket } from '@cloudflare/workers-types';
import { extract as parseRawEmail } from 'letterparser';

export interface Env {
  R2_BUCKET: R2Bucket;
}

const ALLOW_LIST = ["anyone@example.com", "coworker@example.com"];

export default {
  async email(message: any, env: Env) {
    if (!ALLOW_LIST.includes(message.from)) return message.setReject("Address not allowed");

    const existingDataFile = await env.R2_BUCKET.get("email_log.json");
    const existingData = existingDataFile ? JSON.parse(await existingDataFile.text()) : [];
    const nextId = existingData.length ? existingData[existingData.length - 1].id + 1 : 1;
    existingData.push(await parseEmailContent(message, env, nextId));

    await env.R2_BUCKET.put("email_log.json", JSON.stringify(existingData, null, 2));
  },

  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/media/")) {
      const file = await env.R2_BUCKET.get(pathname.slice(1));
      return file
        ? new Response(file.body, { headers: { "Content-Type": file.httpMetadata?.contentType || "application/octet-stream" } })
        : new Response("File not found", { status: 404 });
    }

    if (pathname === "/") {
      const logFile = await env.R2_BUCKET.get("email_log.json");
      const logText = await logFile?.text() || "[]";
      return new Response(logText, { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function parseEmailContent(message: any, env: Env, id: number) {
  const email = parseRawEmail((await new Response(message.raw).text()).replace(/utf-8/gi, 'utf-8'));

  const files = await Promise.all(email.attachments?.map(async (attachment) => {
    const file_name = attachment.filename || "unnamed_file";
    if (attachment.body) await env.R2_BUCKET.put(`media/${file_name}`, attachment.body);
    return { file_name, mime_type: attachment.contentType, url: `media/${file_name}`, date: new Date().toISOString() };
  }) || []);

  return { id, date: new Date().toISOString(), text: email.text || "", files };
}
