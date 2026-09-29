/* ============ Helpers & storage ============ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 2500);
}
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ============ Navigation ============ */
$$(".tab[data-view]").forEach((btn) => btn.addEventListener("click", () => {
  $$(".tab[data-view]").forEach((b) => b.classList.toggle("active", b === btn));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + btn.dataset.view));
  if (btn.dataset.view !== "exercise") stopExercise();
}));

/* ============ Theme ============ */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $("#themeSelect").value = t; store.set("theme", t);
}
$("#themeSelect").addEventListener("change", (e) => setTheme(e.target.value));
setTheme(store.get("theme", "tide"));

/* ============ Profile ============ */
function renderProfile() {
  const name = store.get("name", "");
  $("#profileBtn").textContent = name ? name[0].toUpperCase() : "?";
  $("#nameInput").value = name;
  $("#greeting").textContent = name ? `Hi ${name}, how are you feeling?` : "How are you feeling?";
}
$("#profileBtn").addEventListener("click", () => {
  const menu = $("#profileMenu"); menu.hidden = !menu.hidden;
  $("#profileBtn").setAttribute("aria-expanded", String(!menu.hidden));
});
$("#saveName").addEventListener("click", () => {
  store.set("name", $("#nameInput").value.trim()); renderProfile();
  $("#profileMenu").hidden = true; toast("Name saved");
});
$("#clearData").addEventListener("click", () => {
  if (confirm("Delete all check-ins, journal entries and your name from this device?")) {
    localStorage.clear(); location.reload();
  }
});

/* ============ Mood check-in ============ */
const MOODS = { 1: ["😞", "Very low"], 2: ["😕", "Low"], 3: ["😐", "Okay"], 4: ["🙂", "Good"], 5: ["😄", "Great"] };
let selectedMood = null;

$$(".mood").forEach((b) => b.addEventListener("click", () => {
  selectedMood = +b.dataset.mood;
  $$(".mood").forEach((m) => m.setAttribute("aria-checked", String(m === b)));
  $("#saveMood").disabled = false;
}));
$("#intensity").addEventListener("input", (e) => ($("#intensityOut").textContent = e.target.value));

$("#saveMood").addEventListener("click", () => {
  const entries = store.get("moods", []);
  const entry = { id: Date.now(), mood: selectedMood, intensity: +$("#intensity").value, note: $("#moodNote").value.trim() };
  entries.unshift(entry); store.set("moods", entries.slice(0, 200));
  $("#moodNote").value = ""; renderHistory(); toast("Check-in saved");
  // Offer guided journal, especially for lower moods
  $("#checkin").hidden = true; startJournal(entry);
});

function renderHistory() {
  const list = store.get("moods", []).slice(0, 7);
  $("#emptyHistory").hidden = list.length > 0;
  $("#history").innerHTML = list.map((e) => `
    <li><span class="emo">${MOODS[e.mood][0]}</span>
      <div><strong>${MOODS[e.mood][1]}</strong> · intensity ${e.intensity}/10
      <small>${new Date(e.id).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small>
      ${e.note ? `<small>${esc(e.note)}</small>` : ""}</div></li>`).join("");
}

/* ============ Guided journal (CBT thought record) ============ */
const JOURNAL_STEPS = [
  { key: "situation", title: "What happened?", help: "Describe the situation briefly. Where were you, who was there, what was going on?" },
  { key: "thought", title: "What went through your mind?", help: "Write the automatic thought(s) you noticed, exactly as they came." },
  { key: "emotion", title: "What did you feel in your body and emotions?", help: "Name the feelings (anxious, sad, angry…) and any physical sensations." },
  { key: "for", title: "What supports this thought?", help: "List facts that make the thought seem true. Facts only, not feelings." },
  { key: "against", title: "What does not support it?", help: "What facts go against the thought? What would you say to a friend in this spot?" },
  { key: "balanced", title: "Write a more balanced thought", help: "Use both sides above. What is a fair, realistic way to see this?" },
  { key: "after", title: "How do you feel now?", help: "Notice any change in your mood or intensity, even a small one." }
];
let jStep = 0, jAnswers = {}, jEntry = null;

function startJournal(entry) {
  jEntry = entry; jStep = 0; jAnswers = {};
  $("#journal").hidden = false; renderStep();
}
function renderStep() {
  const s = JOURNAL_STEPS[jStep];
  $("#stepCount").textContent = `Step ${jStep + 1} of ${JOURNAL_STEPS.length}`;
  $("#stepTitle").textContent = s.title; $("#stepHelp").textContent = s.help;
  $("#stepInput").value = jAnswers[s.key] || ""; $("#stepInput").focus();
  $("#progressBar").style.width = ((jStep + 1) / JOURNAL_STEPS.length) * 100 + "%";
  $("#prevStep").disabled = jStep === 0;
  $("#nextStep").textContent = jStep === JOURNAL_STEPS.length - 1 ? "Finish" : "Next";
}
function saveStepAnswer() { jAnswers[JOURNAL_STEPS[jStep].key] = $("#stepInput").value.trim(); }
function endJournal() { $("#journal").hidden = true; $("#checkin").hidden = false; selectedMood = null;
  $$(".mood").forEach((m) => m.setAttribute("aria-checked", "false")); $("#saveMood").disabled = true; }

$("#prevStep").addEventListener("click", () => { saveStepAnswer(); jStep--; renderStep(); });
$("#nextStep").addEventListener("click", () => {
  saveStepAnswer();
  if (jStep < JOURNAL_STEPS.length - 1) { jStep++; renderStep(); return; }
  const journals = store.get("journals", []);
  journals.unshift({ moodId: jEntry.id, date: Date.now(), ...jAnswers });
  store.set("journals", journals); endJournal(); toast("Journal saved. Well done for taking this time.");
});
$("#skipJournal").addEventListener("click", endJournal);

