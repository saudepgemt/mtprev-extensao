"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/radial_menu.js"), "utf8");
const snippet = source.match(/^    async function openSettings\(\) \{[\s\S]*?^    \}/m)?.[0];

test("Configurações usa o service worker para abrir opções a partir do SPA", async () => {
  assert.ok(snippet, "função openSettings não encontrada");
  const sent = [], notices = [];
  let closed = 0;
  const sandbox = {
    chrome: { runtime: { sendMessage: async request => { sent.push(request); return { ok: true }; } } },
    notice: message => notices.push(message),
    close: () => closed++
  };
  vm.runInNewContext(snippet + "\nthis.openSettings = openSettings;", sandbox);
  await sandbox.openSettings();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "MTPREV_OPEN_OPTIONS");
  assert.equal(closed, 1);
  assert.deepEqual(notices, []);
  const background = fs.readFileSync(path.join(root, "js/background.js"), "utf8");
  assert.match(background, /message\.type === "MTPREV_OPEN_OPTIONS"/);
  assert.match(background, /chrome\.runtime\.openOptionsPage\(\)/);
});

test("Configurações mostra erro quando a origem não é autorizada", async () => {
  const notices = [];
  let closed = 0;
  const sandbox = {
    chrome: { runtime: { sendMessage: async () => ({ ok: false, error: "Origem não permitida." }) } },
    notice: message => notices.push(message),
    close: () => closed++
  };
  vm.runInNewContext(snippet + "\nthis.openSettings = openSettings;", sandbox);
  await sandbox.openSettings();
  assert.equal(closed, 0);
  assert.match(notices[0], /Origem não permitida/);
});

test("Configurações usa ícone de engrenagem disponível no pacote", () => {
  const { RUNTIME_FILES } = require("../scripts/runtime-files.js");
  assert.match(source, /title:'Configurações',icon:'settings',run:openSettings/);
  assert.ok(RUNTIME_FILES.includes("images/material-rounded/settings.svg"));
  assert.match(fs.readFileSync(path.join(root,"images/material-rounded/settings.svg"),"utf8"), /<svg/);
});
