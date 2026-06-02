(function () {
  var databaseKey = "hg-services-ops-database-v2";
  var legacyKey = "hg-services-marketing-launch-database-v1";
  var session = window.HG_SESSION || { username: "unknown", role: "ops" };
  var syncTimer = null;
  var syncPaused = false;
  var taskStatuses = ["Not started", "In progress", "Waiting client", "Blocked", "Done"];
  var priorities = ["High", "Medium", "Low"];
  var contentStatuses = ["Idea", "Asset needed", "Caption drafting", "Design in progress", "Sent for approval", "Approved", "Scheduled", "Published"];
  var channelAccessStatuses = ["Not started", "Requested", "Received", "Blocked"];
  var auditStatuses = ["Not started", "In progress", "Needs fix", "Done"];
  var reportKeys = ["week1", "week2", "week3", "week4", "month1"];
  var database = normalizeDatabase(loadStoredDatabase());

  function byId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function todayString() {
    var now = new Date();
    return now.toISOString().slice(0, 10);
  }

  function addDays(dateString, days) {
    var date = new Date(dateString + "T00:00:00");
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function defaultTasks() {
    return [
      ["task-contact", "Confirm main client contact and approval person", "Onboarding", "Admin", "Admin", "In progress", "High", "2026-06-01", "", "Confirm who signs off captions, visuals, posting dates, and profile changes."],
      ["task-scope", "Confirm approved retainer scope", "Onboarding", "Admin", "Admin", "In progress", "High", "2026-06-01", "", "Confirm FB, IG, XHS, TikTok, content planning, captions, creative direction, asset selection, and reporting."],
      ["task-objective", "Confirm Month 1 objective", "Onboarding", "Admin", "Admin", "In progress", "High", "2026-06-01", "", "Lock foundation, profile clarity, trust-building, consistency, and baseline measurement."],
      ["task-approval-rhythm", "Set weekly approval rhythm", "Onboarding", "Ops", "Ops", "Not started", "High", "2026-06-02", "", "Agree weekly planning, asset collection, content batching, approval, publishing, and performance checks."],
      ["task-facebook-access", "Get Facebook page access", "Channel setup", "Ops", "Ops", "Requested", "High", "2026-06-02", "", "Request admin/editor or Meta Business Suite access."],
      ["task-instagram-access", "Get Instagram access for @hgservicesmy", "Channel setup", "Ops", "Ops", "Requested", "High", "2026-06-02", "", "Confirm login, Meta link, profile edit access, and posting access."],
      ["task-xhs-tiktok", "Confirm XiaoHongShu and TikTok account status", "Channel setup", "Ops", "Ops", "Not started", "Medium", "2026-06-03", "", "Get access if active, or prepare setup and profile positioning."],
      ["task-contact-path", "Confirm WhatsApp and enquiry path", "Channel setup", "Ops", "Ops", "Not started", "High", "2026-06-03", "", "Make preferred enquiry route clear from active social channels."],
      ["task-positioning", "Lock core positioning statement", "Strategy", "Admin", "Admin", "Not started", "High", "2026-06-04", "", "Use reliable contractor support for reinstatement, restoration, handover, and site support works."],
      ["task-assets", "Collect and sort project photos/videos", "Assets", "Ops", "Ops", "Not started", "High", "2026-06-04", "", "Sort by before, progress, after, team/equipment, and service category."],
      ["task-week1-approval", "Submit Week 1 content batch for approval", "Production", "Ops", "Ops", "Not started", "High", "2026-06-05", "", "Send posting date, platform, visual, caption, CTA, and notes needed from HG."],
      ["task-report", "Create Month 1 baseline report", "Reporting", "Admin", "Admin", "Not started", "Medium", "2026-06-29", "", "Include output, reach, engagement, saves, shares, profile visits, WhatsApp clicks, DMs, and enquiry quality."]
    ].map(function (row) {
      return {
        id: row[0],
        title: row[1],
        category: row[2],
        owner: row[3],
        role: row[4],
        status: row[5],
        priority: row[6],
        deadline: row[7],
        blocker: row[8],
        nextAction: row[9],
        notes: ""
      };
    });
  }

  function defaultChannels() {
    return [
      ["facebook", "Facebook", "Requested", "Not started", "Use for service clarity, enquiry support, project proof, and slightly longer explanations.", "Education, before/after proof, project albums, enquiry CTA.", "Ops", "2026-06-02", ""],
      ["instagram", "Instagram", "Requested", "Not started", "Use as the strongest visual proof channel for reels, carousels, stories, highlights, and pinned posts.", "Site progress, team/equipment proof, before/after, stories, profile trust.", "Ops", "2026-06-02", ""],
      ["xiaohongshu", "XiaoHongShu", "Not started", "Not started", "Use for searchable property-owner education, checklist notes, handover tips, and practical reinstatement explainers.", "One weekly note repurposed from strongest proof or education content.", "Ops", "2026-06-03", ""],
      ["tiktok", "TikTok", "Not started", "Not started", "Use for setup/readiness and repurposed short-form site clips; not a separate Month 1 KPI unless confirmed later.", "Short site proof, process snippets, before/after transitions, team/equipment clips.", "Ops", "2026-06-03", ""]
    ].map(function (row) {
      return {
        id: row[0],
        channel: row[1],
        accessStatus: row[2],
        auditStatus: row[3],
        positioningNotes: row[4],
        contentRole: row[5],
        owner: row[6],
        deadline: row[7],
        baselineNotes: row[8]
      };
    });
  }

  function defaultContentItems() {
    var rows = [
      ["content-01", "Week 1", "Facebook / Instagram", "Proof of Work", "Before/after reinstatement or restoration project proof", "Before, work-in-progress, and after photos", "Asset needed", "Ops", "2026-06-08", ""],
      ["content-02", "Week 1", "Facebook / Instagram", "Education & Compliance", "Office move-out reinstatement checklist", "Checklist template and simple project visuals", "Caption drafting", "Ops", "2026-06-09", ""],
      ["content-03", "Week 1", "Instagram / TikTok", "Reliability & Capability", "Team, rorobin, lorry, scaffold, or process proof", "Short site clips and team/equipment photos", "Idea", "Ops", "2026-06-10", ""],
      ["content-04", "Week 1", "XiaoHongShu", "Education & Compliance", "Checklist note repurposed from strongest Week 1 education content", "Cover image plus 3-5 supporting visuals", "Idea", "Ops", "2026-06-11", ""],
      ["content-05", "Week 2", "Instagram / TikTok", "Proof of Work", "Site progress reel: dismantling, hacking, debris handling, or protection", "Short vertical clips from active worksite", "Idea", "Ops", "2026-06-15", ""],
      ["content-06", "Week 2", "Facebook / Instagram", "Education & Compliance", "Common reinstatement or handover mistake explainer", "Simple visual explainer and relevant site image", "Idea", "Ops", "2026-06-16", ""],
      ["content-07", "Week 2", "Facebook / Instagram", "Proof of Work", "Completed office or residential project post", "Completed project photos and scope notes", "Idea", "Ops", "2026-06-17", ""],
      ["content-08", "Week 2", "XiaoHongShu", "Education & Compliance", "Common mistakes before property handover", "Cover image, checklist graphic, relevant proof photos", "Idea", "Ops", "2026-06-18", ""],
      ["content-09", "Week 3", "Facebook / Instagram", "Proof of Work", "Residential restoration proof", "Residential before/after and scope notes", "Idea", "Ops", "2026-06-22", ""],
      ["content-10", "Week 3", "Facebook / Instagram", "Trust & Authority", "HG experience, 100+ malls, and in-house team proof", "Company proof, team proof, website references", "Idea", "Ops", "2026-06-23", ""],
      ["content-11", "Week 3", "Instagram / TikTok", "Reliability & Capability", "Equipment, rorobin, lorry, scaffold, or site coordination proof", "Equipment and operations photos/clips", "Idea", "Ops", "2026-06-24", ""],
      ["content-12", "Week 3", "XiaoHongShu", "Education & Compliance", "Residential restoration or handover guide", "Cover image plus simple guide visuals", "Idea", "Ops", "2026-06-25", ""],
      ["content-13", "Week 4", "Facebook / Instagram", "Trust & Authority", "Project highlight or mini case study", "Project scope, problem, process, result, proof photos", "Idea", "Ops", "2026-06-29", ""],
      ["content-14", "Week 4", "Facebook / Instagram", "Education & Compliance", "FAQ or preparation tip before requesting quotation", "FAQ template and supporting service visuals", "Idea", "Ops", "2026-06-30", ""],
      ["content-15", "Week 4", "Facebook / Instagram", "Trust & Authority", "Trust proof: experience, credentials, project ecosystem", "Company proof, team proof, project proof, service references", "Idea", "Ops", "2026-06-30", ""],
      ["content-16", "Week 4", "XiaoHongShu", "Proof of Work", "Project note or before/after case proof", "Cover image, project sequence, educational title", "Idea", "Ops", "2026-06-30", ""]
    ];
    return rows.map(function (row) {
      return {
        id: row[0],
        week: row[1],
        platform: row[2],
        pillar: row[3],
        topic: row[4],
        assetNeeded: row[5],
        status: row[6],
        owner: row[7],
        publishDate: row[8],
        notes: row[9]
      };
    });
  }

  function defaultCalendarEntries() {
    var defaults = {
      "2026-06-01": "Client kickoff / onboarding",
      "2026-06-02": "Access + channel setup",
      "2026-06-03": "Profile audit + contact path check",
      "2026-06-04": "Collect site photos/videos",
      "2026-06-05": "Week 1 content approval",
      "2026-06-08": "Publish / schedule Week 1 posts",
      "2026-06-10": "Prepare Week 2 content batch",
      "2026-06-12": "Week 2 content approval",
      "2026-06-15": "Publish / schedule Week 2 posts",
      "2026-06-17": "Prepare Week 3 content batch",
      "2026-06-19": "Week 3 content approval",
      "2026-06-22": "Publish / schedule Week 3 posts",
      "2026-06-24": "Prepare Week 4 content batch",
      "2026-06-26": "Week 4 content approval",
      "2026-06-29": "Compile Month 1 baseline report",
      "2026-06-30": "Review Month 1 + recommend Month 2"
    };
    var entries = {};
    for (var day = 1; day <= 30; day += 1) {
      var date = "2026-06-" + String(day).padStart(2, "0");
      entries[date] = {
        date: date,
        notes: defaults[date] || "",
        owner: "",
        type: ""
      };
    }
    return entries;
  }

  function defaultReports() {
    return {
      week1: { label: "Week 1", output: "", kpis: "", learnings: "", nextActions: "" },
      week2: { label: "Week 2", output: "", kpis: "", learnings: "", nextActions: "" },
      week3: { label: "Week 3", output: "", kpis: "", learnings: "", nextActions: "" },
      week4: { label: "Week 4", output: "", kpis: "", learnings: "", nextActions: "" },
      month1: { label: "Month 1", output: "", kpis: "", learnings: "", nextActions: "Recommend Month 2 direction based on early content winners." }
    };
  }

  function emptyDatabase() {
    return {
      version: 2,
      updatedAt: "",
      tasks: defaultTasks(),
      contentItems: defaultContentItems(),
      calendarEntries: defaultCalendarEntries(),
      channels: defaultChannels(),
      reports: defaultReports(),
      settings: {
        client: "HG Services",
        month: "June 2026",
        focus: "Office/residential reinstatement and restoration"
      },
      syncLog: []
    };
  }

  function loadStoredDatabase() {
    try {
      var saved = window.localStorage.getItem(databaseKey);
      if (saved) {
        return JSON.parse(saved);
      }
      var legacy = window.localStorage.getItem(legacyKey);
      if (legacy) {
        return migrateLegacyDatabase(JSON.parse(legacy));
      }
    } catch (error) {
      setSyncStatus("Local database could not be loaded. Starting with defaults.", true);
    }
    return emptyDatabase();
  }

  function migrateLegacyDatabase(legacy) {
    var next = emptyDatabase();
    if (legacy.checklists) {
      next.tasks = Object.keys(legacy.checklists).sort().map(function (id) {
        var item = legacy.checklists[id] || {};
        return {
          id: id,
          title: item.title || id,
          category: item.section || "Onboarding",
          owner: "Ops",
          role: "Ops",
          status: item.done ? "Done" : normalizeTaskStatus(item.status),
          priority: "Medium",
          deadline: item.deadline || "",
          blocker: item.status === "Blocked" ? item.fix || "" : "",
          nextAction: item.fix || "",
          notes: item.answer || ""
        };
      });
    }
    if (legacy.contentPlan) {
      next.contentItems = Object.keys(legacy.contentPlan).sort().map(function (id) {
        var item = legacy.contentPlan[id] || {};
        return {
          id: id,
          week: item.week || "",
          platform: item.platform || "",
          pillar: item.pillar || "",
          topic: item.topic || "",
          assetNeeded: item.assetNeeded || "",
          status: normalizeContentStatus(item.approvalStatus || item.designStatus || item.captionStatus),
          owner: "Ops",
          publishDate: item.publishDate || "",
          notes: item.notes || ""
        };
      });
    }
    if (legacy.calendar) {
      next.calendarEntries = defaultCalendarEntries();
      Object.keys(legacy.calendar).forEach(function (date) {
        next.calendarEntries[date] = {
          date: date,
          notes: legacy.calendar[date] || "",
          owner: "",
          type: ""
        };
      });
    }
    if (legacy.channels) {
      next.channels = Object.keys(legacy.channels).sort().map(function (id) {
        var item = legacy.channels[id] || {};
        return {
          id: id,
          channel: item.channel || id,
          accessStatus: item.accessStatus || "Not started",
          auditStatus: item.auditStatus || "Not started",
          positioningNotes: item.positioningNotes || "",
          contentRole: item.contentRole || "",
          owner: item.owner || "Ops",
          deadline: item.deadline || "",
          baselineNotes: item.baselineNotes || ""
        };
      });
    }
    return next;
  }

  function normalizeTaskStatus(value) {
    return taskStatuses.indexOf(value) >= 0 ? value : value === "Needs fix" ? "Blocked" : "Not started";
  }

  function normalizeContentStatus(value) {
    if (contentStatuses.indexOf(value) >= 0) {
      return value;
    }
    if (value === "Published") {
      return "Published";
    }
    if (value === "Scheduled") {
      return "Scheduled";
    }
    if (value === "Approved") {
      return "Approved";
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

  function normalizeDatabase(value) {
    var defaults = emptyDatabase();
    var normalized = value && typeof value === "object" ? value : defaults;
    normalized.version = 2;
    normalized.updatedAt = normalized.updatedAt || "";
    normalized.tasks = Array.isArray(normalized.tasks) ? normalized.tasks : defaults.tasks;
    normalized.contentItems = Array.isArray(normalized.contentItems) ? normalized.contentItems : defaults.contentItems;
    normalized.channels = Array.isArray(normalized.channels) ? normalized.channels : defaults.channels;
    normalized.calendarEntries = normalized.calendarEntries && typeof normalized.calendarEntries === "object" ? normalized.calendarEntries : defaults.calendarEntries;
    normalized.reports = normalized.reports && typeof normalized.reports === "object" ? normalized.reports : defaults.reports;
    normalized.settings = normalized.settings && typeof normalized.settings === "object" ? normalized.settings : defaults.settings;
    normalized.syncLog = Array.isArray(normalized.syncLog) ? normalized.syncLog : [];

    reportKeys.forEach(function (key) {
      normalized.reports[key] = Object.assign({}, defaults.reports[key], normalized.reports[key] || {});
    });

    Object.keys(defaults.calendarEntries).forEach(function (date) {
      normalized.calendarEntries[date] = Object.assign({}, defaults.calendarEntries[date], normalized.calendarEntries[date] || {});
    });

    return normalized;
  }

  function saveLocal(message) {
    database.updatedAt = new Date().toISOString();
    window.localStorage.setItem(databaseKey, JSON.stringify(database));
    setSyncStatus(message || "Saved locally. Sheet autosave queued.");
  }

  function markChanged(message, rerender) {
    saveLocal(message);
    scheduleSheetSave();
    if (rerender) {
      renderAll();
    } else {
      renderDashboard();
    }
  }

  function setSyncStatus(message, warning) {
    var status = document.querySelector("[data-sync-status]");
    if (status) {
      status.textContent = message;
      status.className = warning ? "warning-note" : "";
    }
  }

  function requireAdminAction() {
    if (session.role === "admin") {
      return true;
    }
    setSyncStatus("Admin role required for this action.", true);
    return false;
  }

  function scheduleSheetSave() {
    if (syncPaused) {
      return;
    }
    window.clearTimeout(syncTimer);
    setSyncStatus("Saved locally. Autosave to Sheet queued.");
    syncTimer = window.setTimeout(function () {
      pushToSheet(false);
    }, 1800);
  }

  function pushToSheet(manual) {
    if (manual) {
      syncPaused = false;
    }
    setSyncStatus("Saving to Google Sheet...");
    return fetch("/api/sheet/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "HG Services ops tool",
        database: database
      })
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () {
          return { error: "Google Sheet sync failed." };
        }).then(function (body) {
          throw new Error(body.error || "Google Sheet sync failed.");
        });
      }
      return response.json().catch(function () {
        return { ok: true };
      });
    }).then(function () {
      database.syncLog.unshift({ timestamp: new Date().toISOString(), action: "push", source: "admin", role: session.role });
      database.syncLog = database.syncLog.slice(0, 25);
      saveLocal("Saved locally and synced to Google Sheet.");
    }).catch(function (error) {
      if (String(error.message).indexOf("APPS_SCRIPT_URL") >= 0) {
        syncPaused = true;
        setSyncStatus("Sheet sync not configured. Local autosave is active; add APPS_SCRIPT_URL in Vercel.", true);
      } else {
        setSyncStatus("Sync failed: " + error.message, true);
      }
    });
  }

  function pullFromSheet() {
    setSyncStatus("Pulling latest Google Sheet data...");
    fetch("/api/sheet/pull").then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () {
          return { error: "Google Sheet pull failed." };
        }).then(function (body) {
          throw new Error(body.error || "Google Sheet pull failed.");
        });
      }
      return response.json();
    }).then(function (response) {
      if (response && response.ok && response.database) {
        database = normalizeDatabase(response.database);
        database.syncLog.unshift({ timestamp: new Date().toISOString(), action: "pull", source: "admin", role: session.role });
        saveLocal("Pulled latest data from Google Sheet.");
        renderAll();
      } else {
        setSyncStatus("Google Sheet response did not include ops data.", true);
      }
    }).catch(function (error) {
      setSyncStatus("Pull failed: " + error.message, true);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function options(list, selected) {
    return list.map(function (value) {
      return "<option" + (value === selected ? " selected" : "") + ">" + escapeHtml(value) + "</option>";
    }).join("");
  }

  function input(attrs, value) {
    return "<input " + attrs + " value=\"" + escapeHtml(value || "") + "\">";
  }

  function textarea(attrs, value) {
    return "<textarea " + attrs + ">" + escapeHtml(value || "") + "</textarea>";
  }

  function select(attrs, values, selected) {
    return "<select " + attrs + ">" + options(values, selected) + "</select>";
  }

  function findTask(id) {
    return database.tasks.find(function (task) { return task.id === id; });
  }

  function findContent(id) {
    return database.contentItems.find(function (item) { return item.id === id; });
  }

  function findChannel(id) {
    return database.channels.find(function (item) { return item.id === id; });
  }

  function isOnboardingTask(task) {
    var category = String(task.category || "").toLowerCase();
    return ["onboarding", "setup", "access", "channel", "profile", "positioning", "asset", "audit", "strategy"].some(function (keyword) {
      return category.indexOf(keyword) >= 0;
    });
  }

  function visibleView() {
    var path = window.location.pathname.replace(/\/$/, "");
    var view = path.split("/").pop() || "dashboard";
    if (view === "admin") {
      return "dashboard";
    }
    if (["dashboard", "onboarding", "tasks", "content", "calendar", "reports"].indexOf(view) === -1) {
      return "dashboard";
    }
    return view;
  }

  function setActiveView() {
    var view = visibleView();
    document.querySelectorAll("[data-view]").forEach(function (section) {
      section.classList.toggle("active", section.dataset.view === view);
    });
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      link.classList.toggle("active", link.dataset.nav === view || (view === "dashboard" && link.dataset.nav === "dashboard"));
    });
  }

  function renderDashboard() {
    var today = todayString();
    var weekEnd = addDays(today, 7);
    var dueTasks = database.tasks.filter(function (task) {
      return task.deadline && task.deadline >= today && task.deadline <= weekEnd && task.status !== "Done";
    });
    var dueContent = database.contentItems.filter(function (item) {
      return item.publishDate && item.publishDate >= today && item.publishDate <= weekEnd && item.status !== "Published";
    });
    var blocked = database.tasks.filter(function (task) {
      return task.status === "Blocked" || task.status === "Waiting client";
    });
    var approvals = database.contentItems.filter(function (item) {
      return item.status === "Sent for approval";
    });
    var scheduled = database.contentItems.filter(function (item) {
      return item.status === "Scheduled" || item.status === "Published";
    });

    document.querySelector("[data-dashboard-metrics]").innerHTML = [
      ["Due this week", dueTasks.length + dueContent.length],
      ["Blocked / waiting", blocked.length],
      ["Awaiting approval", approvals.length],
      ["Scheduled / published", scheduled.length],
      ["Sheet sync", syncPaused ? "Paused" : "Active"]
    ].map(function (metric) {
      return "<div class=\"card metric\"><strong>" + escapeHtml(metric[1]) + "</strong><span>" + escapeHtml(metric[0]) + "</span></div>";
    }).join("");

    document.querySelector("[data-due-soon]").innerHTML = dueTasks.map(function (task) {
      return "<tr><td>Task</td><td>" + escapeHtml(task.title) + "</td><td>" + escapeHtml(task.owner) + "</td><td>" + escapeHtml(task.status) + "</td><td>" + escapeHtml(task.deadline) + "</td></tr>";
    }).concat(dueContent.map(function (item) {
      return "<tr><td>Content</td><td>" + escapeHtml(item.topic) + "</td><td>" + escapeHtml(item.owner) + "</td><td>" + escapeHtml(item.status) + "</td><td>" + escapeHtml(item.publishDate) + "</td></tr>";
    })).join("") || "<tr><td colspan=\"5\">No urgent deadlines found.</td></tr>";

    document.querySelector("[data-blockers]").innerHTML = blocked.map(function (task) {
      return "<tr><td>Task</td><td>" + escapeHtml(task.title) + "</td><td>" + escapeHtml(task.owner) + "</td><td>" + escapeHtml(task.status) + "</td><td>" + escapeHtml(task.nextAction || task.blocker) + "</td></tr>";
    }).concat(approvals.map(function (item) {
      return "<tr><td>Content</td><td>" + escapeHtml(item.topic) + "</td><td>" + escapeHtml(item.owner) + "</td><td>" + escapeHtml(item.status) + "</td><td>Follow up approval.</td></tr>";
    })).join("") || "<tr><td colspan=\"5\">No blockers or pending approvals.</td></tr>";
  }

  function taskRow(task, compact) {
    var prefix = "data-task-id=\"" + escapeHtml(task.id) + "\"";
    if (compact) {
      return "<tr>" +
        "<td>" + input(prefix + " data-task-field=\"title\"", task.title) + "</td>" +
        "<td>" + input(prefix + " data-task-field=\"owner\"", task.owner) + "</td>" +
        "<td>" + select(prefix + " data-task-field=\"status\"", taskStatuses, task.status) + "</td>" +
        "<td>" + select(prefix + " data-task-field=\"priority\"", priorities, task.priority) + "</td>" +
        "<td>" + input(prefix + " data-task-field=\"deadline\" type=\"date\"", task.deadline) + "</td>" +
        "<td>" + textarea(prefix + " data-task-field=\"notes\"", task.notes) + "</td>" +
        "<td>" + textarea(prefix + " data-task-field=\"nextAction\"", task.nextAction) + "</td>" +
        "</tr>";
    }
    return "<tr>" +
      "<td>" + input(prefix + " data-task-field=\"title\"", task.title) + "</td>" +
      "<td>" + input(prefix + " data-task-field=\"category\"", task.category) + "</td>" +
      "<td>" + input(prefix + " data-task-field=\"owner\"", task.owner) + "</td>" +
      "<td>" + input(prefix + " data-task-field=\"role\"", task.role) + "</td>" +
      "<td>" + select(prefix + " data-task-field=\"status\"", taskStatuses, task.status) + "</td>" +
      "<td>" + select(prefix + " data-task-field=\"priority\"", priorities, task.priority) + "</td>" +
      "<td>" + input(prefix + " data-task-field=\"deadline\" type=\"date\"", task.deadline) + "</td>" +
      "<td>" + textarea(prefix + " data-task-field=\"blocker\"", task.blocker) + "</td>" +
      "<td>" + textarea(prefix + " data-task-field=\"nextAction\"", task.nextAction) + "</td>" +
      "</tr>";
  }

  function renderTasks() {
    document.querySelector("[data-onboarding-table]").innerHTML = database.tasks.filter(function (task) {
      return isOnboardingTask(task);
    }).map(function (task) {
      return taskRow(task, true);
    }).join("");

    document.querySelector("[data-task-table]").innerHTML = database.tasks.map(function (task) {
      return taskRow(task, false);
    }).join("");
  }

  function renderChannels() {
    document.querySelector("[data-channel-table]").innerHTML = database.channels.map(function (channel) {
      var prefix = "data-channel-id=\"" + escapeHtml(channel.id) + "\"";
      return "<tr>" +
        "<td>" + escapeHtml(channel.channel) + "</td>" +
        "<td>" + select(prefix + " data-channel-field=\"accessStatus\"", channelAccessStatuses, channel.accessStatus) + "</td>" +
        "<td>" + select(prefix + " data-channel-field=\"auditStatus\"", auditStatuses, channel.auditStatus) + "</td>" +
        "<td>" + textarea(prefix + " data-channel-field=\"positioningNotes\"", channel.positioningNotes) + "</td>" +
        "<td>" + textarea(prefix + " data-channel-field=\"contentRole\"", channel.contentRole) + "</td>" +
        "<td>" + input(prefix + " data-channel-field=\"owner\"", channel.owner) + "</td>" +
        "<td>" + input(prefix + " data-channel-field=\"deadline\" type=\"date\"", channel.deadline) + "</td>" +
        "<td>" + textarea(prefix + " data-channel-field=\"baselineNotes\"", channel.baselineNotes) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderContent() {
    document.querySelector("[data-content-table]").innerHTML = database.contentItems.map(function (item) {
      var prefix = "data-content-id=\"" + escapeHtml(item.id) + "\"";
      return "<tr>" +
        "<td>" + input(prefix + " data-content-field=\"week\"", item.week) + "</td>" +
        "<td>" + input(prefix + " data-content-field=\"platform\"", item.platform) + "</td>" +
        "<td>" + input(prefix + " data-content-field=\"pillar\"", item.pillar) + "</td>" +
        "<td>" + textarea(prefix + " data-content-field=\"topic\"", item.topic) + "</td>" +
        "<td>" + textarea(prefix + " data-content-field=\"assetNeeded\"", item.assetNeeded) + "</td>" +
        "<td>" + select(prefix + " data-content-field=\"status\"", contentStatuses, item.status) + "</td>" +
        "<td>" + input(prefix + " data-content-field=\"owner\"", item.owner) + "</td>" +
        "<td>" + input(prefix + " data-content-field=\"publishDate\" type=\"date\"", item.publishDate) + "</td>" +
        "<td>" + textarea(prefix + " data-content-field=\"notes\"", item.notes) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderCalendar() {
    var weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var html = weekdays.map(function (day) {
      return "<div class=\"weekday\">" + day + "</div>";
    }).join("");

    for (var day = 1; day <= 30; day += 1) {
      var date = "2026-06-" + String(day).padStart(2, "0");
      var entry = database.calendarEntries[date] || { date: date, notes: "", owner: "", type: "" };
      var dueTasks = database.tasks.filter(function (task) { return task.deadline === date; });
      var dueContent = database.contentItems.filter(function (item) { return item.publishDate === date; });
      html += "<div class=\"day\">" +
        "<div class=\"day-number\">" + day + "<span>" + (day === 1 ? "Week 1" : day === 8 ? "Week 2" : day === 15 ? "Week 3" : day === 22 ? "Week 4" : day === 29 ? "Report" : "") + "</span></div>" +
        textarea("data-calendar-date=\"" + date + "\" data-calendar-field=\"notes\"", entry.notes) +
        "<ul class=\"day-list\">" +
        dueTasks.map(function (task) { return "<li>Task: " + escapeHtml(task.title) + "</li>"; }).join("") +
        dueContent.map(function (item) { return "<li>Content: " + escapeHtml(item.topic) + "</li>"; }).join("") +
        "</ul>" +
        input("data-calendar-date=\"" + date + "\" data-calendar-field=\"owner\" placeholder=\"Owner\"", entry.owner) +
        "</div>";
    }

    for (var extra = 0; extra < 5; extra += 1) {
      html += "<div class=\"day empty\"></div>";
    }

    document.querySelector("[data-calendar-grid]").innerHTML = html;
  }

  function renderReports() {
    document.querySelector("[data-report-grid]").innerHTML = reportKeys.map(function (key) {
      var report = database.reports[key];
      var prefix = "data-report-key=\"" + key + "\"";
      return "<div class=\"card\">" +
        "<h3>" + escapeHtml(report.label) + "</h3>" +
        "<label>Output</label>" + textarea(prefix + " data-report-field=\"output\"", report.output) +
        "<label>KPI notes</label>" + textarea(prefix + " data-report-field=\"kpis\"", report.kpis) +
        "<label>Learnings</label>" + textarea(prefix + " data-report-field=\"learnings\"", report.learnings) +
        "<label>Next actions</label>" + textarea(prefix + " data-report-field=\"nextActions\"", report.nextActions) +
        "</div>";
    }).join("");
  }

  function renderRole() {
    document.querySelector("[data-session-label]").textContent = session.username;
    document.querySelector("[data-session-role]").textContent = session.role === "admin" ? "Admin role" : "Ops role";
    document.querySelectorAll(".admin-only").forEach(function (node) {
      node.classList.toggle("hidden", session.role !== "admin");
      node.setAttribute("aria-hidden", session.role !== "admin" ? "true" : "false");
      node.querySelectorAll("button, input, select, textarea").forEach(function (control) {
        control.disabled = session.role !== "admin";
      });
    });
  }

  function renderAll() {
    setActiveView();
    renderRole();
    renderDashboard();
    renderTasks();
    renderChannels();
    renderContent();
    renderCalendar();
    renderReports();
  }

  function updateField(target) {
    if (target.dataset.taskId) {
      var task = findTask(target.dataset.taskId);
      if (task) {
        task[target.dataset.taskField] = target.value;
        markChanged("Task saved locally. Sheet autosave queued.");
      }
    } else if (target.dataset.contentId) {
      var content = findContent(target.dataset.contentId);
      if (content) {
        content[target.dataset.contentField] = target.value;
        markChanged("Content item saved locally. Sheet autosave queued.");
      }
    } else if (target.dataset.channelId) {
      var channel = findChannel(target.dataset.channelId);
      if (channel) {
        channel[target.dataset.channelField] = target.value;
        markChanged("Channel setup saved locally. Sheet autosave queued.");
      }
    } else if (target.dataset.calendarDate) {
      var date = target.dataset.calendarDate;
      database.calendarEntries[date] = database.calendarEntries[date] || { date: date, notes: "", owner: "", type: "" };
      database.calendarEntries[date][target.dataset.calendarField] = target.value;
      markChanged("Calendar saved locally. Sheet autosave queued.");
    } else if (target.dataset.reportKey) {
      database.reports[target.dataset.reportKey][target.dataset.reportField] = target.value;
      markChanged("Report saved locally. Sheet autosave queued.");
    }
  }

  document.addEventListener("input", function (event) {
    if (event.target.matches("[data-task-field], [data-content-field], [data-channel-field], [data-calendar-field], [data-report-field]")) {
      updateField(event.target);
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.matches("[data-task-field], [data-content-field], [data-channel-field], [data-calendar-field], [data-report-field]")) {
      updateField(event.target);
    }
  });

  document.querySelector("[data-add-task]").addEventListener("click", function () {
    database.tasks.unshift({
      id: byId("task"),
      title: "New task",
      category: "Ops",
      owner: "Ops",
      role: "Ops",
      status: "Not started",
      priority: "Medium",
      deadline: "",
      blocker: "",
      nextAction: "",
      notes: ""
    });
    markChanged("Task added.", true);
  });

  document.querySelector("[data-add-content]").addEventListener("click", function () {
    database.contentItems.unshift({
      id: byId("content"),
      week: "Week 1",
      platform: "Facebook / Instagram",
      pillar: "Proof of Work",
      topic: "New content item",
      assetNeeded: "",
      status: "Idea",
      owner: "Ops",
      publishDate: "",
      notes: ""
    });
    markChanged("Content item added.", true);
  });

  document.querySelector("[data-pull-sheet]").addEventListener("click", pullFromSheet);
  document.querySelector("[data-push-sheet]").addEventListener("click", function () {
    if (requireAdminAction()) {
      pushToSheet(true);
    }
  });
  document.querySelector("[data-logout]").addEventListener("click", function () {
    fetch("/api/logout", { method: "POST" }).finally(function () {
      window.location.href = "/login";
    });
  });

  document.querySelector("[data-export-database]").addEventListener("click", function () {
    if (!requireAdminAction()) {
      return;
    }
    var blob = new Blob([JSON.stringify(database, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "hg-services-ops-database.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  document.querySelector("[data-import-database-button]").addEventListener("click", function () {
    if (!requireAdminAction()) {
      return;
    }
    var box = document.querySelector("[data-import-database]");
    try {
      database = normalizeDatabase(JSON.parse(box.value));
      box.value = "";
      markChanged("Database imported.", true);
    } catch (error) {
      setSyncStatus("Import failed. Paste valid JSON.", true);
    }
  });

  document.querySelector("[data-clear-database]").addEventListener("click", function () {
    if (!requireAdminAction()) {
      return;
    }
    if (!window.confirm("Clear the local ops database in this browser?")) {
      return;
    }
    database = emptyDatabase();
    saveLocal("Database reset locally.");
    renderAll();
  });

  window.addEventListener("popstate", renderAll);
  saveLocal("Database ready. Local autosave active; Sheet sync starts after edits.");
  renderAll();
})();
