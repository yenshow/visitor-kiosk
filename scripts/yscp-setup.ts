/**
 * YSCP 設定 CLI
 *   npm run setup:yscp              首次／完整設定
 *   npm run setup:yscp -- <command> 重跑單一步驟
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import {
  buildYscpEventDest,
  getConfig,
  YSCP_EVENT_TOKEN_DEFAULT,
} from "../src/lib/config";
import type { ExitLane } from "../src/lib/kiosk/exit-lanes";
import { ensureEventSubscription } from "../src/lib/yscp/event-api";
import {
  pulseAlarmOutput,
  isLikelyLprCamera,
  listAlarmOutputs,
  listCameras,
  type YscpAlarmOutput,
  type YscpCamera,
} from "../src/lib/yscp/exit-gate";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

/** Node UTF-8 讀寫，避免 Windows PowerShell 系統碼頁弄亂中文 */
const readUtf8 = (filePath: string): string =>
  readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

const writeUtf8 = (filePath: string, text: string) => {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, text.replace(/^\uFEFF/, ""), { encoding: "utf8" });
  renameSync(tmp, filePath);
};

const loadDotEnv = (filePath: string) => {
  if (!existsSync(filePath)) return;
  for (const raw of readUtf8(filePath).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
};

const usage = () => {
  console.log(`
用法:
  npm run setup:yscp                 首次／完整設定（連線、Webhook、出口車道、訂閱）
  npm run setup:yscp -- <command>

  subscribe                 重訂車牌事件 131622
  cameras                   列出攝影機
  relays --dev <id>         依 encodeDevIndexCode 列繼電器
  open --relay <id> --yes   開閘測試
  lanes                     重選出口相機＋繼電器並寫入 .env
`);
};

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  const command = args[0] || "";
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
};

const ask = (question: string) =>
  new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer ?? "").trim());
    });
  });

const askIndex = async (label: string, max: number) => {
  while (true) {
    const n = Number(await ask(`${label} (1-${max}): `));
    if (Number.isInteger(n) && n >= 1 && n <= max) return n - 1;
    console.log("請輸入有效編號");
  }
};

const isYesNo = (raw: string) =>
  ["y", "yes", "n", "no"].includes(raw.toLowerCase());

const askOrKeep = async (label: string, current: string, secret = false) => {
  const hint = !current
    ? "未設"
    : secret
      ? "已設定，Enter 保留"
      : `${current}，Enter 保留`;
  const answer = await ask(`${label} [${hint}]: `);
  if (!answer || (current && isYesNo(answer))) return current;
  return answer;
};

const upsertEnvLine = (key: string, value: string) => {
  const line = `${key}=${value}`;
  let text = existsSync(ENV_PATH) ? readUtf8(ENV_PATH) : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : `${text.replace(/\s*$/, "")}\n${line}\n`;
  writeUtf8(ENV_PATH, text);
  process.env[key] = value;
};

const ensureEnvFile = () => {
  if (existsSync(ENV_PATH)) return;
  if (!existsSync(ENV_EXAMPLE_PATH)) {
    writeUtf8(ENV_PATH, "");
    return;
  }
  copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  console.log(`[+] 已從 .env.example 建立 ${ENV_PATH}`);
};

const listLanIps = (): string[] => {
  const ips: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const family = String(addr.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (addr.internal) continue;
      ips.push(addr.address);
    }
  }
  return ips;
};

const printCams = (cams: YscpCamera[], detail: boolean) => {
  cams.forEach((cam, i) => {
    const mark = isLikelyLprCamera(cam) ? " [LPR?]" : "";
    if (!detail) {
      console.log(
        `  ${i + 1}. ${cam.cameraName || "(無名稱)"}${mark}  id=${cam.cameraIndexCode}  dev=${cam.encodeDevIndexCode || "-"}`,
      );
      return;
    }
    console.log(
      `  ${i + 1}. ${cam.cameraName || "(無名稱)"}${mark}` +
        `\n     cameraIndexCode=${cam.cameraIndexCode}` +
        `  encodeDevIndexCode=${cam.encodeDevIndexCode || "-"}` +
        `  狀態=${cam.status === 1 ? "在線" : "離線/其他"}`,
    );
    if (cam.capabilitySet) {
      console.log(`     capabilitySet=${cam.capabilitySet}`);
    }
  });
};

