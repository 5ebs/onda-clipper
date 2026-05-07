import { spawn } from "node:child_process";
const bin = process.env.FFMPEG_PATH;
const src = "storage/projects/aba2b163-e03a-44fb-8fe8-2a8dc9a9e682/cta.mp4";
const out = "/tmp/test-cta-norm.mp4";
const args = [
  "-y","-i",src,
  "-vf","scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
  "-c:v","libx264","-profile:v","high","-level","4.0","-crf","20","-preset","veryfast","-pix_fmt","yuv420p",
  "-c:a","aac","-ar","44100","-ac","2","-b:a","128k","-movflags","+faststart",out
];
const env = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA, ComSpec: process.env.ComSpec, PATHEXT: process.env.PATHEXT,
};
const t0 = Date.now();
const c = spawn(bin, args, { stdio: ["ignore","pipe","pipe"], env });
let err = "";
c.stderr.on("data", b => err += b.toString());
c.on("close", code => {
  console.log("exit:", code, "elapsed:", Date.now()-t0, "ms");
  console.log("stderr tail:", err.slice(-500));
});
