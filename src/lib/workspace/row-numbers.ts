// Adds a live "#" column to every `.ws-table` in the Leaders Workspace
// and Admin console — showing each row's current position (1, 2, 3, ...)
// rather than anything stored. Every table in both pages already
// re-renders by replacing its whole <tbody>, so one MutationObserver per
// table catches every re-render (sorted, filtered, or after an add/
// delete) and keeps the numbers correct without any render function
// needing to know about this.
//
// Skips the single "No X yet" placeholder row every table uses
// (`<td class="ws-empty" colspan="...">`) so that row doesn't get a "1".

const TH_CLASS = 'ws-th-num';
const TD_CLASS = 'ws-row-num';

function numberBody(tbody: HTMLTableSectionElement) {
  const table = tbody.closest('table');
  const headRow = table?.querySelector('thead tr');
  if (headRow && !headRow.querySelector(`.${TH_CLASS}`)) {
    const th = document.createElement('th');
    th.className = TH_CLASS;
    th.textContent = '#';
    headRow.insertBefore(th, headRow.firstChild);
  }

  let n = 0;
  Array.from(tbody.rows).forEach((tr) => {
    if (tr.querySelector('td.ws-empty')) return;
    n += 1;
    let cell = tr.cells[0];
    if (!cell || !cell.classList.contains(TD_CLASS)) {
      cell = document.createElement('td');
      cell.className = TD_CLASS;
      cell.setAttribute('data-label', '#');
      tr.insertBefore(cell, tr.firstChild);
    }
    cell.textContent = String(n);
  });
}

export function initRowNumbering(root: ParentNode = document): void {
  const bodies = root.querySelectorAll<HTMLTableSectionElement>('table.ws-table > tbody');
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target instanceof HTMLElement && m.target.tagName === 'TBODY') {
        numberBody(m.target as HTMLTableSectionElement);
      }
    }
  });
  bodies.forEach((tbody) => {
    numberBody(tbody);
    observer.observe(tbody, { childList: true });
  });
}
