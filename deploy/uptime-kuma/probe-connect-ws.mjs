/**
 * Open a real Connect session and push the result to Uptime Kuma.
 * The relay refuses a bare WebSocket, so a plain WSS monitor would stay down.
 */
import { readFileSync } from "node:fs";
import WebSocket from "/srv/zunia/repos/zunia-backend/node_modules/ws/index.js";

function envValue(name) {
  const file = readFileSync("/srv/zunia/shared/uptime-kuma.env", "utf8");
  const line = file.split("\n").find((row) => row.startsWith(`${name}=`));
  if (!line) throw new Error(`missing ${name}`);
  return line.slice(name.length + 1).trim();
}

const pushToken = envValue("CONNECT_WS_PUSH_TOKEN");
const origin = "https://status.zunialab.com";
const started = Date.now();

async function push(status, msg, ping) {
  const url = new URL(`http://127.0.0.1:3015/api/push/${pushToken}`);
  url.searchParams.set("status", status);
  url.searchParams.set("msg", msg.slice(0, 200));
  if (ping != null) url.searchParams.set("ping", String(ping));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`push ${res.status}`);
}

try {
  const created = await fetch("https://api.zunialab.com/v1/connect/sessions", {
    method: "POST",
    headers: { Origin: origin },
  });
  if (created.status !== 201) {
    await push("down", `session HTTP ${created.status}`);
    process.exit(0);
  }
  const body = await created.json();
  const url = `${body.wsUrl}?sid=${encodeURIComponent(body.sessionId)}&role=dapp`;
  const code = await new Promise((resolve, reject) => {
    const ws = new WebSocket(url, [
      "zunia.connect.v2",
      `zunia.token.${body.dappToken}`,
    ]);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("timeout"));
    }, 12_000);
    ws.on("upgrade", (res) => {
      clearTimeout(timer);
      ws.close();
      resolve(res.statusCode ?? 101);
    });
    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      resolve(res.statusCode ?? 0);
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  await fetch(`https://api.zunialab.com/v1/connect/sessions/${body.sessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${body.dappToken}`,
      Origin: origin,
    },
  }).catch(() => undefined);
  const ping = Date.now() - started;
  if (code === 101) await push("up", "101", ping);
  else await push("down", `handshake ${code}`, ping);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await push("down", message).catch(() => undefined);
  process.exit(1);
}
