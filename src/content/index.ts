import { detect } from './detector/index';
import { scrape } from './scraper/index';
import { showPrompt, dismissPrompt } from './prompt/index';
import { checkDuplicate, sendMessage } from './messaging';
import { EMPTY_JOB_RECORD } from '../shared/sanitize';
import type { JobRecord } from '../shared/types';

// Listen for DISMISS_PROMPT from background (e.g. navigation change)
chrome.runtime.onMessage.addListener((msg: { type: string }, _sender, sendResponse) => {
  if (msg.type === 'DISMISS_PROMPT') {
    dismissPrompt();
  }

  if (msg.type === 'SCRAPE_PAGE') {
    try {
      const record = scrape(null);
      if (!isMeaningfulRecord(record)) {
        sendResponse({
          success: false,
          error: 'Could not extract meaningful job data from the current page.',
        });
      } else {
        sendResponse({ success: true, record });
      }
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to scrape the current page.',
      });
    }
    return true;
  }
});

function isMeaningfulRecord(record: JobRecord): boolean {
  if (!record) return false;
  const normalized = { ...EMPTY_JOB_RECORD, ...record };
  return Boolean(
    normalized.jobTitle ||
    normalized.companyName ||
    normalized.location ||
    normalized.employmentType ||
    normalized.jobTerm
  );
}

async function init(): Promise<void> {
  try {
    const result = await detect();
    if (!result.isJobPage) return;

    const { isDuplicate } = await checkDuplicate(location.href);
    showPrompt(result, isDuplicate);

    // One-time listeners for user action via custom DOM events dispatched by prompt buttons
    const onConfirmed = () => {
      document.removeEventListener('karobar:confirmed', onConfirmed);
      document.removeEventListener('karobar:dismissed', onDismissed);

      const record = scrape(result.platform);
      sendMessage({ type: 'LOG_JOB_RECORD', record }).catch((err) => {
        console.error('[Karobar] Failed to log job record:', err);
      });
    };

    const onDismissed = () => {
      document.removeEventListener('karobar:confirmed', onConfirmed);
      document.removeEventListener('karobar:dismissed', onDismissed);
    };

    document.addEventListener('karobar:confirmed', onConfirmed, { once: true });
    document.addEventListener('karobar:dismissed', onDismissed, { once: true });

  } catch (err) {
    console.error('[Karobar] init error:', err);
  }
}

init();
