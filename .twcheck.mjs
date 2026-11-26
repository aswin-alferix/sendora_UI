import postcss from "postcss";
import tw from "@tailwindcss/postcss";
import fs from "fs";
const css = fs.readFileSync("src/app/globals.css", "utf8");
const r = await postcss([tw({ base: process.cwd() })]).process(css, { from: process.cwd() + "/src/app/globals.css" });
const out = r.css;
for (const k of ["animate-toast-in", "animate-toast-out", "animate-toast-swipe-out", "@keyframes toast-in", "--radix-toast-swipe-move-x", "motion-reduce"])
  console.log(k, out.includes(k));
const i = out.indexOf("animate-toast-swipe-out\\:"); console.log(out.slice(out.lastIndexOf("\n", i), i + 260));
