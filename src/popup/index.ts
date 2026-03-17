/**
 * Karobar — Popup entry point (vanilla TS, no framework)
 * Requirements: 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.3, 7.4, 7.5
 */

import type {
  ExtensionMessage,
  JobRecord,
  StatusResponse,
  StoredRecord,
  FailedRecord,
  LogJobRecordResponse,
} from "../shared/types";
import { validateChromePattern } from "../shared/patternValidator";

// ---------------------------------------------------------------------------
// Typed message helper
// ---------------------------------------------------------------------------

function sendMsg<T>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: T) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface PopupState {
  isAuthenticated: boolean;
  sheetId: string;
  recentRecords: StoredRecord[];
  failedQueue: FailedRecord[];
  customPatterns: string[];
}

interface AuthUiState {
  pending: boolean;
  tone: "info" | "success" | "error" | null;
  message: string;
}

interface ManualScrapeUiState {
  pending: boolean;
  tone: "info" | "success" | "error" | null;
  message: string;
}

let state: PopupState = {
  isAuthenticated: false,
  sheetId: "",
  recentRecords: [],
  failedQueue: [],
  customPatterns: [],
};

let authUi: AuthUiState = {
  pending: false,
  tone: null,
  message: "",
};

let manualScrapeUi: ManualScrapeUiState = {
  pending: false,
  tone: null,
  message: "",
};

// ---------------------------------------------------------------------------
// AuthStatus section
// ---------------------------------------------------------------------------

function renderAuthStatus(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";
  const buttonLabel = authUi.pending ? "Working..." : state.isAuthenticated ? "Sign Out" : "Sign In";
  const authMessageClass = authUi.tone ? `${authUi.tone}-msg` : "";
  div.innerHTML = `
    <div class="section-title">Account</div>
    <div class="status-row">
      <span id="auth-badge" class="badge ${state.isAuthenticated ? "badge-green" : "badge-red"}">
        ${state.isAuthenticated ? "Signed in" : "Not signed in"}
      </span>
      ${state.isAuthenticated
        ? `<button id="btn-signout" class="btn-danger" ${authUi.pending ? "disabled" : ""}>${buttonLabel}</button>`
        : `<button id="btn-signin" class="btn-primary" ${authUi.pending ? "disabled" : ""}>${buttonLabel}</button>`
      }
    </div>
    ${authUi.message ? `<div class="${authMessageClass}" style="margin-top:8px">${authUi.message}</div>` : ""}
  `;
  container.appendChild(div);

  if (state.isAuthenticated) {
    div.querySelector("#btn-signout")?.addEventListener("click", async () => {
      authUi = { pending: true, tone: "info", message: "Signing out..." };
      render();
      try {
        await sendMsg({ type: "SIGN_OUT" });
        await loadState();
        authUi = { pending: false, tone: "success", message: "Signed out." };
      } catch (err) {
        authUi = {
          pending: false,
          tone: "error",
          message: err instanceof Error ? err.message : "Failed to sign out.",
        };
      }
      render();
    });
  } else {
    div.querySelector("#btn-signin")?.addEventListener("click", async () => {
      authUi = { pending: true, tone: "info", message: "Opening Google sign-in..." };
      render();

      try {
        const res = await sendMsg<{ success: boolean; error?: string }>({ type: "SIGN_IN" });
        if (res.success) {
          await loadState();
          authUi = { pending: false, tone: "success", message: "Signed in." };
        } else {
          authUi = {
            pending: false,
            tone: "error",
            message: res.error ?? "Sign-in failed.",
          };
        }
      } catch (err) {
        authUi = {
          pending: false,
          tone: "error",
          message: err instanceof Error ? err.message : "Sign-in failed.",
        };
      }

      render();
    });
  }
}

// ---------------------------------------------------------------------------
// SheetConfig section
// ---------------------------------------------------------------------------

