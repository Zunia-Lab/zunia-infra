/**
 * One-shot Uptime Kuma setup. Reads credentials already written to
 * /srv/zunia/shared/uptime-kuma.env and never prints them.
 */
const { readFileSync } = require("node:fs");
const { io } = require("socket.io-client");

function envValue(name) {
  const file = readFileSync("/srv/zunia/shared/uptime-kuma.env", "utf8");
  const line = file.split("\n").find((row) => row.startsWith(`${name}=`));
  if (!line) throw new Error(`missing ${name}`);
  return line.slice(name.length + 1).trim();
}

function emit(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 20000);
    socket.emit(event, ...args, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function monitor(fields) {
  return {
    method: "GET",
    interval: 60,
    retryInterval: 60,
    resendInterval: 0,
    maxretries: 1,
    timeout: 20,
    maxredirects: 10,
    accepted_statuscodes: ["200-299"],
    ignoreTls: false,
    upsideDown: false,
    active: true,
    notificationIDList: {},
    conditions: [],
    kafkaProducerBrokers: [],
    kafkaProducerSaslOptions: {},
    rabbitmqNodes: [],
    ...fields,
  };
}

async function main() {
  const username = envValue("KUMA_USERNAME");
  const password = envValue("KUMA_PASSWORD");
  const pushToken = envValue("CONNECT_WS_PUSH_TOKEN");
  const socket = io("http://127.0.0.1:3015", {
    transports: ["polling", "websocket"],
    reconnection: false,
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timed out")), 15000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const needs = await emit(socket, "needSetup");
  if (needs) {
    const setup = await emit(socket, "setup", username, password);
    if (!setup?.ok) throw new Error(`setup failed: ${setup?.msg || "unknown"}`);
  }

  const login = await emit(socket, "login", { username, password });
  if (!login?.ok) throw new Error(`login failed: ${login?.msg || "unknown"}`);

  const specs = [
    monitor({
      name: "API",
      type: "json-query",
      url: "https://api.zunialab.com/health",
      jsonPath: "$.ok",
      jsonPathOperator: "==",
      expectedValue: "true",
    }),
    monitor({
      name: "Connect relay",
      type: "json-query",
      url: "https://api.zunialab.com/health",
      jsonPath: "$.connect",
      jsonPathOperator: "==",
      expectedValue: "enabled",
    }),
    monitor({
      name: "Indexer",
      type: "json-query",
      url: "https://indexer.zunialab.com/health",
      jsonPath: "$.ok",
      jsonPathOperator: "==",
      expectedValue: "true",
    }),
    monitor({
      name: "Indexer realtime",
      type: "json-query",
      url: "https://indexer.zunialab.com/health",
      jsonPath: "$.realtime.enabled",
      jsonPathOperator: "==",
      expectedValue: "true",
    }),
    monitor({
      name: "Connect WebSocket",
      type: "push",
      interval: 180,
      retryInterval: 60,
      pushToken,
    }),
    monitor({ name: "Website", type: "http", url: "https://zunialab.com" }),
    monitor({ name: "Docs", type: "http", url: "https://docs.zunialab.com" }),
    monitor({ name: "Web app", type: "http", url: "https://app.zunialab.com/api/health" }),
    monitor({ name: "Link host", type: "http", url: "https://link.zunialab.com/.well-known/security.txt" }),
  ];

  const ids = {};
  for (const spec of specs) {
    const added = await emit(socket, "add", spec);
    if (!added?.ok) throw new Error(`add ${spec.name} failed: ${added?.msg || "unknown"}`);
    ids[spec.name] = added.monitorID;
    console.log(`monitor ${spec.name} id=${added.monitorID}`);
  }

  const page = await emit(socket, "addStatusPage", "Zunia", "zunia");
  if (!page?.ok) throw new Error(`status page failed: ${page?.msg || "unknown"}`);

  const saved = await emit(
    socket,
    "saveStatusPage",
    "zunia",
    {
      slug: "zunia",
      title: "Zunia",
      description: "API, Connect, indexer, and the public sites.",
      autoRefreshInterval: 60,
      theme: "dark",
      showTags: false,
      footerText: "Zunia Lab",
      customCSS: "",
      showPoweredBy: false,
      rssTitle: "",
      showOnlyLastHeartbeat: false,
      showCertificateExpiry: true,
      analyticsId: "",
      analyticsScriptUrl: "",
      analyticsType: null,
      domainNameList: ["status.zunialab.com"],
    },
    "",
    [
      {
        name: "Core",
        monitorList: [
          { id: ids.API },
          { id: ids["Connect relay"] },
          { id: ids["Connect WebSocket"] },
          { id: ids.Indexer },
          { id: ids["Indexer realtime"] },
        ],
      },
      {
        name: "Sites",
        monitorList: [
          { id: ids.Website },
          { id: ids.Docs },
          { id: ids.Wallet },
          { id: ids["Link host"] },
        ],
      },
    ],
  );
  if (!saved?.ok) throw new Error(`save status page failed: ${saved?.msg || "unknown"}`);

  const settings = await emit(socket, "getSettings");
  if (!settings?.ok) throw new Error(`get settings failed: ${settings?.msg || "unknown"}`);
  settings.data.entryPage = "statusPage-zunia";
  const set = await emit(socket, "setSettings", settings.data, password);
  if (!set?.ok) throw new Error(`set settings failed: ${set?.msg || "unknown"}`);

  console.log("status page zunia ready");
  socket.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
