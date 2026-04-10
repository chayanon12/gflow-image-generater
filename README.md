# Google Flow Automator (FlowGen)

A powerful Chrome Extension for automating image and video generation on [Google Flow (labs.google/fx/tools/flow)](https://labs.google/fx/tools/flow). It features a robust side panel UI injected via manifest V3, allowing you to queue, bulk-generate, and manage output settings dynamically.

## 🌟 Key Features

* **Advanced Queue Management:** Add multiple prompts (single or bulk line-by-line). Supports loop queue logic, manual re-ordering (via remove/re-prompt), and tracks exact completion states.
* **Unified Generation Settings (Injection):**
  * **Media Type:** Select between Image (`รูปภาพ`) and Video (`วิดีโอ`).
  * **Models:** Direct support for `Imagen 4`, `Nano Banana 2`, `Nano Banana Pro`, and `Veo 3.1` (Lite/Fast/Quality).
  * **Quantity Control:** Ask Flow to generate `x1` up to `x4` assets per prompt.
* **Human-like Automation Engine:**
  * Uses true `InputEvent` simulation for typing into the complex ProseMirror/Tiptap text editor.
  * Emulates random typing speeds and occasional "thinking pauses".
  * Intelligently detects and opens the localized Flow configuration popover to inject model configurations rather than overriding prompt texts.
* **Auto-Downloading:** Extracts generated images direct to your local machine automatically once complete.
* **History Dashboard:** Tracks past successful generations for easy reusability.

## 📦 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. The extension icon will appear in your Chrome toolbar. Pin it! ✨

## 🚀 Usage

1. Open your specific **Google Flow project tab** (e.g., `https://labs.google/fx/th/tools/flow/...`).
2. Click the Extension icon to open the FlowGen **Side Panel**.
3. Choose your configuration:
   * **Type:** Image or Video.
   * **Model:** Auto, or pick a specific image/video model.
   * **Count:** x1 to x4 outputs per run.
4. **Single Mode:** Type a prompt and click "Add to Queue" or "Generate Now".
5. **Bulk Mode:** Switch mode to `📋 Bulk (per line)`, paste hundreds of prompts line by line, and click "Bulk Generate All".
6. Switch to the **Queue** tab to monitor progress, pause/resume, or see remaining generators.

## 🛠 Technical Details & Injection Logic

FlowGen is built to avoid API dependencies by acting exactly like a user, bypassing strict Next.js/React hydration traps via careful DOM interaction:

* **Tiptap Input Injection:** Flow disables native `execCommand`. Instead, we synthesize `keydown`, `beforeinput` (insertText), and `keyup` to trick ProseMirror into acknowledging our injected text.
* **Smart UI Injection:** Instead of brute-forcing attributes, the content script finds the *visible localized chip* (e.g., `วิดีโอ □ x2`), triggers the popover to open, clicks the appropriate standard DOM elements (`role="tab"`, or native `<select>`), and gracefully closes the panel via `Escape` simulation.

## 📄 Version History & Recent Updates

* **v1.2 (Latest):** Overhauled Flow DOM injection framework. Replaced text-based option injection with a true GUI automation step that opens Flow's native settings modal, clicking exact Image/Video tabs and quantity chips (x1-x4) based on `innerText`/`aria-labels`. Added `Imagen 4` and `Veo 3.1` model variants.
* **v1.1:** Introduced Auto-download capabilities and bulk queuing.
* **v1.0:** Initial robust Tiptap input simulation.
