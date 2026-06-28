/**
 * FlowSync AI — Teams webhook helper.
 * Posts formatted messages to a Microsoft Teams channel via incoming webhook.
 */

import https from "node:https";
import http from "node:http";

/**
 * Post a message to a Teams channel via incoming webhook URL.
 * @param {string} webhookUrl — The Teams incoming webhook URL
 * @param {string} markdown — Teams-compatible markdown message
 * @returns {Promise<{ok: boolean, status: number}>}
 */
export function postToTeams(webhookUrl, markdown) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const payload = JSON.stringify({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                text: markdown,
                wrap: true,
              },
            ],
          },
        },
      ],
    });

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
          }),
        );
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
