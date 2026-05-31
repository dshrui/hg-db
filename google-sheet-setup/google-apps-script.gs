/*
  HG Services Marketing Launch Tracker sync endpoint

  Setup:
  1. Create or open the Google Sheet for this client.
  2. Go to Extensions > Apps Script.
  3. Paste this whole file into Code.gs.
  4. Run setupSheet once from Apps Script to create the required tabs.
  5. Deploy > New deployment > Web app.
  6. Execute as: Me.
  7. Who has access: Anyone with the link.
  8. Add the Web app URL as the backend APPS_SCRIPT_URL environment variable.

  If this script is bound to the Google Sheet, leave SPREADSHEET_ID blank.
  If this script is standalone, paste the target spreadsheet ID below.
*/

const SPREADSHEET_ID = "";

const TAB_NAMES = {
  checklist: "Checklist",
  calendar: "Calendar",
  channels: "Channels",
  contentPlan: "Content Plan",
  settings: "Settings",
  syncLog: "Sync Log",
};

const CHECKLIST_HEADERS = [
  "ID",
  "Section",
  "Checklist Item",
  "Done",
  "Status",
  "Deadline",
  "Answer / Current State",
  "Fix / Next Action",
  "Updated At",
];

const CALENDAR_HEADERS = [
  "Date",
  "Week",
  "Day",
  "Planning Notes",
  "Content / Deadline Type",
  "Owner",
  "Updated At",
];

const CHANNEL_HEADERS = [
  "ID",
  "Channel",
  "Access",
  "Profile Audit",
  "Positioning Notes",
  "Content Role",
  "Owner",
  "Deadline",
  "Baseline Metrics Notes",
  "Updated At",
];

const CONTENT_PLAN_HEADERS = [
  "ID",
  "Week",
  "Pillar",
  "Platform",
  "Topic",
  "Asset Needed",
  "Caption Status",
  "Design Status",
  "Approval Status",
  "Publish Date",
  "Notes",
  "Updated At",
];

function getWorkbook_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(workbook, name) {
  return workbook.getSheetByName(name) || workbook.insertSheet(name);
}

function setupSheet() {
  const workbook = getWorkbook_();
  const checklist = getOrCreateSheet_(workbook, TAB_NAMES.checklist);
  const calendar = getOrCreateSheet_(workbook, TAB_NAMES.calendar);
  const channels = getOrCreateSheet_(workbook, TAB_NAMES.channels);
  const contentPlan = getOrCreateSheet_(workbook, TAB_NAMES.contentPlan);
  const settings = getOrCreateSheet_(workbook, TAB_NAMES.settings);
  const syncLog = getOrCreateSheet_(workbook, TAB_NAMES.syncLog);

  checklist.clear();
  calendar.clear();
  channels.clear();
  contentPlan.clear();
  settings.clear();
  syncLog.clear();

  checklist.getRange(1, 1, 1, CHECKLIST_HEADERS.length).setValues([CHECKLIST_HEADERS]);
  calendar.getRange(1, 1, 1, CALENDAR_HEADERS.length).setValues([CALENDAR_HEADERS]);
  channels.getRange(1, 1, 1, CHANNEL_HEADERS.length).setValues([CHANNEL_HEADERS]);
  contentPlan.getRange(1, 1, 1, CONTENT_PLAN_HEADERS.length).setValues([CONTENT_PLAN_HEADERS]);
  settings.getRange(1, 1, 1, 3).setValues([["Key", "Value", "Notes"]]);
  settings.getRange(2, 1, 5, 3).setValues([
    ["client", "HG Services", "Client name"],
    ["month", "June 2026", "Launch month"],
    ["channels", "Facebook, Instagram, XiaoHongShu, TikTok", "Active launch channels"],
    ["source_html", "private/admin.html", "Backend admin tracker"],
    ["last_sync", "", "Updated by this script"],
  ]);
  syncLog.getRange(1, 1, 1, 7).setValues([["Timestamp", "Action", "Source", "Checklist Items", "Calendar Days", "Channels", "Content Rows"]]);

  [checklist, calendar, channels, contentPlan, settings, syncLog].forEach((sheet) => {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#1769AA").setFontColor("#FFFFFF");
    sheet.autoResizeColumns(1, Math.max(sheet.getLastColumn(), 1));
  });
}

function doPost(event) {
  const payload = JSON.parse((event.postData && event.postData.contents) || "{}");
  const database = payload.database || payload;
  writeDatabase_(database, payload.source || "HTML tracker");
  return json_({ ok: true, updatedAt: new Date().toISOString() });
}

function doGet(event) {
  const action = event.parameter.action || "read";
  const callback = event.parameter.callback;
  const response = action === "read"
    ? { ok: true, database: readDatabase_(), updatedAt: new Date().toISOString() }
    : { ok: true };

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(response) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(response);
}