/* ============ Module 2: Exercises ============ */
const EXERCISES = [
  { id: "box", type: "breath", title: "Box breathing", tag: "4 min · breathing",
    desc: "Equal counts in, hold, out, hold. Helps steady a racing mind.",
    phases: [["Breathe in", 4, 1.9], ["Hold", 4, 1.9], ["Breathe out", 4, 1], ["Hold", 4, 1]], cycles: 6 },
  { id: "478", type: "breath", title: "4-7-8 breathing", tag: "3 min · breathing",
    desc: "A long, slow exhale signals your body to relax. Good before sleep.",
    phases: [["Breathe in", 4, 1.9], ["Hold", 7, 1.9], ["Breathe out", 8, 1]], cycles: 4 },
  { id: "54321", type: "ground", title: "5-4-3-2-1 senses", tag: "3 min · grounding",
    desc: "Use your five senses to come back to the present moment.",
    steps: [
      ["See", "Look around and name 5 things you can see."],
      ["Touch", "Notice 4 things you can feel: your clothes, the chair, the air on your skin."],
      ["Hear", "Listen for 3 sounds, near or far."],
      ["Smell", "Find 2 things you can smell, or recall 2 smells you like."],
      ["Taste", "Notice 1 thing you can taste. Take a slow sip of water if you have some."]] },
  { id: "body", type: "ground", title: "Feet and body scan", tag: "4 min · grounding",
    desc: "Move attention through your body, from your feet upward.",
    steps: [
      ["Feet", "Press your feet into the floor. Notice the pressure and the temperature."],
      ["Legs", "Feel the weight of your legs. Let them be heavy and supported."],
      ["Hands", "Rest your hands. Squeeze them gently for 5 seconds, then release."],
      ["Shoulders", "Lift your shoulders toward your ears, then let them drop."],
      ["Face", "Soften your jaw, forehead and eyes."],
      ["Whole body", "Take one slow breath. Notice you are here, in this room, right now."]] }
];

let current = null, timers = [], gStep = 0, running = false;

function renderExerciseList() {
  $("#exerciseList").innerHTML = EXERCISES.map((e) => `
    <button class="card" data-id="${e.id}"><span class="tag">${e.tag}</span>
    <h3>${e.title}</h3><p>${e.desc}</p></button>`).join("");
  $$(".card").forEach((c) => c.addEventListener("click", () => openExercise(c.dataset.id)));
}
function openExercise(id) {
  stopExercise(); current = EXERCISES.find((e) => e.id === id);
  $("#exerciseList").hidden = true; $("#exerciseRunner").hidden = false;
  $("#exTitle").textContent = current.title; $("#exDesc").textContent = current.desc;
  $("#breathUI").hidden = current.type !== "breath"; $("#groundUI").hidden = current.type !== "ground";
  $("#startBtn").hidden = false; $("#startBtn").textContent = "Start";
  $("#orbText").textContent = "Ready"; $("#cycleCount").textContent = "";
  if (current.type === "ground") { gStep = 0; renderGround(); }
}
function stopExercise() {
  running = false; timers.forEach(clearTimeout); timers = [];
  const orb = $("#orb"); orb.style.transition = "transform .6s"; orb.style.transform = "scale(1)";
}
$("#exitExercise").addEventListener("click", () => {
  stopExercise(); $("#exerciseRunner").hidden = true; $("#exerciseList").hidden = false;
});
$("#startBtn").addEventListener("click", () => {
  if (current.type === "breath") runBreathing(); else { $("#startBtn").hidden = true; renderGround(); }
});

function runBreathing() {
  stopExercise(); running = true; $("#startBtn").textContent = "Restart";
  const { phases, cycles } = current; let cycle = 0, p = 0;
  const orb = $("#orb");
  (function next() {
    if (!running) return;
    if (p === 0) { cycle++; $("#cycleCount").textContent = `Round ${cycle} of ${cycles}`; }
    const [label, secs, scale] = phases[p];
    $("#orbText").textContent = label;
    orb.style.transition = `transform ${secs}s ease-in-out`; orb.style.transform = `scale(${scale})`;
    let n = secs;
    const tick = () => { if (!running) return; $("#orbText").textContent = `${label} · ${n}`; if (--n >= 0) timers.push(setTimeout(tick, 1000)); };
    tick();
    timers.push(setTimeout(() => {
      p = (p + 1) % phases.length;
      if (p === 0 && cycle >= cycles) { running = false; $("#orbText").textContent = "Well done"; toast("Exercise complete"); return; }
      next();
    }, secs * 1000));
  })();
}

function renderGround() {
  const steps = current.steps, [t, txt] = steps[gStep];
  $("#groundStep").textContent = `${t} (${gStep + 1}/${steps.length})`; $("#groundText").textContent = txt;
  $("#groundBar").style.width = ((gStep + 1) / steps.length) * 100 + "%";
  $("#groundPrev").disabled = gStep === 0;
  $("#groundNext").textContent = gStep === steps.length - 1 ? "Finish" : "Next";
}
$("#groundPrev").addEventListener("click", () => { gStep--; renderGround(); });
$("#groundNext").addEventListener("click", () => {
  if (gStep < current.steps.length - 1) { gStep++; renderGround(); }
  else { toast("Exercise complete"); $("#exitExercise").click(); }
});

/* ============ Init ============ */
renderProfile(); renderHistory(); renderExerciseList();