function renderSheetConfig(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";

  const sheetUrl = state.sheetId
    ? `https://docs.google.com/spreadsheets/d/${state.sheetId}`
    : "";

  div.innerHTML = `
    <div class="section-title">Google Sheet</div>
    <input type="text" id="sheet-input" placeholder="Spreadsheet ID or URL"
      value="${state.sheetId}" />
    <div class="input-row">
      <button id="btn-save-sheet" class="btn-primary">Save</button>
    </div>
    <div id="sheet-msg"></div>
    ${sheetUrl ? `<a class="sheet-link" href="${sheetUrl}" target="_blank">Open sheet ↗</a>` : ""}
  `;
  container.appendChild(div);

  div.querySelector("#btn-save-sheet")?.addEventListener("click", async () => {
    const input = div.querySelector<HTMLInputElement>("#sheet-input");
    const msgEl = div.querySelector<HTMLElement>("#sheet-msg");
    if (!input || !msgEl) return;

    let id = input.value.trim();
    // Accept full URL — extract the ID
    const urlMatch = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) id = urlMatch[1];

    if (!id) {
      msgEl.className = "error-msg";
      msgEl.textContent = "Please enter a spreadsheet ID or URL.";
      return;
    }

    msgEl.className = "";
    msgEl.textContent = "Validating…";

    const res = await sendMsg<{ success: boolean; error?: string }>({
      type: "SAVE_SHEET_CONFIG",
      sheetId: id,
    });

    if (res.success) {
      state.sheetId = id;
      msgEl.className = "success-msg";
      msgEl.textContent = "Sheet saved.";
    } else {
      msgEl.className = "error-msg";
      msgEl.textContent = res.error ?? "Failed to save sheet.";
    }
  });
}

// ---------------------------------------------------------------------------
// Current Page section
// ---------------------------------------------------------------------------

function renderCurrentPageActions(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";
  const messageClass = manualScrapeUi.tone ? `${manualScrapeUi.tone}-msg` : "";

  div.innerHTML = `
    <div class="section-title">Current Page</div>
    <div style="font-size:12px;color:#5f6368;margin-bottom:8px">
      Force a scrape on the active tab even if automatic detection did not trigger.
    </div>
    <button id="btn-scrape-current" class="btn-primary" ${manualScrapeUi.pending ? "disabled" : ""}>
      ${manualScrapeUi.pending ? "Scraping..." : "Scrape Current Page"}
    </button>
    ${manualScrapeUi.message ? `<div class="${messageClass}" style="margin-top:8px">${manualScrapeUi.message}</div>` : ""}
  `;
  container.appendChild(div);

  div.querySelector("#btn-scrape-current")?.addEventListener("click", async () => {
    if (!state.isAuthenticated) {
      manualScrapeUi = {
        pending: false,
        tone: "error",
        message: "Sign in before scraping a page.",
      };
      render();
      return;
    }

    if (!state.sheetId) {
      manualScrapeUi = {
        pending: false,
        tone: "error",
        message: "Save a Google Sheet before scraping a page.",
      };
      render();
      return;
    }

    manualScrapeUi = {
      pending: true,
      tone: "info",
      message: "Scraping the active tab...",
    };
    render();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error("No active tab found.");
      }

      const scrapeResponse = await sendTabMessage<{
        success: boolean;
        record?: JobRecord;
        error?: string;
      }>(tab.id, { type: "SCRAPE_PAGE" });

      if (!scrapeResponse.success || !scrapeResponse.record) {
        throw new Error(scrapeResponse.error ?? "Could not scrape the active tab.");
      }

      const duplicate = await sendMsg<{ isDuplicate: boolean }>({
        type: "CHECK_DUPLICATE",
        url: scrapeResponse.record.jobUrl,
      });
      if (duplicate.isDuplicate) {
        manualScrapeUi = {
          pending: false,
          tone: "info",
          message: "This page URL is already logged.",
        };
        render();
        return;
      }

      const logResult = await sendMsg<LogJobRecordResponse>({
        type: "LOG_JOB_RECORD",
        record: scrapeResponse.record,
      });

      if (!logResult.success) {
        throw new Error(logResult.error ?? "Failed to log the scraped page.");
      }

      await loadState();
      manualScrapeUi = {
        pending: false,
        tone: "success",
        message: "Current page scraped and logged.",
      };
    } catch (err) {
      manualScrapeUi = {
        pending: false,
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to scrape the active tab.",
      };
    }

    render();
  });
}

// ---------------------------------------------------------------------------
// RecentRecords section
// ---------------------------------------------------------------------------

