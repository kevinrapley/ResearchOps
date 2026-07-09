import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/card-sorts.js", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const routerSource = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
const migrationSource = fs.readFileSync("infra/cloudflare/migrations/0027_card_sorts.sql", "utf8");
const setupPage = fs.readFileSync("public/pages/study/card-sort/index.html", "utf8");
const setupScript = fs.readFileSync("public/js/study-card-sort-page.js", "utf8");
const sessionPage = fs.readFileSync("public/pages/study/session/index.html", "utf8");
const sessionController = fs.readFileSync("public/components/session-card-sort-controller.js", "utf8");
const cardSortStyles = fs.readFileSync("public/css/study-card-sort.css", "utf8");
const studyPage = fs.readFileSync("public/pages/study/index.html", "utf8");
const studyScript = fs.readFileSync("public/js/study-page.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

/* Worker service */
includes(serviceSource, "rops_card_sort_configs", "card sorts service");
includes(serviceSource, "rops_card_sort_results", "card sorts service");
includes(serviceSource, "getCardSortConfig", "card sorts service");
includes(serviceSource, "saveCardSortConfig", "card sorts service");
includes(serviceSource, "listCardSortResults", "card sorts service");
includes(serviceSource, "createCardSortResult", "card sorts service");
includes(serviceSource, "updateCardSortResult", "card sorts service");
includes(serviceSource, "card_sort_store_unavailable", "card sorts service");

includes(serviceIndexSource, 'import * as CardSorts from "./card-sorts.js"', "service index");
includes(serviceIndexSource, "getCardSortConfig", "service index");

/* Router */
includes(routerSource, '"/api/card-sorts/config"', "core router");
includes(routerSource, '"/api/card-sorts/results"', "core router");
includes(routerSource, "service.getCardSortConfig", "core router");
includes(routerSource, "service.saveCardSortConfig", "core router");
includes(routerSource, "service.listCardSortResults", "core router");
includes(routerSource, "service.createCardSortResult", "core router");
includes(routerSource, "service.updateCardSortResult", "core router");

/* D1 migration */
includes(migrationSource, "CREATE TABLE IF NOT EXISTS rops_card_sort_configs", "card sorts D1 migration");
includes(migrationSource, "CREATE TABLE IF NOT EXISTS rops_card_sort_results", "card sorts D1 migration");
includes(migrationSource, "idx_rops_card_sort_results_study", "card sorts D1 migration");
includes(migrationSource, "idx_rops_card_sort_results_session", "card sorts D1 migration");

/* Setup page */
includes(setupPage, "Prepare the card sort", "card sort setup page");
includes(setupPage, 'id="card-sort-form"', "card sort setup page");
includes(setupPage, 'id="card-editor-list"', "card sort setup page");
includes(setupPage, 'id="group-editor-list"', "card sort setup page");
includes(setupPage, "/js/study-card-sort-page.js", "card sort setup page");
includes(setupScript, "/api/card-sorts/config", "card sort setup script");
includes(setupScript, "cardSortType", "card sort setup script");

/* Session page card sort workflow */
includes(sessionPage, 'id="card-sort-section"', "study session page");
includes(sessionPage, 'id="card-sort-tray-list"', "study session page");
includes(sessionPage, 'id="card-sort-groups-grid"', "study session page");
includes(sessionPage, 'id="btn-complete-card-sort"', "study session page");
includes(sessionPage, 'id="card-sort-reset-confirmation"', "study session page");
includes(sessionPage, 'id="btn-confirm-reset-card-sort"', "study session page");
includes(sessionPage, "/components/session-card-sort-controller.js", "study session page");
includes(sessionController, "/api/card-sorts/config", "session card sort controller");
includes(sessionController, "/api/card-sorts/results", "session card sort controller");
includes(sessionController, "card sort", "session card sort controller");
includes(sessionController, "nestGroup", "session card sort controller");
includes(sessionController, "addParticipantCard", "session card sort controller");
includes(sessionController, "openInlineTextInput", "session card sort controller");
includes(sessionController, "text/rops-card-origin", "session card sort controller");
includes(sessionController, "setDragImage", "session card sort controller");
includes(sessionController, "startDragPreview", "session card sort controller");
includes(sessionController, "event.clientX - rect.width / 2", "session card sort controller");
includes(sessionController, "trayInsertionIndex", "session card sort controller");
includes(sessionController, "moveCardToTrayAt", "session card sort controller");
includes(sessionController, "state.unsorted.splice(index, 0, cardId)", "session card sort controller");
includes(sessionController, 'originGroupId === "__tray__"', "session card sort controller");
includes(sessionController, "originGroupId === node.id", "session card sort controller");
includes(sessionController, "card-sort-card__move", "session card sort controller");
includes(sessionController, "Sort at least one card into a group before marking the card sort complete.", "session card sort controller");
includes(sessionController, "Confirm reset to move all cards back to the tray.", "session card sort controller");
includes(sessionController, "Card sort reset. Changes save automatically.", "session card sort controller");
includes(sessionController, "Card sort reset cancelled.", "session card sort controller");
includes(cardSortStyles, "prefers-reduced-motion: reduce", "card sort stylesheet");
includes(cardSortStyles, ".card-sort-drag-preview", "card sort stylesheet");
includes(cardSortStyles, ".card-sort-drag-preview--tilted", "card sort stylesheet");
includes(cardSortStyles, ".card-sort-transparent-drag-image", "card sort stylesheet");
includes(cardSortStyles, "transform: rotate(2deg) scale(1.01)", "card sort stylesheet");
excludes(cardSortStyles, ".card-sort-card.card-sort-dragging {\n\topacity: 0.32;\n\ttransform", "card sort stylesheet");
excludes(cardSortStyles, "card-sort-drag-tilt", "card sort stylesheet");
excludes(cardSortStyles, "infinite alternate", "card sort stylesheet");
excludes(sessionController, "window.prompt", "session card sort controller");
excludes(sessionController, "window.confirm", "session card sort controller");

/* Study overview task */
includes(studyPage, 'id="link-card-sort"', "study page");
includes(studyScript, "renderCardSortTask", "study page script");
includes(studyScript, "/pages/study/card-sort/", "study page script");
