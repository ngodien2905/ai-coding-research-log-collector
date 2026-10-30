# AI Coding Research Log Collector

Small Chrome/Edge/Firefox Manifest V3 prototype for the capstone research project.

The toolbar button opens the logger in a full browser tab instead of a short-lived popup. This allows users to click outside a text field, switch tabs, and paste long prompts or responses without losing the form.

## Current MVP functions

1. Manage anonymous participants with course and optional research group.
2. Save one AI interaction locally in the browser, including participant, task, platform, plan, prompt, response, timestamp, and optional manual category.
3. Export the anonymized dataset as JSON or CSV.
4. Summarize research metrics from saved interactions, including total prompts and counts/percentages for code generation, debugging, explanation, verification, full solution requests, and testing.

The extension does not automatically scrape ChatGPT, Claude, Codex, or other apps. The user pastes the prompt and response, or selects text in a browser tab and sends it to the form. This keeps the prototype small and lets it collect logs from browser-based and desktop tools using the same data format.

Participant records intentionally contain only an anonymous ID, course, and optional research group. Do not enter student names or contact details.

## Install locally

Chrome/Edge:

1. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project folder.
5. Open the extension from the browser toolbar. It opens in a full browser tab so the form stays available when it loses focus.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select this project's `manifest.json` file.
4. Open the extension from the Firefox toolbar or extensions menu. It opens in a full browser tab so the form stays available when it loses focus.

The Firefox installation is temporary and normally disappears when Firefox closes. A signed `.xpi` package is needed for regular distribution.

## Data location

Participants and logs are stored in the browser's extension storage using `chrome.storage.local`. They remain on the current machine until the user exports or clears them. The prototype does not have a server or cloud database yet.

## Planned next step

Validate the data format and research workflow with sample logs before adding any platform-specific conversation adapter or backend API. A future server version can receive the same JSON records through an ASP.NET Core API and store them in SQLite.
