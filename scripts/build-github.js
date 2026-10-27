"use strict";

const path = require("node:path");
const { buildChromeRuntime } = require("./build-chrome-store.js");
const { buildFirefox } = require("./build-firefox.js");

// Sem npm install, arquivo privado ou executável zip: também funciona no Windows.
function buildGithub(sourceRoot = path.resolve(__dirname, ".."), distRoot = path.join(sourceRoot, "dist")) {
  const { output: chrome } = buildChromeRuntime(sourceRoot, path.join(distRoot, "chrome-store"));
  const firefox = buildFirefox(chrome, path.join(distRoot, "firefox"));
  return { chrome, firefox };
}

if (require.main === module) console.log(JSON.stringify(buildGithub(), null, 2));
module.exports = { buildGithub };
