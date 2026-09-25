const CONFIG = {
  spreadsheetTitle: "Журнал проверок пропуска на Мосфильм",
  sheetName: "Проверки",
  expectedSource: "mf-q4-2026",
};

const HEADERS = ["Дата и время", "Фамилия", "Результат", "Сессия"];

function doGet() {
  return ContentService.createTextOutput("ok");
}

function setup() {
  const spreadsheet = getOrCreateSpreadsheet_();
  ensureSheet_(spreadsheet);
  console.log(spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

function doPost(event) {
  const params = event && event.parameter ? event.parameter : {};
  const surname = normalizeSurname_(params.surname || "");
  const status = params.status === "found" ? "Пропуск заказан" : "Фамилия не подтверждена";
  const sessionId = String(params.sessionId || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80);
  const source = String(params.source || "");

  if (source !== CONFIG.expectedSource || surname.length < 2 || !sessionId) {
    return ContentService.createTextOutput("ignored");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return ContentService.createTextOutput("busy");
  }

  try {
    const cache = CacheService.getScriptCache();
    const duplicateKey = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        `${sessionId}:${surname}:${status}`
      )
    );

    if (cache.get(duplicateKey)) {
      return ContentService.createTextOutput("duplicate");
    }

    const spreadsheet = getOrCreateSpreadsheet_();
    const sheet = ensureSheet_(spreadsheet);
    sheet.appendRow([new Date(), surname, status, sessionId]);
    cache.put(duplicateKey, "1", 10);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("LOG_SPREADSHEET_ID");

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      properties.deleteProperty("LOG_SPREADSHEET_ID");
    }
  }

  const spreadsheet = SpreadsheetApp.create(CONFIG.spreadsheetTitle);
  properties.setProperty("LOG_SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function ensureSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(CONFIG.sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#f1f3f4");
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("dd.MM.yyyy HH:mm:ss");
    sheet.setColumnWidth(1, 155);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 210);
    sheet.setColumnWidth(4, 280);
  }

  return sheet;
}

function normalizeSurname_(value) {
  return String(value)
    .trim()
    .split(/\s+/)[0]
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^а-я-]/g, "")
    .slice(0, 80);
}
