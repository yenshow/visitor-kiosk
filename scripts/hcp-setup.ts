/**
 * YSCP 首次設定 CLI — npm run setup:hcp -- <subscribe|cameras|relays|open|lanes>
 */
import { createInterface } from "readline";
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env");

const loadDotEnv = (filePath: string) => {
  if (!existsSync(filePath)) return;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
用法: npm run setup:hcp -- <command> [options]

  subscribe                 訂閱車牌事件 131622
  cameras                   列出攝影機
  relays --dev <id>         依 encodeDevIndexCode 列繼電器
  open --relay <id> --yes   開閘測試
  lanes [--write-env]       互動產出 HCP_EXIT_LANES

需先設定 .env 的 HCP_HOST / HCP_AK / HCP_SK。
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

const upsertEnvLine = (filePath: string, key: string, value: string) => {
  const line = `${key}=${value}`;
  let text = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : `${text.replace(/\s*$/, "")}\n${line}\n`;
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, filePath);
};

const main = async () => {
  loadDotEnv(ENV_PATH);
  const { command, flags } = parseArgs(process.argv);
  if (!command || ["-h", "--help", "help"].includes(command)) {
    usage();
    process.exit(command ? 0 : 1);
  }

  const { getConfig } = await import("../src/lib/config");
  const { ensureEventSubscription } = await import("../src/lib/hcp/event-api");
  const gate = await import("../src/lib/hcp/exit-gate");
  const {
    controlAlarmOutput,
    listCameras,
    listAlarmOutputs,
    isLikelyLprCamera,
  } = gate;

  const { hcp } = getConfig();
  console.log(
    `[*] YSCP https://${hcp.hostname}:${hcp.port} | AK=${hcp.accessKey ? `${hcp.accessKey.slice(0, 4)}…` : "(未設)"}`,
  );
  if (!hcp.accessKey || !hcp.secretKey) {
    console.error("[-] 請在 .env 設定 HCP_AK / HCP_SK");
    process.exit(1);
  }

  const printCams = (
    cams: Awaited<ReturnType<typeof listCameras>>,
    detail: boolean,
  ) => {
    cams.forEach((cam, i) => {
      const mark = isLikelyLprCamera(cam) ? " [LPR?]" : "";
      if (detail) {
        console.log(
          `  ${i + 1}. ${cam.cameraName || "(無名稱)"}${mark}` +
            `\n     cameraIndexCode=${cam.cameraIndexCode}` +
            `  encodeDevIndexCode=${cam.encodeDevIndexCode || "-"}` +
            `  狀態=${cam.status === 1 ? "在線" : "離線/其他"}`,
        );
        if (cam.capabilitySet) {
          console.log(`     capabilitySet=${cam.capabilitySet}`);
        }
      } else {
        console.log(
          `  ${i + 1}. ${cam.cameraName || "(無名稱)"}${mark}  id=${cam.cameraIndexCode}  dev=${cam.encodeDevIndexCode || "-"}`,
        );
      }
    });
  };

  const printRelays = (relays: Awaited<ReturnType<typeof listAlarmOutputs>>) => {
    relays.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.alarmOutputName || "(無名稱)"}  id=${r.alarmOutputIndexCode}`,
      );
    });
  };

  if (command === "subscribe") {
    const result = await ensureEventSubscription();
    if (result.skipped) {
      console.error(`[-] ${result.reason}`);
      process.exit(1);
    }
    console.log(`[+] 已訂閱 131622 → ${result.eventDest}`);
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
    await controlAlarmOutput({ alarmOutputIndexCode: relay, action: 1 });
    console.log(`[+] 已下發開閘 → ${relay}`);
    return;
  }

  if (command === "lanes") {
    const cams = await listCameras();
    if (cams.length === 0) {
      console.error("[-] 查無攝影機");
      process.exit(1);
    }

    console.log("\n請選擇【出口】LPR 相機（勿選入場）：");
    printCams(cams, false);
    const cam = cams[await askIndex("相機編號", cams.length)];
    if (!cam.encodeDevIndexCode) {
      console.error("[-] 此相機缺少 encodeDevIndexCode");
      process.exit(1);
    }

    const relays = await listAlarmOutputs(cam.encodeDevIndexCode);
    if (relays.length === 0) {
      console.error("[-] 查無警報輸出，請確認 HCP 繼電器綁定");
      process.exit(1);
    }

    console.log(`\n設備 ${cam.encodeDevIndexCode} 的繼電器：`);
    printRelays(relays);
    const relay = relays[await askIndex("繼電器編號", relays.length)];

    const json = JSON.stringify([
      {
        cameraIndexCode: cam.cameraIndexCode,
        alarmOutputIndexCode: relay.alarmOutputIndexCode,
      },
    ]);
    console.log("\n[+] 請寫入 .env：");
    console.log(`    HCP_EXIT_LANES=${json}`);

    if (flags["write-env"] === true) {
      upsertEnvLine(ENV_PATH, "HCP_EXIT_LANES", json);
      console.log(`[+] 已寫入 ${ENV_PATH}`);
    }

    const openNow = (await ask("是否立即測試開閘？(y/N): ")).toLowerCase();
    if (openNow === "y" || openNow === "yes") {
      await controlAlarmOutput({
        alarmOutputIndexCode: relay.alarmOutputIndexCode,
        action: 1,
      });
      console.log(`[+] 已下發開閘 → ${relay.alarmOutputIndexCode}`);
    }
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
