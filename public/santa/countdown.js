// Countdown to Christmas Eve (24 December, midnight Amman time) on the Santa home page.
// On 24 December it says "It's Christmas Eve!", and "Santa is out tonight!" during the visiting
// hours (from the public settings, so it follows Admin > Setup). From 25 December it counts to
// next year's Christmas Eve. Booking logic is not touched.
(function () {
  const root = document.querySelector("[data-countdown]");
  if (!root) return;
  const title = root.querySelector("[data-cd-title]");
  const note = root.querySelector("[data-cd-note]");
  const grid = root.querySelector("[data-cd-grid]");
  const eyebrow = root.querySelector(".eyebrow");
  const AMMAN = "+03:00";
  const at = (date, time) => new Date(`${date}T${String(time).slice(0, 5)}:00${AMMAN}`).getTime();
  const fmtTime = (t) => {
    const [h, m] = String(t).slice(0, 5).split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  let hours = { start: "15:00", end: "22:30" };

  const set = (k, v) => {
    const el = root.querySelector(`[data-cd="${k}"]`);
    const txt = String(v).padStart(2, "0");
    if (!el || el.textContent === txt) return;
    el.textContent = txt;
    el.classList.remove("is-flip");
    void el.offsetWidth;
    el.classList.add("is-flip");
  };
  // Christmas Eve this year in Amman, or next year's once this year's has passed.
  function eveOf(year) { return `${year}-12-24`; }
  function target(now) {
    const y = new Date(now + 3 * 3600e3).getUTCFullYear(); // the year in Amman
    const thisEve = at(eveOf(y), "00:00");
    const thisEnd = at(`${y}-12-25`, "00:00");
    if (now < thisEve) return { phase: "before", eve: eveOf(y), t: thisEve };
    if (now < thisEnd) return { phase: "eve", eve: eveOf(y) };
    return { phase: "before", eve: eveOf(y + 1), t: at(eveOf(y + 1), "00:00") };
  }
  const dayName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  function tick() {
    const now = Date.now();
    const x = target(now);
    if (x.phase === "eve") {
      grid.hidden = true;
      if (eyebrow) eyebrow.textContent = "Tonight";
      const start = at(x.eve, hours.start);
      let end = at(x.eve, hours.end);
      if (end <= start) end += 864e5;
      if (now >= start && now < end) {
        root.classList.add("is-live");
        title.innerHTML = 'Santa is <span class="accent">out tonight!</span>';
        note.textContent = "Visits are happening right now across Amman. Merry Christmas!";
      } else {
        root.classList.add("is-live");
        title.innerHTML = 'It’s <span class="accent">Christmas Eve!</span>';
        note.textContent = now < start ? `Santa visits tonight from ${fmtTime(hours.start)}.` : "Thank you for a wonderful Christmas Eve. Merry Christmas!";
      }
      return;
    }
    root.classList.remove("is-live");
    grid.hidden = false;
    if (eyebrow) eyebrow.textContent = "The countdown is on";
    title.innerHTML = 'Christmas Eve is <span class="accent">coming.</span>';
    note.textContent = `${dayName(x.eve)} · Santa visits from ${fmtTime(hours.start)}`;
    let s = Math.floor((x.t - now) / 1000);
    set("d", Math.floor(s / 86400)); s %= 86400;
    set("h", Math.floor(s / 3600)); s %= 3600;
    set("m", Math.floor(s / 60));
    set("s", s % 60);
  }

  tick();
  setInterval(tick, 1000);

  const S = window.Santa;
  if (S && S.sb) {
    S.sb.rpc("public_config").then(({ data }) => {
      if (!data) return;
      hours = { start: data.start_time || hours.start, end: data.end_time || hours.end };
      tick();
    });
  }
})();