const printRelays = (relays: YscpAlarmOutput[]) => {
  relays.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.alarmOutputName || "(無名稱)"}  id=${r.alarmOutputIndexCode}`,
    );
  });
};

const requireCredentials = () => {
  const { accessKey, secretKey } = getConfig().yscp;
  if (!accessKey || !secretKey) {
    console.error("[-] 尚未設定 YSCP_AK / YSCP_SK，請先執行 npm run setup:yscp");
    process.exit(1);
  }
};

const selectExitLanes = async (): Promise<ExitLane[]> => {
  const cams = await listCameras();
  if (cams.length === 0) throw new Error("查無攝影機");

  const lanes: ExitLane[] = [];
  while (true) {
    console.log("\n請選擇【出口】LPR 相機（勿選入場）：");
    printCams(cams, false);
    const cam = cams[await askIndex("相機編號", cams.length)];
    if (!cam.encodeDevIndexCode) {
      throw new Error("此相機缺少 encodeDevIndexCode");
    }

    const relays = await listAlarmOutputs(cam.encodeDevIndexCode);
    if (relays.length === 0) {
      throw new Error("查無警報輸出，請確認 YSCP 繼電器綁定");
    }

    console.log(`\n設備 ${cam.encodeDevIndexCode} 的繼電器：`);
    printRelays(relays);
    const relay = relays[await askIndex("繼電器編號", relays.length)];
    lanes.push({
      cameraIndexCode: cam.cameraIndexCode,
      alarmOutputIndexCode: relay.alarmOutputIndexCode,
    });

    const more = (await ask("再新增一組出口？(y/N): ")).toLowerCase();
    if (more !== "y" && more !== "yes") break;
  }
  return lanes;
};

const writeLanes = (lanes: ExitLane[]) => {
  const json = JSON.stringify(lanes);
  upsertEnvLine("YSCP_EXIT_LANES", json);
  console.log(`[+] 已寫入 YSCP_EXIT_LANES=${json}`);
};

const subscribeNow = async () => {
  const result = await ensureEventSubscription();
  if (result.skipped) throw new Error(result.reason || "無法訂閱");
  console.log(`[+] 已訂閱 131622 → ${result.eventDest}`);
};

const logYscpTarget = () => {
  const { yscp } = getConfig();
  console.log(
    `[*] YSCP https://${yscp.hostname}:${yscp.port} | AK=${yscp.accessKey ? `${yscp.accessKey.slice(0, 4)}…` : "(未設)"}`,
  );
};

