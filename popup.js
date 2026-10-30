const STORAGE_KEY = "aiResearchLogs";
const PARTICIPANTS_KEY = "aiResearchParticipants";

const form = document.querySelector("#log-form");
const participantForm = document.querySelector("#participant-form");
const statusEl = document.querySelector("#status");
const recentLogsEl = document.querySelector("#recent-logs");
const logCountEl = document.querySelector("#log-count");
const participantSelect = document.querySelector("#participant-id");
const participantsEl = document.querySelector("#participants");
const courseSelect = document.querySelector("#new-course");
const otherCourseField = document.querySelector("#other-course-field");
const otherCourseInput = document.querySelector("#other-course");
const metricsTotalEl = document.querySelector("#metrics-total");
const metricsListEl = document.querySelector("#metrics-list");

const METRIC_CATEGORIES = [
  { label: "Code Generation", categories: ["Code Generation"] },
  { label: "Debugging", categories: ["Debugging"] },
  { label: "Explanation", categories: ["Concept Explanation", "Code Explanation"] },
  { label: "Verification", categories: ["Verification"] },
  { label: "Full Solution Request", categories: ["Full Solution Request"] },
  { label: "Testing", categories: ["Testing"] }
];

document.addEventListener("DOMContentLoaded", async () => {
  await renderParticipants();
  await renderLogs();
});
form.addEventListener("submit", saveInteraction);
participantForm.addEventListener("submit", saveParticipant);
document.querySelector("#reset-form").addEventListener("click", () => form.reset());
document.querySelector("#export-json").addEventListener("click", () => exportLogs("json"));
document.querySelector("#export-csv").addEventListener("click", () => exportLogs("csv"));
document.querySelector("#clear-logs").addEventListener("click", clearLogs);
document.querySelector("#use-selection-prompt").addEventListener("click", () => useSelectedText("prompt"));
document.querySelector("#use-selection-response").addEventListener("click", () => useSelectedText("response"));
courseSelect.addEventListener("change", updateOtherCourseField);
updateOtherCourseField();

async function getLogs() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return result[STORAGE_KEY];
}

async function getParticipants() {
  const result = await chrome.storage.local.get({ [PARTICIPANTS_KEY]: [] });
  return result[PARTICIPANTS_KEY];
}

async function saveParticipant(event) {
  event.preventDefault();
  const data = new FormData(participantForm);
  const participantId = data.get("participantId").trim().toUpperCase();
  const selectedCourse = data.get("course");
  const customCourse = data.get("otherCourse").trim().toUpperCase();
  const course = selectedCourse === "Other" ? customCourse : selectedCourse;
  const group = data.get("group").trim();
  const participants = await getParticipants();

  if (!/^P\d{3,}$/.test(participantId)) {
    showStatus("Use an anonymous ID such as P001 or P021.", true);
    return;
  }

  if (selectedCourse === "Other" && !/^[A-Z0-9][A-Z0-9 .-]{1,29}$/.test(customCourse)) {
    showStatus("Enter a valid course code when using Other.", true);
    return;
  }

  if (participants.some((participant) => participant.participantId === participantId)) {
    showStatus(`${participantId} already exists.`, true);
    return;
  }

  participants.push({
    participantId,
    course,
    group,
    createdAt: new Date().toISOString()
  });
  participants.sort((a, b) => a.participantId.localeCompare(b.participantId));
  await chrome.storage.local.set({ [PARTICIPANTS_KEY]: participants });
  participantForm.reset();
  participantSelect.value = participantId;
  showStatus(`${participantId} added.`, false);
  await renderParticipants();
}

async function renderParticipants() {
  const participants = await getParticipants();
  const currentValue = participantSelect.value;
  participantSelect.innerHTML = participants.length
    ? '<option value="">Select participant</option>'
    : '<option value="">Add a participant first</option>';

  participants.forEach((participant) => {
    const option = document.createElement("option");
    option.value = participant.participantId;
    option.textContent = `${participant.participantId} · ${participant.course}`;
    participantSelect.appendChild(option);
  });
  participantSelect.value = participants.some((p) => p.participantId === currentValue)
    ? currentValue
    : "";

  if (participants.length === 0) {
    participantsEl.innerHTML = '<p class="participants-empty">No participants added yet.</p>';
    return;
  }

  participantsEl.innerHTML = participants.map((participant) => `
    <div class="participant-item">
      <div>
        <div class="participant-main">${escapeHtml(participant.participantId)} · ${escapeHtml(participant.course)}</div>
        <div class="participant-detail">${escapeHtml(participant.group || "No research group")}</div>
      </div>
      <button class="text-button remove-participant" type="button" data-participant-id="${escapeHtml(participant.participantId)}">Remove</button>
    </div>
  `).join("");

  participantsEl.querySelectorAll("[data-participant-id]").forEach((button) => {
    button.addEventListener("click", () => removeParticipant(button.dataset.participantId));
  });
}

