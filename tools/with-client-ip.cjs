/**
 * 載入 Next standalone server.js 前，為每個連線注入 x-real-ip。
 * cwd 須為 app\（與 server.js 同目錄）。
 */
"use strict";

const http = require("http");
const path = require("path");

const normalize = (raw) => {
  let ip = String(raw || "").trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
};

const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function patchedEmit(event, ...args) {
  if (event === "request") {
    const req = args[0];
    try {
      const remote = normalize(req.socket && req.socket.remoteAddress);
      if (remote && !req.headers["x-real-ip"]) {
        req.headers["x-real-ip"] = remote;
      }
    } catch {
      // ignore
    }
  }
  return originalEmit.apply(this, arguments);
};

require(path.join(process.cwd(), "server.js"));