const runInit = async () => {
  ensureEnvFile();
  loadDotEnv(ENV_PATH);

  console.log("\n=== YSCP 首次設定 ===\n");

  console.log("[1/4] 連線（HOST / AK / SK）");
  const host = await askOrKeep("YSCP_HOST", process.env.YSCP_HOST ?? "");
  const accessKey = await askOrKeep("YSCP_AK", process.env.YSCP_AK ?? "", true);
  const secretKey = await askOrKeep("YSCP_SK", process.env.YSCP_SK ?? "", true);
  if (!host || !accessKey || !secretKey) {
    console.error("[-] HOST、AK、SK 皆必填");
    process.exit(1);
  }
  upsertEnvLine("YSCP_HOST", host);
  upsertEnvLine("YSCP_AK", accessKey);
  upsertEnvLine("YSCP_SK", secretKey);

  console.log("\n[2/4] 事件 Webhook（YSCP 必須能連到此 URL）");
  const currentDest = process.env.YSCP_EVENT_DEST ?? "";
  const lanDests = listLanIps().map((ip) => buildYscpEventDest(ip));
  const preferredCurrent =
    currentDest.startsWith("https://")
      ? currentDest.replace(/^https:\/\//i, "http://")
      : currentDest;
  const candidates = [
    ...new Set([
      ...(preferredCurrent ? [preferredCurrent] : []),
      ...lanDests,
    ]),
  ];
  if (currentDest.startsWith("https://")) {
    console.log(
      "[!] 區網建議用 HTTP（YSCP 對自簽 HTTPS 常 SSL Handshake Failure）",
    );
  }
  candidates.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  const customIndex = candidates.length + 1;
  console.log(`  ${customIndex}. 自行輸入`);
  const destChoice = await askIndex("Webhook 編號", customIndex);
  const eventDest =
    destChoice === customIndex
      ? await ask("YSCP_EVENT_DEST: ")
      : candidates[destChoice];
  if (!eventDest) {
    console.error("[-] 缺少 YSCP_EVENT_DEST");
    process.exit(1);
  }
  upsertEnvLine("YSCP_EVENT_DEST", eventDest);
  upsertEnvLine(
    "YSCP_EVENT_TOKEN",
    process.env.YSCP_EVENT_TOKEN || YSCP_EVENT_TOKEN_DEFAULT,
  );

  logYscpTarget();

  console.log("\n[3/4] 出口相機與繼電器");
  try {
    writeLanes(await selectExitLanes());
  } catch (error) {
    const host = getConfig().yscp.hostname;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[-] 連不上 YSCP（${host}）：${msg}`,
    );
    process.exit(1);
  }

  console.log("\n[4/4] 訂閱車牌事件 131622");
  try {
    await subscribeNow();
  } catch (error) {
    console.error(
      "[-] 訂閱失敗（車道已寫入，可稍後 npm run setup:yscp -- subscribe）",
      error instanceof Error ? error.message : error,
    );
  }

  const openNow = (await ask("\n是否立即測試開閘？(y/N): ")).toLowerCase();
  if (openNow === "y" || openNow === "yes") {
    const relay = getConfig().yscp.exitLanes[0]?.alarmOutputIndexCode;
    if (!relay) {
      console.error("[-] 沒有可測試的繼電器");
      return;
    }
    const { holdMs } = await pulseAlarmOutput({ alarmOutputIndexCode: relay });
    console.log(`[+] 已脈衝開閘 → ${relay}（${holdMs}ms 後關閉）`);
  }

  console.log("\n[+] YSCP 設定完成。請重啟 kiosk（npm run dev / npm run start）。");
};

const main = async () => {
  loadDotEnv(ENV_PATH);
  const { command, flags } = parseArgs(process.argv);
  if (["-h", "--help", "help"].includes(command)) {
    usage();
    process.exit(0);
  }
  if (!command || command === "init") {
    await runInit();
    return;
  }

  logYscpTarget();
  requireCredentials();

  if (command === "subscribe") {
    await subscribeNow();
    return;
  }
  if (command === "cameras") {
    const cams = await listCameras();
    console.log(`[+] 共 ${cams.length} 台相機：`);
    printCams(cams, true);
    return;
  }
  if (command === "relays") {
    const dev = String(flags.dev ?? "").trim();
    if (!dev) {
      console.error("[-] 請提供 --dev <encodeDevIndexCode>");
      process.exit(1);
    }
    const relays = await listAlarmOutputs(dev);
    console.log(`[+] 設備 ${dev} 共 ${relays.length} 個繼電器：`);
    printRelays(relays);
    return;
  }
  if (command === "open") {
    const relay = String(flags.relay ?? "").trim();
    if (!relay) {
      console.error("[-] 請提供 --relay <alarmOutputIndexCode>");
      process.exit(1);
    }
    if (flags.yes !== true) {
      console.error("[-] 開閘測試需加上 --yes");
      process.exit(1);
    }
    const { holdMs } = await pulseAlarmOutput({ alarmOutputIndexCode: relay });
    console.log(`[+] 已脈衝開閘 → ${relay}（${holdMs}ms 後關閉）`);
    return;
  }
  if (command === "lanes") {
    writeLanes(await selectExitLanes());
    return;
  }

  console.error(`[-] 未知命令: ${command}`);
  usage();
  process.exit(1);
};

main().catch((error) => {
  console.error("[-]", error instanceof Error ? error.message : error);
  process.exit(1);
});
