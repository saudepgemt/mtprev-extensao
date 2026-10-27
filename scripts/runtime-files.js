"use strict";

// Lista explícita: um backup ou arquivo novo no workspace nunca entra no ZIP por acaso.
const RUNTIME_FILES = [
  "offscreen.html", "options.html", "privacy.html", "THIRD_PARTY_NOTICES.txt",
  "js/background.js", "js/content_bridge.js", "js/iframe_autos_bridge.js", "js/radial_menu.js", "js/options.js",
  "js/watch_mail_options.js", "js/watch_mail_oauth.js",
  "js/process_watch_background.js", "js/process_watch_panel.js",
  "js/shared/spa_selectors.js", "js/shared/spa_adapter.js",
  "js/shared/active_team_database.js", "js/shared/mtprev_triage_rules.js",
  "js/extrator/content.js", "js/gestao/management_report_panel.js",
  "js/prazos/deadline_report_panel.js", "js/triagem/spa_extension_panel.js",
  "js/triagem/mtprev_pop_panel.js", "js/triagem/offscreen_pdf_reader.js",
  "js/libs/exceljs.min.js", "js/libs/pdf-lib.min.js", "js/libs/pdf-lib.LICENSE.md",
  "js/vendor/pdf.min.js", "js/vendor/pdf.worker.min.js",
  "css/extrator.css", "css/menu.css", "css/radial_menu.css",
  "css/process_watch.css", "css/theme.css", "css/options.css",
  "data/equipe.xlsx", "images/logo-mtprev.png",
  "images/icon-mtprev16.png", "images/icon-mtprev48.png", "images/icon-mtprev128.png",
  ...[
    "account_tree", "calendar_month", "check_circle", "close", "content_copy",
    "description", "edit_document", "event", "fact_check", "filter_alt_off",
    "filter_alt", "format_list_numbered", "history", "inbox", "open_in_new",
    "outgoing_mail", "power_settings_new", "radar", "summarize"
  ].map(name => `images/material-rounded/${name}.svg`),
  "images/material-rounded/LICENSE.txt"
];

module.exports = { RUNTIME_FILES };
