/**
 * content.js — Google Flow Image Generator
 *
 * DOM Selectors (verified from live inspection 2026-04-10):
 *  - Input:   div[role="textbox"][contenteditable="true"]  (Tiptap editor)
 *             Placeholder: "คุณต้องการสร้างอะไร" / "What do you want to create?"
 *  - Submit:  button with arrow_forward icon or text "สร้าง"
 *  - URL:     https://labs.google/fx/{lang}/tools/flow/project/{id}
 *
 * IMPORTANT FIX: document.execCommand() causes Next.js/React to crash!
 *  - Use DataTransfer clipboard paste simulation instead
 *  - Use keyboard events (Ctrl+A, Delete) instead of execCommand('delete')
 *  - Generation takes 15–40s; wait by counting fixed delay
 *
 * HUMAN-LIKE MODE:
 *  - Random typing speed variation per character
 *  - Random inter-prompt delay (betweenMinMs – betweenMaxMs)
 *  - Occasional "pause to think" mid-typing
 *  - Mouse-move simulation before clicking
 */

(function () {
  'use strict';

  // ============================
  // STATE
  // ============================

  let isRunning = false;
  let isPaused  = false;
  let currentQueue  = [];
  let currentIndex  = 0;
  let indicator = null;

  // ============================
  // OVERLAY INDICATOR
  // ============================
  function showIndicator(text) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'gflow-indicator';
      indicator.innerHTML = `<div class="gflow-dot"></div><span class="gflow-label"></span>`;
      document.body.appendChild(indicator);
    }
    indicator.querySelector('.gflow-label').textContent = text;
    indicator.classList.remove('hidden');
  }

  function hideIndicator() {
    if (indicator) indicator.classList.add('hidden');
  }

  // ============================
  // ELEMENT FINDERS
  // ============================

  /**
   * Find the Flow prompt input.
   * Google Flow uses a Tiptap div[role="textbox"][contenteditable="true"]
   */
  function findInput() {
    // Prefer textbox role
    const byRole = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (byRole) return byRole;

    // Fallback: any contenteditable that is visible
    const all = document.querySelectorAll('[contenteditable="true"]');
    for (const el of all) {
      if (el.offsetParent !== null) return el; // visible
    }

    // Last resort textarea
    return document.querySelector('textarea') || null;
  }

  /**
   * Find the submit/generate button.
   * Google Flow: button with arrow_forward material icon, or text "สร้าง"
   * The button is typically disabled until text is in the input.
   */
  function findSubmitButton() {
    const buttons = Array.from(document.querySelectorAll('button'));

    // 1. Material icon "arrow_forward" (most reliable)
    const byArrow = buttons.find(b => {
      const icon = b.querySelector('i, [class*="icon"], svg');
      const iconText = icon?.textContent?.trim() || icon?.getAttribute('aria-label') || '';
      return iconText === 'arrow_forward' || iconText === 'send';
    });
    if (byArrow && !byArrow.disabled) return byArrow;

    // 2. aria-label match
    const byLabel = buttons.find(b =>
      b.getAttribute('aria-label')?.match(/send|submit|create|generate|สร้าง|ส่ง/i)
    );
    if (byLabel && !byLabel.disabled) return byLabel;

    // 3. Text match Thai/EN
    const byText = buttons.find(b =>
      /^(สร้าง|create|generate|run|ส่ง|send)$/i.test(b.innerText?.trim())
    );
    if (byText && !byText.disabled) return byText;

    // 4. Disabled version (still return it so we can wait for it to enable)
    return byArrow || byLabel || byText || null;
  }

  // ============================
  // TIPTAP INPUT HELPERS
  // ============================

  /**
   * Simulate real human typing into ProseMirror/Tiptap editor.
   *
   * WHY CHARACTER-BY-CHARACTER:
   *  ProseMirror maintains its own internal document state (separate from DOM).
   *  It updates this state by listening to these events PER KEYSTROKE:
   *    keydown → beforeinput (inputType=insertText) → keyup
   *  Each character must fire the full cycle so ProseMirror registers the input,
   *  clears the placeholder, enables the submit button, etc.
   *
   * CLEAR STRATEGY:
   *  Ctrl+A selects all → then type the new text replaces the selection.
   *  This avoids execCommand('delete') which crashes Next.js.
   */
  async function setTiptapText(editor, text) {
    // 1. Click + focus to make sure ProseMirror is truly active
    editor.click();
    await delay(100);
    editor.focus();
    await delay(150);

    // 2. Select all existing text with Ctrl+A
    //    Fire the full keyboard event sequence that a real browser would
    const ctrlA = (type) => editor.dispatchEvent(new KeyboardEvent(type, {
      key: 'a', code: 'KeyA', ctrlKey: true,
      bubbles: true, cancelable: true, composed: true
    }));
    ctrlA('keydown');
    ctrlA('keyup');
    await delay(120);

    // 3. Type each character individually — full event cycle per char
    for (const char of text) {
      const keyCode  = char.charCodeAt(0);
      const keyProps = {
        key: char, code: `Key${char.toUpperCase()}`,
        keyCode, charCode: keyCode, which: keyCode,
        bubbles: true, cancelable: true, composed: true
      };

      // keydown
      editor.dispatchEvent(new KeyboardEvent('keydown', keyProps));

      // beforeinput — this is what ProseMirror primarily listens to
      editor.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      // Let the browser handle the actual DOM insert via execCommand.
      // At this point ProseMirror's beforeinput handler has run — it
      // will perform the real insert internally.
      document.execCommand('insertText', false, char);

      // input event after insert
      editor.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        composed: true
      }));

      // keyup
      editor.dispatchEvent(new KeyboardEvent('keyup', keyProps));

      // Small delay between characters — mimic natural typing speed (30–80 WPM)
      // Occasionally pause longer as if thinking
      const charDelay = 25 + Math.random() * 55;
      if (Math.random() < 0.03) {
        // 3% chance of a micro-pause (as if correcting a typo mentally)
        await delay(charDelay + 200 + Math.random() * 400);
      } else {
        await delay(charDelay);
      }
    }

    await delay(200);

    // 4. Verify — log to console for debugging
    const actual = editor.innerText?.trim() || editor.textContent?.trim() || '';
    console.log(`%cGFlowGen typed: "${actual.slice(0, 50)}"`, 'color:#4285f4;font-weight:bold');
    return actual;
  }

  // ============================
  // WAIT HELPERS
  // ============================
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  async function waitFor(fn, maxMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const v = fn();
      if (v) return v;
      await delay(400);
    }
    return null;
  }

  /** Wait until submit button exists AND is not disabled */
  async function waitForSubmit(maxMs = 12000) {
    return waitFor(() => {
      const btn = findSubmitButton();
      return (btn && !btn.disabled) ? btn : null;
    }, maxMs);
  }

  /**
   * Wait for generation to complete.
   * Strategy: fixed delay (user-configurable) since Flow's
   * spinner selectors change often and are hard to detect reliably.
   */
  async function waitForGenerationComplete(delayMs) {
    // Show countdown in indicator
    const totalSec = Math.round(delayMs / 1000);
    for (let s = totalSec; s > 0; s--) {
      if (!isRunning) break;
      const pct = Math.round(((totalSec - s) / totalSec) * 100);
      showIndicator(`Generating... ⏳ ${s}s  [${pct}%]`);
      await delay(1000);
    }
    // Extra buffer for Flow to finish rendering
    await delay(1500 + Math.random() * 1000);
  }

  /**
   * Human-like pause between prompts — random within range.
   * @param {number} minMs
   * @param {number} maxMs
   */
  async function humanPauseBetweenPrompts(minMs, maxMs) {
    const ms = minMs + Math.random() * (maxMs - minMs);
    const sec = Math.round(ms / 1000);
    for (let s = sec; s > 0; s--) {
      if (!isRunning) break;
      showIndicator(`Next prompt in ${s}s... 💤`);
      await delay(1000);
    }
  }

  // ============================
  // FLOW UI INJECTION HELPERS
  // Based on actual DOM inspection of labs.google/fx Flow
  // Confirmed DOM structure (2026-04-10):
  //  - Trigger: button bottom-right of prompt showing current type+count (e.g. "วิดีโอ □ x2")
  //  - Media type: role=tab buttons with text รูปภาพ / วิดีโอ (inside popover)
  //  - Quantity:   role=tab buttons with text x1 / x2 / x3 / x4 (inside popover)
  //  - Model:      button showing model name → opens sub-dropdown with options
  // ============================

  /**
   * Open the Flow settings popover (the panel with media type, model, quantity).
   * Flow shows a floating panel when you click the small config/settings
   * button near the bottom-right of the prompt area.
   */
  async function openFlowSettingsPopover() {
    // The config panel is usually shown by clicking a button near the prompt input.
    // It can be a gear icon, a chip showing current model name, or a settings button.
    // Strategy: look for any element that currently shows the active model name
    // or a known trigger button.

    // 0. BEST: button contains both a media type word AND a quantity chip (e.g. "วิดีโอ □ x2" or "รูปภาพ x1")
    // This is the combined trigger chip visible near the submit arrow at bottom-right
    const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
    const combinedTrigger = allBtns.find(b => {
      const rect = b.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const text = (b.innerText || b.textContent || '').toLowerCase();
      const hasMediaType = text.includes('รูปภาพ') || text.includes('วิดีโอ') ||
                           text.includes('image') || text.includes('video');
      const hasQuantity  = /x[1-4]/.test(text);
      return hasMediaType && hasQuantity && text.length < 30;
    });

    if (combinedTrigger) {
      combinedTrigger.click();
      console.log('%cGFlowGen: Opened settings via combined type+qty chip', 'color:#4285f4',
        combinedTrigger.innerText?.trim());
      await delay(500);
      return true;
    }

    // 1. Try clicking the currently visible model name badge / chip (most reliable)
    // Look for an element that looks like the "Nano Banana 2 ▾" chip
    const modelChip = allBtns.find(b => {
      const rect = b.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const text = (b.innerText || b.textContent || '').toLowerCase();
      return (
        text.includes('nano banana') ||
        text.includes('imagen') ||
        text.includes('veo') ||
        text.includes('auto')
      ) && text.length < 60; // Avoid long text blocks
    });

    if (modelChip) {
      modelChip.click();
      console.log('%cGFlowGen: Opened settings via model chip click', 'color:#4285f4');
      await delay(500);
      return true;
    }

    // 2. Fallback: look for a settings/config button near the prompt area
    const settingsBtn = allBtns.find(b => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const text = (b.innerText || '').toLowerCase();
      return aria.includes('setting') || aria.includes('config') ||
             aria.includes('option') || aria.includes('ตั้งค่า') ||
             text.includes('setting') || text.includes('ตั้งค่า');
    });

    if (settingsBtn) {
      settingsBtn.click();
      console.log('%cGFlowGen: Opened settings via settings button', 'color:#4285f4');
      await delay(500);
      return true;
    }

    // 3. Strategy: Look for specific icon buttons (e.g., 'tune', 'settings')
    const iconBtn = allBtns.find(b => {
      const icon = b.querySelector('i, span, svg')?.textContent?.toLowerCase() || '';
      return icon.includes('tune') || icon.includes('settings');
    });

    if (iconBtn) {
      iconBtn.click();
      console.log('%cGFlowGen: Opened settings via icon button', 'color:#4285f4');
      await delay(500);
      return true;
    }

    console.warn('GFlowGen: Could not find settings popover trigger');
    // Debug: log ALL visible buttons to help identify the correct one
    const debugBtns = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(b => `"${(b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 50)}"`);
    console.warn('GFlowGen: Visible buttons:', debugBtns.join(' | '));
    return false;
  }

  /**
   * Close the popover if still open (press Escape or click outside).
   */
  async function closeFlowSettingsPopover() {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    }));
    await delay(200);
  }

  /**
   * Generic: find and click an element by exact/partial text or aria-label.
   * Scopes search to currently visible elements only.
   */
  function findVisibleElement(candidates) {
    const all = Array.from(document.querySelectorAll(
      'button, [role="button"], [role="option"], [role="tab"], [role="menuitem"], li, div[tabindex]'
    ));
    for (const el of all) {
      // Must be visible
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const aria = (el.getAttribute('aria-label') || '').trim();
      const text = (el.innerText || el.textContent || '').trim();

      for (const cand of candidates) {
        if (
          aria.toLowerCase() === cand.toLowerCase() ||
          text.toLowerCase() === cand.toLowerCase() ||
          aria.toLowerCase().includes(cand.toLowerCase()) ||
          text.toLowerCase().includes(cand.toLowerCase())
        ) {
          return el;
        }
      }
    }
    return null;
  }

  /** Set Media Type: opens popover then clicks รูปภาพ or วิดีโอ tab */
  async function injectMediaType(mediaType) {
    if (!mediaType) return;
    showIndicator(`Setting media type: ${mediaType}...`);

    await openFlowSettingsPopover();
    await delay(400);

    let candidates;
    if (mediaType === 'Video') {
      candidates = ['วิดีโอ', 'video', 'vdo', 'vid'];
    } else {
      candidates = ['รูปภาพ', 'image', 'รูป', 'photo', 'img'];
    }

    const el = findVisibleElement(candidates);
    if (el) {
      el.click();
      console.log(`%cGFlowGen: MediaType → clicked "${el.innerText?.trim()}"`, 'color:#4285f4');
      await delay(400);
    } else {
      console.warn('GFlowGen: MediaType element not found, candidates:', candidates);
    }
    // Don't close — we might need to set model and quantity inside same popover
  }

  /** Set Model: click the model dropdown inside the popover, then pick the option */
  async function injectModel(modelName) {
    if (!modelName || modelName === 'Auto') return;
    showIndicator(`Setting model: ${modelName}...`);

    // The model chooser inside the popover is typically a native <select>
    // or a custom dropdown with the current model name + a down-arrow button.
    // First try to find a <select> that contains the model options
    const selects = Array.from(document.querySelectorAll('select'));
    for (const sel of selects) {
      // Check if this select has the model as an option
      const opts = Array.from(sel.options);
      const match = opts.find(o =>
        o.text.toLowerCase().includes(modelName.toLowerCase()) ||
        o.value.toLowerCase().includes(modelName.toLowerCase())
      );
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`%cGFlowGen: Model → set select to "${match.text}"`, 'color:#4285f4');
        await delay(400);
        return;
      }
    }

    // Fallback: click the dropdown trigger with arrow_drop_down icon first, then pick from list
    // Look for the currently-visible dropdown trigger (shows model name + chevron)
    const dropdownTrigger = findVisibleElement([modelName.split(' ')[0], 'arrow_drop_down']);
    if (dropdownTrigger) {
      dropdownTrigger.click();
      await delay(400);
    }

    // Now look for the specific model option in the expanded list
    const modelEl = findVisibleElement([modelName]);
    if (modelEl) {
      modelEl.click();
      console.log(`%cGFlowGen: Model → clicked "${modelEl.innerText?.trim()}"`, 'color:#4285f4');
      await delay(400);
    } else {
      console.warn('GFlowGen: Model element not found:', modelName);
    }
  }

  /** Set Quantity: click x1/x2/x3/x4 chip inside the popover */
  async function injectQuantity(quantity) {
    if (!quantity || quantity === 'x1') return; // x1 is default
    showIndicator(`Setting quantity: ${quantity}...`);

    // Flow shows x1 x2 x3 x4 chips (exact text match)
    const candidates = [quantity, quantity.replace('x', '× '), quantity.replace('x', 'x')];
    const el = findVisibleElement(candidates);
    if (el) {
      el.click();
      console.log(`%cGFlowGen: Quantity → clicked "${el.innerText?.trim()}"`, 'color:#4285f4');
      await delay(300);
    } else {
      console.warn('GFlowGen: Quantity element not found:', quantity);
    }
  }

  /** Run all injections then close the popover */
  async function injectFlowSettings(item) {
    const mediaType = item.mediaType || 'Image';
    const modelName = item.modelName || 'Auto';
    const quantity  = item.quantity  || 'x1';

    const needsPopover = (mediaType !== 'Image') || (modelName !== 'Auto') || (quantity !== 'x1');
    if (!needsPopover) return; // nothing to change

    // Open the flow settings popover once
    await openFlowSettingsPopover();
    await delay(500);

    // Set media type (tab click inside popover)
    if (mediaType === 'Video') {
      const vidEl = findVisibleElement(['วิดีโอ', 'video']);
      if (vidEl) { vidEl.click(); await delay(400); }
    }
    // (Image is default, no click needed)

    // Set quantity chip inside popover
    if (quantity && quantity !== 'x1') {
      const qEl = findVisibleElement([quantity]);
      if (qEl) { qEl.click(); await delay(300); }
    }

    // Set model (dropdown inside popover)
    if (modelName && modelName !== 'Auto') {
      await injectModel(modelName);
    }

    // Close popover by pressing Escape
    await closeFlowSettingsPopover();
    await delay(300);
  }

  // ============================
  // AUTO-DOWNLOAD HELPER
  // ============================
  async function attemptAutoDownload() {
    showIndicator('Saving image... 📥');
    await delay(1000); // Wait for the image/buttons to fully render after generation

    // Strategy 1: Find standard download buttons natively provided by the UI
    const possibleBtns = Array.from(document.querySelectorAll('button, a[role="button"], a[download]'));
    const downloadBtns = possibleBtns.filter(b => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const text = (b.innerText || '').toLowerCase();
      const iconText = b.querySelector('i, span, svg')?.textContent?.toLowerCase() || '';
      return aria.includes('ดาวน์โหลด') || aria.includes('download') ||
             text.includes('ดาวน์โหลด') || text.includes('download') ||
             iconText.includes('download') || iconText === 'file_download';
    });

    if (downloadBtns.length > 0) {
      // Click the last one (usually matches the latest generated item)
      const targetBtn = downloadBtns[downloadBtns.length - 1];
      targetBtn.click();
      console.log('GFlowGen: Clicked native download button');
      return true;
    }

    // Strategy 2: Fallback to extracting the latest image URL and asking extension to download it
    const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
      // Filter out small UI icons/avatars (usually < 100px)
      return img.width > 200 || img.height > 200 || !img.width;
    });

    if (imgs.length > 0) {
      const targetImg = imgs[imgs.length - 1];
      if (targetImg.src) {
        console.log('GFlowGen: Sending extracted image URL to sidebar to download');
        notifySidebar('DOWNLOAD_IMAGE', { url: targetImg.src });
        return true;
      }
    }

    console.warn('GFlowGen: Auto-download failed (no button or image found)');
    return false;
  }

  // ============================
  // PROCESS SINGLE ITEM
  // ============================
  async function processItem(item, delaySeconds, autoDownload = false) {
    showIndicator(`[${currentIndex + 1}/${currentQueue.length}] "${item.prompt.slice(0, 30)}..."`);

    notifySidebar('GENERATION_STATUS', {
      itemId: item.id, status: 'running',
      current: currentIndex + 1, total: currentQueue.length
    });

    try {
      // 1. Verify we're on a Flow project page
      if (!location.href.includes('/tools/flow')) {
        throw new Error('Not on a Flow project page. URL: ' + location.href);
      }

      // 2. Find the input (wait up to 10s in case of slow load)
      const input = await waitFor(findInput, 10000);
      if (!input) throw new Error('Prompt input field not found in DOM');

      // 3. Safely inject the prompt via clipboard paste
      await setTiptapText(input, item.prompt);

      // 3b. Inject Flow UI settings (media type, model, quantity)
      await injectFlowSettings(item);
      await delay(200);

      // 4. Wait for submit button to become enabled (text has been entered)
      const submitBtn = await waitForSubmit(10000);

      if (!submitBtn) {
        // Fallback: press Enter in the input
        console.warn('GFlowGen: Submit not found — trying Enter key');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', bubbles: true, cancelable: true
        }));
        await delay(800);
      } else {
        submitBtn.click();
      }

      // 5. Wait for generation (countdown)
      await waitForGenerationComplete(delaySeconds * 1000);

      // 6. Auto-download if enabled
      if (autoDownload) {
        await attemptAutoDownload();
        await delay(1000); // pause a bit before moving on
      }

      // 7. Done!
      notifySidebar('GENERATION_STATUS', {
        itemId: item.id, status: 'done',
        current: currentIndex + 1, total: currentQueue.length
      });
      notifySidebar('IMAGE_GENERATED', { prompt: item.prompt });
      return true;

    } catch (err) {
      console.error('GFlowGen processItem error:', err.message);
      showIndicator(`⚠ Error: ${err.message.slice(0, 50)}`);
      notifySidebar('GENERATION_STATUS', {
        itemId: item.id, status: 'error',
        current: currentIndex + 1, total: currentQueue.length
      });
      await delay(2000);
      return false;
    }
  }

  // ============================
  // QUEUE RUNNER
  // ============================
  /**
   * @param {Array}  queue
   * @param {number} delaySeconds      - generation wait time
   * @param {number} betweenMinSeconds - min pause between prompts (human-like)
   * @param {number} betweenMaxSeconds - max pause between prompts (human-like)
   * @param {boolean} autoDownload     - whether to auto download
   */
  async function runQueue(queue, delaySeconds, betweenMinSeconds = 5, betweenMaxSeconds = 15, autoDownload = false) {
    isRunning = true;
    isPaused  = false;
    currentQueue = queue;

    for (let i = 0; i < queue.length; i++) {
      if (!isRunning) break;

      while (isPaused) {
        showIndicator('⏸ Paused — click Resume in sidebar');
        await delay(700);
      }

      currentIndex = i;
      const ok = await processItem(queue[i], delaySeconds, autoDownload);

      // Human-like delay between prompts
      if (ok && i < queue.length - 1) {
        const minMs = betweenMinSeconds * 1000;
        const maxMs = betweenMaxSeconds * 1000;
        await humanPauseBetweenPrompts(minMs, maxMs);
      }
    }

    isRunning = false;
    hideIndicator();

    notifySidebar('GENERATION_STATUS', {
      itemId: null, status: 'queue_complete',
      current: queue.length, total: queue.length
    });
  }

  // ============================
  // CHROME MESSAGE BRIDGE
  // ============================
  function notifySidebar(type, data) {
    chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {

      case 'START_QUEUE':
        if (!isRunning) {
          runQueue(
            message.queue,
            message.delay        || 25,
            message.betweenMin   || 5,
            message.betweenMax   || 15,
            message.autoDownload || false
          );
        }
        sendResponse({ ok: true });
        break;

      case 'GENERATE_SINGLE':
        if (!isRunning) {
          runQueue(
            [{ id: Date.now(), prompt: message.prompt, mediaType: message.mediaType, modelName: message.modelName, quantity: message.quantity }],
            message.delay || 25,
            0, 0,
            message.autoDownload || false
          );
        }
        sendResponse({ ok: true });
        break;

      case 'PAUSE_QUEUE':
        isPaused = true;
        sendResponse({ ok: true });
        break;

      case 'RESUME_QUEUE':
        isPaused = false;
        sendResponse({ ok: true });
        break;

      case 'STOP_QUEUE':
        isRunning = false;
        isPaused  = false;
        currentQueue = [];
        hideIndicator();
        sendResponse({ ok: true });
        break;

      case 'PING':
        sendResponse({ ok: true, url: location.href, isFlow: location.href.includes('/tools/flow') });
        break;
    }
    return true;
  });

  console.log('%cGFlowGen content script loaded ✓', 'color:#4285f4;font-weight:bold');

})();
