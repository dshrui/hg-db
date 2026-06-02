/*
  HG Services Ops Tool sync endpoint

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
  tasks: "Tasks",
  content: "Content",
  calendar: "Calendar",
  channels: "Channels",
  reports: "Reports",
  settings: "Settings",
  syncLog: "Sync Log",
};

const TASK_HEADERS = [
  "ID",
  "Title",
  "Category",
  "Owner",
  "Role",
  "Status",
  "Priority",
  "Deadline",
  "Blocker",
  "Next Action",
  "Notes",
  "Updated At",
];

const CONTENT_HEADERS = [
  "ID",
  "Week",
  "Platform",
  "Pillar",
  "Topic",
  "Asset Needed",
  "Status",
  "Owner",
  "Publish Date",
  "Notes",
  "Updated At",
];

const CALENDAR_HEADERS = [
  "Date",
  "Notes",
  "Owner",
  "Type",
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

const REPORT_HEADERS = [
  "Key",
  "Label",
  "Output",
  "KPI Notes",
  "Learnings",
  "Next Actions",
  "Updated At",
];

const SYNC_HEADERS = [
  "Timestamp",
  "Action",
  "Source",
  "Tasks",
  "Content",
  "Calendar",
  "Channels",
  "Reports",
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
  const tasks = getOrCreateSheet_(workbook, TAB_NAMES.tasks);
  const content = getOrCreateSheet_(workbook, TAB_NAMES.content);
  const calendar = getOrCreateSheet_(workbook, TAB_NAMES.calendar);
  const channels = getOrCreateSheet_(workbook, TAB_NAMES.channels);
  const reports = getOrCreateSheet_(workbook, TAB_NAMES.reports);
  const settings = getOrCreateSheet_(workbook, TAB_NAMES.settings);
  const syncLog = getOrCreateSheet_(workbook, TAB_NAMES.syncLog);

  replaceRows_(tasks, TASK_HEADERS, []);
  replaceRows_(content, CONTENT_HEADERS, []);
  replaceRows_(calendar, CALENDAR_HEADERS, []);
  replaceRows_(channels, CHANNEL_HEADERS, []);
  replaceRows_(reports, REPORT_HEADERS, []);
  replaceRows_(settings, ["Key", "Value", "Notes"], [
    ["client", "HG Services", "Client name"],
    ["month", "June 2026", "Launch month"],
    ["source", "HG Services ops tool", "Primary workspace"],
    ["last_sync", "", "Updated by this script"],
  ]);
  replaceRows_(syncLog, SYNC_HEADERS, []);

  [tasks, content, calendar, channels, reports, settings, syncLog].forEach(formatSheet_);
}

function doPost(event) {
  const payload = JSON.parse((event.postData && event.postData.contents) || "{}");
  const database = normalizeIncomingDatabase_(payload.database || payload);
  writeDatabase_(database, payload.source || "HG Services ops tool");
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

function normalizeIncomingDatabase_(database) {
  const value = database && typeof database === "object" ? database : {};
  return {
    version: 2,
    updatedAt: value.updatedAt || new Date().toISOString(),
    tasks: Array.isArray(value.tasks) ? value.tasks : legacyChecklistsToTasks_(value.checklists || {}),
    contentItems: Array.isArray(value.contentItems) ? value.contentItems : legacyContentToItems_(value.contentPlan || {}),
    calendarEntries: normalizeCalendar_(value.calendarEntries || value.calendar || {}),
    channels: Array.isArray(value.channels) ? value.channels : objectValues_(value.channels || {}),
    reports: value.reports && typeof value.reports === "object" ? value.reports : {},
    settings: value.settings && typeof value.settings === "object" ? value.settings : {},
    syncLog: Array.isArray(value.syncLog) ? value.syncLog : [],
  };
}

function legacyChecklistsToTasks_(checklists) {
  return Object.keys(checklists || {}).sort().map((id) => {
    const item = checklists[id] || {};
    return {
      id,
      title: item.title || id,
      category: item.section || "Onboarding",
      owner: "Ops",
      role: "Ops",
      status: item.done ? "Done" : normalizeTaskStatus_(item.status),
      priority: "Medium",
      deadline: item.deadline || "",
      blocker: item.status === "Blocked" ? item.fix || "" : "",
      nextAction: item.fix || "",
      notes: item.answer || "",
    };
  });
}

function legacyContentToItems_(contentPlan) {
  return Object.keys(contentPlan || {}).sort().map((id) => {
    const item = contentPlan[id] || {};
    return {
      id,
      week: item.week || "",
      platform: item.platform || "",
      pillar: item.pillar || "",
      topic: item.topic || "",
      assetNeeded: item.assetNeeded || "",
      status: normalizeContentStatus_(item.approvalStatus || item.designStatus || item.captionStatus),
      owner: "Ops",
      publishDate: item.publishDate || "",
      notes: item.notes || "",
    };
  });
}

function normalizeCalendar_(calendar) {
  const entries = {};
  Object.keys(calendar || {}).forEach((date) => {
    const value = calendar[date];
    if (value && typeof value === "object") {
      entries[date] = {
        date: value.date || date,
        notes: value.notes || "",
        owner: value.owner || "",
        type: value.type || "",
      };
    } else {
      entries[date] = {
        date,
        notes: value || "",
        owner: "",
        type: "",
      };
    }
  });
  return entries;
}

function objectValues_(value) {
  return Object.keys(value || {}).sort().map((key) => {
    const row = value[key] || {};
    row.id = row.id || key;
    return row;
  });
}

function writeDatabase_(database, source) {
  const workbook = getWorkbook_();
  const tasksSheet = getOrCreateSheet_(workbook, TAB_NAMES.tasks);
  const contentSheet = getOrCreateSheet_(workbook, TAB_NAMES.content);
  const calendarSheet = getOrCreateSheet_(workbook, TAB_NAMES.calendar);
  const channelsSheet = getOrCreateSheet_(workbook, TAB_NAMES.channels);
  const reportsSheet = getOrCreateSheet_(workbook, TAB_NAMES.reports);
  const settingsSheet = getOrCreateSheet_(workbook, TAB_NAMES.settings);
  const syncLogSheet = getOrCreateSheet_(workbook, TAB_NAMES.syncLog);
  const now = new Date().toISOString();

  const taskRows = (database.tasks || []).map((item) => [
    item.id || "",
    item.title || "",
    item.category || "",
    item.owner || "",
    item.role || "",
    item.status || "",
    item.priority || "",
    item.deadline || "",
    item.blocker || "",
    item.nextAction || "",
    item.notes || "",
    now,
  ]);

  const contentRows = (database.contentItems || []).map((item) => [
    item.id || "",
    item.week || "",
    item.platform || "",
    item.pillar || "",
    item.topic || "",
    item.assetNeeded || "",
    item.status || "",
    item.owner || "",
    item.publishDate || "",
    item.notes || "",
    now,
  ]);

  const calendarRows = Object.keys(database.calendarEntries || {}).sort().map((date) => {
    const item = database.calendarEntries[date] || {};
    return [
      date,
      item.notes || "",
      item.owner || "",
      item.type || "",
      now,
    ];
  });

  const channelRows = (database.channels || []).map((item) => [
    item.id || "",
    item.channel || item.id || "",
    item.accessStatus || "",
    item.auditStatus || "",
    item.positioningNotes || "",
    item.contentRole || "",
    item.owner || "",
    item.deadline || "",
    item.baselineNotes || "",
    now,
  ]);

  const reportRows = Object.keys(database.reports || {}).sort().map((key) => {
    const item = database.reports[key] || {};
    return [
      key,
      item.label || key,
      item.output || "",
      item.kpis || "",
      item.learnings || "",
      item.nextActions || "",
      now,
    ];
  });

  replaceRows_(tasksSheet, TASK_HEADERS, taskRows);
  replaceRows_(contentSheet, CONTENT_HEADERS, contentRows);
  replaceRows_(calendarSheet, CALENDAR_HEADERS, calendarRows);
  replaceRows_(channelsSheet, CHANNEL_HEADERS, channelRows);
  replaceRows_(reportsSheet, REPORT_HEADERS, reportRows);
  replaceRows_(settingsSheet, ["Key", "Value", "Notes"], [
    ["client", database.settings.client || "HG Services", "Client name"],
    ["month", database.settings.month || "June 2026", "Launch month"],
    ["focus", database.settings.focus || "", "Marketing focus"],
    ["last_sync", now, "Last ops tool push"],
  ]);

  appendLog_(syncLogSheet, now, "push", source, taskRows.length, contentRows.length, calendarRows.length, channelRows.length, reportRows.length);
  [tasksSheet, contentSheet, calendarSheet, channelsSheet, reportsSheet, settingsSheet, syncLogSheet].forEach(formatSheet_);
}

function readDatabase_() {
  const workbook = getWorkbook_();
  const tasks = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.tasks));
  const content = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.content));
  const calendar = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.calendar));
  const channels = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.channels));
  const reports = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.reports));
  const settingsRows = readRows_(getOrCreateSheet_(workbook, TAB_NAMES.settings));
  const settings = {};
  const reportData = {};
  const calendarEntries = {};

  settingsRows.forEach((row) => {
    if (row.Key) {
      settings[row.Key] = row.Value || "";
    }
  });

  reports.forEach((row) => {
    const key = row.Key;
    if (!key) {
      return;
    }
    reportData[key] = {
      label: row.Label || key,
      output: row.Output || "",
      kpis: row["KPI Notes"] || "",
      learnings: row.Learnings || "",
      nextActions: row["Next Actions"] || "",
    };
  });

  calendar.forEach((row) => {
    const date = normalizeDateValue_(row.Date);
    if (!date) {
      return;
    }
    calendarEntries[date] = {
      date,
      notes: row.Notes || "",
      owner: row.Owner || "",
      type: row.Type || "",
    };
  });

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    tasks: tasks.map((row) => ({
      id: row.ID || "",
      title: row.Title || "",
      category: row.Category || "",
      owner: row.Owner || "",
      role: row.Role || "",
      status: row.Status || "Not started",
      priority: row.Priority || "Medium",
      deadline: normalizeDateValue_(row.Deadline),
      blocker: row.Blocker || "",
      nextAction: row["Next Action"] || "",
      notes: row.Notes || "",
    })).filter((row) => row.id),
    contentItems: content.map((row) => ({
      id: row.ID || "",
      week: row.Week || "",
      platform: row.Platform || "",
      pillar: row.Pillar || "",
      topic: row.Topic || "",
      assetNeeded: row["Asset Needed"] || "",
      status: row.Status || "Idea",
      owner: row.Owner || "",
      publishDate: normalizeDateValue_(row["Publish Date"]),
      notes: row.Notes || "",
    })).filter((row) => row.id),
    calendarEntries,
    channels: channels.map((row) => ({
      id: row.ID || "",
      channel: row.Channel || row.ID || "",
      accessStatus: row.Access || "",
      auditStatus: row["Profile Audit"] || "",
      positioningNotes: row["Positioning Notes"] || "",
      contentRole: row["Content Role"] || "",
      owner: row.Owner || "",
      deadline: normalizeDateValue_(row.Deadline),
      baselineNotes: row["Baseline Metrics Notes"] || "",
    })).filter((row) => row.id),
    reports: reportData,
    settings,
    syncLog: [],
  };
}

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    return [];
  }
  const headers = values[0].map((header) => String(header || ""));
  return values.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index];
    });
    return object;
  });
}

function replaceRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

function appendLog_(sheet, timestamp, action, source, taskCount, contentCount, calendarCount, channelCount, reportCount) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SYNC_HEADERS.length).setValues([SYNC_HEADERS]);
  }
  sheet.appendRow([timestamp, action, source, taskCount, contentCount, calendarCount, channelCount, reportCount]);
}

function formatSheet_(sheet) {
  sheet.setFrozenRows(1);
  if (sheet.getLastColumn() > 0) {
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#1769AA").setFontColor("#FFFFFF");
    sheet.autoResizeColumns(1, Math.max(sheet.getLastColumn(), 1));
  }
}

function normalizeTaskStatus_(value) {
  return value === "Done" || value === "In progress" || value === "Waiting client" || value === "Blocked" ? value : "Not started";
}

function normalizeContentStatus_(value) {
  if (value === "Published" || value === "Scheduled" || value === "Approved") {
    return value;
  }
  if (value === "Sent") {
    return "Sent for approval";
  }
  if (value === "Ready") {
    return "Approved";
  }
  if (value === "Drafting") {
    return "Caption drafting";
  }
  if (value === "In progress") {
    return "Design in progress";
  }
  return "Idea";
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