function renderRecentRecords(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";
  div.innerHTML = `<div class="section-title">Recent Applications</div>`;

  if (state.recentRecords.length === 0 && state.failedQueue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-msg";
    empty.textContent = "No recent activity.";
    div.appendChild(empty);
  }

  for (const rec of state.recentRecords) {
    const item = document.createElement("div");
    item.className = "record-item";
    item.innerHTML = `
      <div class="record-title">${rec.jobTitle || "(untitled)"}</div>
      <div class="record-meta">${rec.companyName || ""} · ${rec.dateApplied || ""}</div>
    `;
    div.appendChild(item);
  }

  if (state.failedQueue.length > 0) {
    const failedTitle = document.createElement("div");
    failedTitle.className = "section-title";
    failedTitle.style.marginTop = "8px";
    failedTitle.textContent = "Failed to Log";
    div.appendChild(failedTitle);

    for (const failed of state.failedQueue) {
      const item = document.createElement("div");
      item.className = "failed-item";
      item.innerHTML = `
        <div>
          <div class="record-title">${failed.record.jobTitle || "(untitled)"}</div>
          <div class="record-meta">${failed.record.companyName || ""}</div>
        </div>
        <button class="btn-secondary btn-retry" data-id="${failed.record.id}">Retry</button>
      `;
      div.appendChild(item);
    }

    div.querySelectorAll<HTMLButtonElement>(".btn-retry").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const entry = state.failedQueue.find((f) => f.record.id === id);
        if (!entry) return;
        btn.disabled = true;
        btn.textContent = "…";
        const res = await sendMsg<LogJobRecordResponse>({
          type: "LOG_JOB_RECORD",
          record: entry.record,
        });
        if (res.success) {
          await loadState();
          render();
        } else {
          btn.disabled = false;
          btn.textContent = "Retry";
        }
      });
    });
  }

  container.appendChild(div);
}

// ---------------------------------------------------------------------------
// CustomPatterns section
// ---------------------------------------------------------------------------

function renderCustomPatterns(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";
  div.innerHTML = `
    <div class="section-title">Custom URL Patterns</div>
    <div id="patterns-list"></div>
    <div class="input-row" style="margin-top:8px">
      <input type="text" id="pattern-input" placeholder="https://*.example.com/jobs/*" />
      <button id="btn-add-pattern" class="btn-primary">Add</button>
    </div>
    <div id="pattern-msg"></div>
  `;
  container.appendChild(div);

  const listEl = div.querySelector<HTMLElement>("#patterns-list")!;

  function renderList(): void {
    listEl.innerHTML = "";
    if (state.customPatterns.length === 0) {
      listEl.innerHTML = `<p class="empty-msg">No custom patterns.</p>`;
      return;
    }
    for (const p of state.customPatterns) {
      const item = document.createElement("div");
      item.className = "pattern-item";
      item.innerHTML = `
        <span class="pattern-text" title="${p}">${p}</span>
        <button class="btn-danger btn-remove-pattern" data-pattern="${p}" style="margin-left:8px;padding:2px 8px">✕</button>
      `;
      listEl.appendChild(item);
    }

    listEl.querySelectorAll<HTMLButtonElement>(".btn-remove-pattern").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pattern = btn.dataset.pattern!;
        await sendMsg({ type: "REMOVE_CUSTOM_PATTERN", pattern });
        state.customPatterns = state.customPatterns.filter((p) => p !== pattern);
        renderList();
      });
    });
  }

  renderList();

  div.querySelector("#btn-add-pattern")?.addEventListener("click", async () => {
    const input = div.querySelector<HTMLInputElement>("#pattern-input");
    const msgEl = div.querySelector<HTMLElement>("#pattern-msg");
    if (!input || !msgEl) return;

    const pattern = input.value.trim();
    const validation = validateChromePattern(pattern);

    if (!validation.valid) {
      msgEl.className = "error-msg";
      msgEl.textContent = validation.error ?? "Invalid pattern.";
      return;
    }

    msgEl.textContent = "";
    await sendMsg({ type: "ADD_CUSTOM_PATTERN", pattern });
    if (!state.customPatterns.includes(pattern)) {
      state.customPatterns.push(pattern);
    }
    input.value = "";
    renderList();
  });
}

// ---------------------------------------------------------------------------
// Load state from background
// ---------------------------------------------------------------------------

async function loadState(): Promise<void> {
  const [status, records] = await Promise.all([
    sendMsg<StatusResponse>({ type: "GET_STATUS" }),
    sendMsg<{ recentRecords: StoredRecord[]; failedQueue: FailedRecord[] }>({
      type: "GET_RECENT_RECORDS",
    }),
  ]);

  const syncData = await new Promise<{ customPatterns?: string[] }>((resolve) => {
    chrome.storage.sync.get(["customPatterns"], resolve);
  });

  state = {
    isAuthenticated: status.isAuthenticated,
    sheetId: status.sheetId,
    recentRecords: records.recentRecords ?? [],
    failedQueue: records.failedQueue ?? [],
    customPatterns: syncData.customPatterns ?? [],
  };
}

function sendTabMessage<T>(tabId: number, msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  renderAuthStatus(app);
  renderSheetConfig(app);
  renderCurrentPageActions(app);
  renderRecentRecords(app);
  renderCustomPatterns(app);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

loadState().then(render).catch(console.error);