async function removeParticipant(participantId) {
  if (!confirm(`Remove ${participantId}? Existing logs will remain.`)) return;
  const participants = await getParticipants();
  const updated = participants.filter((participant) => participant.participantId !== participantId);
  await chrome.storage.local.set({ [PARTICIPANTS_KEY]: updated });
  await renderParticipants();
  showStatus(`${participantId} removed. Existing logs remain.`);
}

async function saveInteraction(event) {
  event.preventDefault();
  const data = new FormData(form);
  const participants = await getParticipants();
  const participantId = data.get("participantId").trim();
  const participant = participants.find((item) => item.participantId === participantId);

  if (!participant) {
    showStatus("Select an existing participant first.", true);
    return;
  }

  const interaction = {
    id: crypto.randomUUID(),
    participantId,
    course: participant.course,
    group: participant.group,
    taskId: data.get("taskId").trim(),
    platform: data.get("platform"),
    plan: data.get("plan"),
    category: data.get("category"),
    prompt: data.get("prompt").trim(),
    response: data.get("response").trim(),
    timestamp: new Date().toISOString()
  };

  const logs = await getLogs();
  logs.push(interaction);
  await chrome.storage.local.set({ [STORAGE_KEY]: logs });
  form.reset();
  showStatus("Interaction saved locally.");
  await renderLogs();
}

async function renderLogs() {
  const logs = await getLogs();
  logCountEl.textContent = `${logs.length} saved interaction${logs.length === 1 ? "" : "s"}`;
  renderMetrics(logs);

  if (logs.length === 0) {
    recentLogsEl.innerHTML = '<p class="empty">No interactions saved yet.</p>';
    return;
  }

  recentLogsEl.innerHTML = logs
    .slice(-5)
    .reverse()
    .map((log) => {
      const category = log.category || "Not classified";
      const preview = escapeHtml(log.prompt);
      return `<article class="log-item">
        <div class="log-meta">
          <span class="log-title">${escapeHtml(log.participantId)} · ${escapeHtml(log.taskId)}</span>
          <span>${escapeHtml(log.platform)} · ${escapeHtml(category)}</span>
        </div>
        <p class="log-preview">${preview}</p>
      </article>`;
    })
    .join("");
}

function renderMetrics(logs) {
  metricsTotalEl.textContent = `${logs.length} total prompt${logs.length === 1 ? "" : "s"}`;
  metricsListEl.innerHTML = METRIC_CATEGORIES.map(({ label, categories }) => {
    const count = logs.filter((log) => categories.includes(log.category)).length;
    const percentage = logs.length ? (count / logs.length) * 100 : 0;
    return `<div class="metric-row">
      <span class="metric-label">${escapeHtml(label)}</span>
      <span class="metric-value">${count} <span>${percentage.toFixed(1)}%</span></span>
    </div>`;
  }).join("");
}

async function exportLogs(format) {
  const logs = await getLogs();
  const participants = await getParticipants();
  if (logs.length === 0) {
    showStatus("There are no logs to export.", true);
    return;
  }

  const content = format === "json"
    ? JSON.stringify({ exportedAt: new Date().toISOString(), participants, interactions: logs }, null, 2)
    : toCsv(logs);
  const mime = format === "json" ? "application/json" : "text/csv;charset=utf-8";
  const extension = format === "json" ? "json" : "csv";
  const blobUrl = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `ai-research-logs-${dateStamp()}.${extension}`;
  link.click();
  URL.revokeObjectURL(blobUrl);
  showStatus(`${format.toUpperCase()} export started.`);
}

async function clearLogs() {
  const logs = await getLogs();
  if (logs.length === 0 || !confirm("Delete all saved interactions?")) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  showStatus("All local interactions were deleted.");
  await renderLogs();
}

async function useSelectedText(target) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      showStatus("No active browser tab was found.", true);
      return;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection?.().toString().trim() || ""
    });

    const selectedText = result?.result || "";
    if (!selectedText) {
      showStatus("Select some text in the current tab first.", true);
      return;
    }

    document.querySelector(`#${target}`).value = selectedText;
    showStatus(`Selected text added to ${target}.`);
  } catch (error) {
    showStatus("This page does not allow selection access. Copy and paste instead.", true);
  }
}

function toCsv(logs) {
  const columns = ["id", "participantId", "course", "group", "taskId", "platform", "plan", "category", "prompt", "response", "timestamp"];
  return [
    columns.join(","),
    ...logs.map((log) => columns.map((column) => csvCell(log[column] ?? "")).join(","))
  ].join("\n");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function updateOtherCourseField() {
  const isOther = courseSelect.value === "Other";
  otherCourseField.hidden = !isOther;
  otherCourseInput.required = isOther;
  if (!isOther) otherCourseInput.value = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
