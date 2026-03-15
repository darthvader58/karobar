import { DetectionResult } from "../../shared/types";

// ─── Inlined static assets ───────────────────────────────────────────────────

const PROMPT_CSS = `
#karobar-prompt {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
  width: 320px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  padding: 16px;
  box-sizing: border-box;

  /* Start hidden, off-screen to the right */
  display: none;
  opacity: 0;
  transform: translateX(calc(100% + 32px));
  transition: opacity 0.25s ease, transform 0.25s ease;
}

#karobar-prompt.karobar-visible {
  display: block;
  opacity: 1;
  transform: translateX(0);
}

/* Header */
.karobar-header {
  margin-bottom: 10px;
}

.karobar-logo {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #16a34a;
}

/* Body */
.karobar-body {
  margin-bottom: 14px;
}

.karobar-job-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.karobar-job-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.karobar-company-name {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Duplicate warning */
.karobar-duplicate-warning {
  margin-top: 8px;
  font-size: 12px;
  color: #d97706;
  font-weight: 500;
}

.karobar-hidden {
  display: none;
}

/* Actions */
.karobar-actions {
  display: flex;
  gap: 8px;
}

.karobar-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  line-height: 1;
}

.karobar-btn-primary {
  background-color: #16a34a;
  color: #ffffff;
  border: 1.5px solid #16a34a;
}

.karobar-btn-primary:hover {
  background-color: #15803d;
  border-color: #15803d;
}

.karobar-btn-secondary {
  background-color: transparent;
  color: #374151;
  border: 1.5px solid #d1d5db;
}

.karobar-btn-secondary:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}
`;

const PROMPT_HTML = `
<div id="karobar-prompt">
  <div class="karobar-header">
    <span class="karobar-logo">Karobar</span>
  </div>
  <div class="karobar-body">
    <div class="karobar-job-info">
      <span id="karobar-job-title" class="karobar-job-title"></span>
      <span id="karobar-company-name" class="karobar-company-name"></span>
    </div>
    <div id="karobar-duplicate-warning" class="karobar-duplicate-warning karobar-hidden">Already tracked</div>
  </div>
  <div class="karobar-actions">
    <button id="karobar-add-btn" class="karobar-btn karobar-btn-primary">Add to Sheet</button>
    <button id="karobar-dismiss-btn" class="karobar-btn karobar-btn-secondary">Dismiss</button>
  </div>
</div>
`;

// ─── Module-level state ───────────────────────────────────────────────────────

let promptContainer: HTMLDivElement | null = null;
let isVisible = false;

// ─── Private helpers ──────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("karobar-styles")) return;
  const style = document.createElement("style");
  style.id = "karobar-styles";
  style.textContent = PROMPT_CSS;
  document.head.appendChild(style);
}

function createPromptElement(): HTMLDivElement {
  const div = document.createElement("div");
  div.innerHTML = PROMPT_HTML;
  return div;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function showPrompt(preview: DetectionResult, isDuplicate: boolean): void {
  try {
    injectStyles();

    if (promptContainer === null) {
      promptContainer = createPromptElement();
      document.body.appendChild(promptContainer);
    }

    // Populate content
    const titleEl = promptContainer.querySelector<HTMLElement>("#karobar-job-title");
    const companyEl = promptContainer.querySelector<HTMLElement>("#karobar-company-name");
    const warningEl = promptContainer.querySelector<HTMLElement>("#karobar-duplicate-warning");

    if (titleEl) {
      titleEl.textContent = preview.previewTitle || "Job Application Detected";
    }
    if (companyEl) {
      companyEl.textContent = preview.previewCompany || "";
    }
    if (warningEl) {
      if (isDuplicate) {
        warningEl.classList.remove("karobar-hidden");
      } else {
        warningEl.classList.add("karobar-hidden");
      }
    }

    // Rebind button handlers by cloning (removes old listeners)
    const addBtn = promptContainer.querySelector<HTMLElement>("#karobar-add-btn");
    const dismissBtn = promptContainer.querySelector<HTMLElement>("#karobar-dismiss-btn");

    if (addBtn) {
      const freshAdd = addBtn.cloneNode(true) as HTMLElement;
      freshAdd.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("karobar:confirmed"));
        chrome.runtime.sendMessage({ type: "USER_CONFIRMED" });
        dismissPrompt();
      });
      addBtn.parentNode?.replaceChild(freshAdd, addBtn);
    }

    if (dismissBtn) {
      const freshDismiss = dismissBtn.cloneNode(true) as HTMLElement;
      freshDismiss.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("karobar:dismissed"));
        chrome.runtime.sendMessage({ type: "USER_DISMISSED" });
        dismissPrompt();
      });
      dismissBtn.parentNode?.replaceChild(freshDismiss, dismissBtn);
    }

    // Show the prompt with CSS transition
    const promptEl = promptContainer.querySelector<HTMLElement>("#karobar-prompt");
    if (promptEl) {
      promptEl.style.display = "block";
      requestAnimationFrame(() => {
        promptEl.classList.add("karobar-visible");
      });
    }

    isVisible = true;
  } catch (err) {
    console.error("[Karobar] showPrompt error:", err);
  }
}

export function dismissPrompt(): void {
  try {
    if (promptContainer === null || !isVisible) return;

    const promptEl = promptContainer.querySelector<HTMLElement>("#karobar-prompt");
    if (!promptEl) return;

    promptEl.classList.remove("karobar-visible");

    // Hide after transition completes
    const onTransitionEnd = () => {
      promptEl.style.display = "none";
      promptEl.removeEventListener("transitionend", onTransitionEnd);
    };
    promptEl.addEventListener("transitionend", onTransitionEnd);

    // Fallback in case transitionend doesn't fire
    setTimeout(() => {
      promptEl.style.display = "none";
    }, 250);

    isVisible = false;
  } catch (err) {
    console.error("[Karobar] dismissPrompt error:", err);
  }
}
