const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));

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
