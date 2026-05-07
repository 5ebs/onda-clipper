import { spawn } from "node:child_process";

const bin = process.env.FFMPEG_PATH;
if (!bin) { console.error("set FFMPEG_PATH"); process.exit(1); }

const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  ComSpec: process.env.ComSpec,
  PATHEXT: process.env.PATHEXT,
};
console.log("bin:", bin);
console.log("env keys:", Object.keys(env).join(","));
console.log(
  "env bytes:",
  Object.entries(env).reduce(
    (s, [k, v]) => s + k.length + (v?.length ?? 0) + 2,
    0,
  ),
);
const child = spawn(bin, ["-version"], { stdio: ["ignore", "pipe", "pipe"], env });
let out = "", err = "";
child.stdout.on("data", (b) => (out += b.toString()));
child.stderr.on("data", (b) => (err += b.toString()));
child.on("close", (code) => {
  console.log("exit:", code);
  console.log("stdout:", out.slice(0, 500));
  console.log("stderr:", err.slice(0, 500));
});
