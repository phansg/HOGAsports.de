const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

document.querySelectorAll('[data-sport]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-sport]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.sport;
    document.querySelectorAll('[data-sport-panel]').forEach(panel => panel.hidden = panel.dataset.sportPanel !== target);
  });
});

const year = document.querySelector('[data-year]');
if (year) year.textContent = new Date().getFullYear();

const counter = document.querySelector('[data-visitor-count]');
if (counter) {
  const hit = document.body.dataset.counter === 'hit' ? '?hit=1' : '';
  fetch('counter.php' + hit, {cache:'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { if (Number.isFinite(data.count)) counter.textContent = data.count.toLocaleString('de-DE'); })
    .catch(() => { counter.closest('.visitor-counter')?.remove(); });
}
