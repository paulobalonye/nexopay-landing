// Autonomi Shared Nav & Footer injector
const NAV_HTML = `
<div class="cursor" id="cursor"></div>
<div class="cursor-ring" id="cursorRing"></div>
<nav>
  <a href="index.html" class="logo">Autono<span>mi</span></a>
  <ul class="nav-links">
    <li><a href="how-it-works.html">How it works</a></li>
    <li><a href="features.html">Features</a></li>
    <!-- <li><a href="pricing.html">Pricing</a></li> -->
    <li><a href="index.html#waitlist">Docs</a></li>
  </ul>
  <a href="index.html#waitlist" class="nav-cta">Join Waitlist</a>
  <button class="nav-toggle" id="navToggle" aria-label="Menu"><span></span><span></span><span></span></button>
</nav>`;

const FOOTER_HTML = `
<footer>
  <div>
    <div class="footer-logo">Autono<span>mi</span></div>
    <p class="footer-tagline">Payments infrastructure for the AI agent economy.</p>
  </div>
  <div class="footer-cols">
    <div class="footer-col">
      <div class="footer-col-title">Product</div>
      <a href="how-it-works.html">How it Works</a>
      <a href="features.html">Features</a>
      <!-- <a href="pricing.html">Pricing</a> -->
      <a href="index.html#waitlist">API Docs</a>
    </div>
    <div class="footer-col">
      <div class="footer-col-title">Company</div>
      <a href="#">About</a>
      <a href="#">Blog</a>
      <a href="#">Careers</a>
      <a href="#">Contact</a>
    </div>
    <div class="footer-col">
      <div class="footer-col-title">Legal</div>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="#">Cookie Policy</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Autonomi Inc. All rights reserved.</span>
    <div class="footer-socials">
      <a href="#">Twitter/X</a>
      <a href="#">LinkedIn</a>
      <a href="#">GitHub</a>
    </div>
  </div>
</footer>`;

const CURSOR_JS = `
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function animCursor() {
    cursor.style.transform = 'translate(' + (mx-6) + 'px,' + (my-6) + 'px)';
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    ring.style.transform = 'translate(' + (rx-18) + 'px,' + (ry-18) + 'px)';
    requestAnimationFrame(animCursor);
  }
  animCursor();
  // Scroll reveal
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => {
    el.style.opacity='0'; el.style.transform='translateY(24px)';
    el.style.transition='opacity 0.55s ease, transform 0.55s ease';
    revealObserver.observe(el);
  });
  // Hamburger menu toggle
  var toggle = document.getElementById('navToggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('active');
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() {
        toggle.classList.remove('active');
        links.classList.remove('open');
      });
    });
  }
`;

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  const s = document.createElement('script');
  s.textContent = CURSOR_JS;
  document.body.appendChild(s);
});
