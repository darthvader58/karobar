import { detect } from './detector/index';
import { scrape } from './scraper/index';
import { showPrompt, dismissPrompt } from './prompt/index';
import { checkDuplicate, sendMessage } from './messaging';

// Listen for DISMISS_PROMPT from background (e.g. navigation change)
chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'DISMISS_PROMPT') {
    dismissPrompt();
  }
});

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
