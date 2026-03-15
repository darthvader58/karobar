/**
 * Karobar — Popup entry point (vanilla TS, no framework)
 * Requirements: 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.3, 7.4, 7.5
 */

import type {
  ExtensionMessage,
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

let state: PopupState = {
  isAuthenticated: false,
  sheetId: "",
  recentRecords: [],
  failedQueue: [],
  customPatterns: [],
};

// ---------------------------------------------------------------------------
// AuthStatus section
// ---------------------------------------------------------------------------

function renderAuthStatus(container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "section";
  div.innerHTML = `
    <div class="section-title">Account</div>
    <div class="status-row">
      <span id="auth-badge" class="badge ${state.isAuthenticated ? "badge-green" : "badge-red"}">
        ${state.isAuthenticated ? "Signed in" : "Not signed in"}
      </span>
      ${state.isAuthenticated
        ? `<button id="btn-signout" class="btn-danger">Sign Out</button>`
        : `<button id="btn-signin" class="btn-primary">Sign In</button>`
      }
    </div>
  `;
  container.appendChild(div);

  if (state.isAuthenticated) {
    div.querySelector("#btn-signout")?.addEventListener("click", async () => {
      await sendMsg({ type: "SIGN_OUT" });
      await loadState();
      render();
    });
  } else {
    div.querySelector("#btn-signin")?.addEventListener("click", async () => {
      // Trigger interactive auth via GET_STATUS (background will prompt sign-in)
      await sendMsg<StatusResponse>({ type: "GET_STATUS" });
      await loadState();
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

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  renderAuthStatus(app);
  renderSheetConfig(app);
  renderRecentRecords(app);
  renderCustomPatterns(app);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

loadState().then(render).catch(console.error);
