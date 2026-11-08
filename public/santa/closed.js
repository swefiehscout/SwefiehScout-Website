// Friendly "bookings closed" notices on the public pages (home and book).
// Reads the same public settings as the pages and picks the message by why bookings are closed:
//   paused: the team switched bookings off  -> check back soon
//   late:   close to Christmas Eve (cutoff) -> call or message us
//   over:   Christmas Eve has passed        -> thank you, see you next year
// Each notice is an element with [data-closed] holding [data-closed-icon], [data-closed-title],
// [data-closed-text] and optionally [data-closed-action]. Booking logic is not touched.
(function () {
  const S = window.Santa;
  const notices = document.querySelectorAll("[data-closed]");
  if (!S || !notices.length) return;
  const CUTOFF_HOURS = 48; // the default online-booking cutoff; the public settings don't expose it

  S.sb.rpc("public_config").then(({ data }) => {
    if (!data || data.open) return;
    const at = (t) => new Date(`${data.event_date}T${String(t).slice(0, 5)}:00+03:00`).getTime(); // Amman time
    const start = at(data.start_time);
    let end = at(data.end_time);
    if (end <= start) end += 864e5;
    const now = Date.now();
    const kind = now >= end ? "over" : now >= start - CUTOFF_HOURS * 3600e3 ? "late" : "paused";
    const phone = String(data.contact_phone || "").trim();
    const esc = S.esc;

    const COPY = {
      paused: {
        icon: "🛷",
        title: "Bookings are paused for now",
        text: "We're getting Santa's sleigh ready. Please check back again soon, new visit times will open right here. "
          + (phone
            ? `If you think this is a mistake, please give us a call on <strong>${esc(phone)}</strong>.`
            : "If you think this is a mistake, please send us a message and we'll get back to you."),
        action: (phone ? `<a class="btn-primary" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">Call ${esc(phone)}</a>` : "")
          + `<a class="btn-secondary" href="contact.html">Ask a Question</a>`,
      },
      late: {
        icon: "📞",
        title: "Online booking has closed",
        text: phone
          ? `Christmas Eve is almost here, so online booking has closed. Call us on ${esc(phone)} and we'll do our best to fit you in.`
          : "Christmas Eve is almost here, so online booking has closed. Send us a message and we'll do our best to fit you in.",
        action: phone
          ? `<a class="btn-primary" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">Call ${esc(phone)}</a><a class="btn-secondary" href="contact.html">Send a Message</a>`
          : `<a class="btn-primary" href="contact.html">Send Us a Message</a>`,
      },
      over: {
        icon: "🎄",
        title: "Thank you for a wonderful Christmas Eve",
        text: "Santa's visits are over for this year. Thank you for welcoming us into your homes. See you next Christmas!",
        action: "",
      },
    }[kind];

    notices.forEach((el) => {
      el.dataset.kind = kind;
      const set = (sel, html) => { const n = el.querySelector(sel); if (n) n.innerHTML = html; };
      set("[data-closed-icon]", COPY.icon);
      set("[data-closed-title]", esc(COPY.title));
      set("[data-closed-text]", COPY.text);
      const act = el.querySelector("[data-closed-action]");
      if (act) { act.innerHTML = COPY.action; act.hidden = !COPY.action; }
    });
  });
})();
