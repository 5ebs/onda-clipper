import { spawn } from "node:child_process";

const bin = process.env.FFMPEG_PATH;
const src =
  "storage/projects/aba2b163-e03a-44fb-8fe8-2a8dc9a9e682/source/zXvVb1b8BTk.mp4";
const out = "/tmp/test-trim.mp4";

const args = [
  "-y",
  "-i", src,
  "-t", "5",
  "-vf",
  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
  "-c:v", "libx264",
  "-profile:v", "high",
  "-level", "4.0",
  "-crf", "20",
  "-preset", "veryfast",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-ar", "44100",
  "-ac", "2",
  "-b:a", "128k",
  "-movflags", "+faststart",
  out,
];

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

console.log("running ffmpeg trim+encode on real source...");
const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env });
let err = "";
child.stderr.on("data", (b) => (err += b.toString()));
child.on("close", (code) => {
  console.log("exit:", code);
  console.log("stderr tail:", err.slice(-800));
});