function writeDatabase_(database, source) {
  const workbook = getWorkbook_();
  const checklist = getOrCreateSheet_(workbook, TAB_NAMES.checklist);
  const calendar = getOrCreateSheet_(workbook, TAB_NAMES.calendar);
  const channels = getOrCreateSheet_(workbook, TAB_NAMES.channels);
  const contentPlan = getOrCreateSheet_(workbook, TAB_NAMES.contentPlan);
  const settings = getOrCreateSheet_(workbook, TAB_NAMES.settings);
  const syncLog = getOrCreateSheet_(workbook, TAB_NAMES.syncLog);
  const now = new Date().toISOString();
  const checklistRows = Object.keys(database.checklists || {}).sort().map((id) => {
    const item = database.checklists[id] || {};
    return [
      id,
      item.section || "",
      item.title || "",
      item.done ? "TRUE" : "FALSE",
      item.status || "",
      item.deadline || "",
      item.answer || "",
      item.fix || "",
      now,
    ];
  });
  const calendarRows = Object.keys(database.calendar || {}).sort().map((date) => {
    const parsed = parseDate_(date);
    return [
      date,
      parsed.week,
      parsed.dayName,
      database.calendar[date] || "",
      "",
      "",
      now,
    ];
  });
  const channelRows = Object.keys(database.channels || {}).sort().map((id) => {
    const item = database.channels[id] || {};
    return [
      id,
      item.channel || id,
      item.accessStatus || "",
      item.auditStatus || "",
      item.positioningNotes || "",
      item.contentRole || "",
      item.owner || "",
      item.deadline || "",
      item.baselineNotes || "",
      now,
    ];
  });
  const contentRows = Object.keys(database.contentPlan || {}).sort().map((id) => {
    const item = database.contentPlan[id] || {};
    return [
      id,
      item.week || "",
      item.pillar || "",
      item.platform || "",
      item.topic || "",
      item.assetNeeded || "",
      item.captionStatus || "",
      item.designStatus || "",
      item.approvalStatus || "",
      item.publishDate || "",
      item.notes || "",
      now,
    ];
  });

  replaceRows_(checklist, CHECKLIST_HEADERS, checklistRows);
  replaceRows_(calendar, CALENDAR_HEADERS, calendarRows);
  replaceRows_(channels, CHANNEL_HEADERS, channelRows);
  replaceRows_(contentPlan, CONTENT_PLAN_HEADERS, contentRows);
  settings.getRange("A1:C1").setValues([["Key", "Value", "Notes"]]);
  settings.getRange("A2:C5").setValues([
    ["client", "HG Services", "Client name"],
    ["month", "June 2026", "Launch month"],
    ["channels", "Facebook, Instagram, XiaoHongShu, TikTok", "Active launch channels"],
    ["last_sync", now, "Last HTML push"],
  ]);
  appendLog_(syncLog, now, "push", source, checklistRows.length, calendarRows.length, channelRows.length, contentRows.length);
}

function readDatabase_() {
  const workbook = getWorkbook_();
  const checklist = getOrCreateSheet_(workbook, TAB_NAMES.checklist);
  const calendar = getOrCreateSheet_(workbook, TAB_NAMES.calendar);
  const channels = getOrCreateSheet_(workbook, TAB_NAMES.channels);
  const contentPlan = getOrCreateSheet_(workbook, TAB_NAMES.contentPlan);
  const checklists = {};
  const calendarData = {};
  const channelData = {};
  const contentPlanData = {};
  const checklistValues = checklist.getDataRange().getValues();
  const calendarValues = calendar.getDataRange().getValues();
  const channelValues = channels.getDataRange().getValues();
  const contentPlanValues = contentPlan.getDataRange().getValues();

  checklistValues.slice(1).forEach((row) => {
    const id = row[0];
    if (!id) {
      return;
    }
    checklists[id] = {
      section: row[1] || "",
      title: row[2] || "",
      done: String(row[3]).toUpperCase() === "TRUE",
      status: row[4] || "Not started",
      deadline: normalizeDateValue_(row[5]),
      answer: row[6] || "",
      fix: row[7] || "",
    };
  });

  calendarValues.slice(1).forEach((row) => {
    const date = normalizeDateValue_(row[0]);
    if (date) {
      calendarData[date] = row[3] || "";
    }
  });

  channelValues.slice(1).forEach((row) => {
    const id = row[0];
    if (!id) {
      return;
    }
    channelData[id] = {
      channel: row[1] || id,
      accessStatus: row[2] || "",
      auditStatus: row[3] || "",
      positioningNotes: row[4] || "",
      contentRole: row[5] || "",
      owner: row[6] || "",
      deadline: normalizeDateValue_(row[7]),
      baselineNotes: row[8] || "",
    };
  });

  contentPlanValues.slice(1).forEach((row) => {
    const id = row[0];
    if (!id) {
      return;
    }
    contentPlanData[id] = {
      id,
      week: row[1] || "",
      pillar: row[2] || "",
      platform: row[3] || "",
      topic: row[4] || "",
      assetNeeded: row[5] || "",
      captionStatus: row[6] || "",
      designStatus: row[7] || "",
      approvalStatus: row[8] || "",
      publishDate: normalizeDateValue_(row[9]),
      notes: row[10] || "",
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    checklists,
    calendar: calendarData,
    channels: channelData,
    contentPlan: contentPlanData,
    settings: {},
  };
}

function replaceRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

function appendLog_(sheet, timestamp, action, source, checklistCount, calendarCount, channelCount, contentCount) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 7).setValues([["Timestamp", "Action", "Source", "Checklist Items", "Calendar Days", "Channels", "Content Rows"]]);
  }
  sheet.appendRow([timestamp, action, source, checklistCount, calendarCount, channelCount, contentCount]);
}

function parseDate_(dateString) {
  const date = new Date(dateString + "T00:00:00Z");
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = Number(dateString.slice(-2));
  return {
    week: day > 28 ? "Report" : "Week " + Math.ceil(day / 7),
    dayName: names[date.getUTCDay()],
  };
}

function normalizeDateValue_(value) {
  if (!value) {
    return "";
  }
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
