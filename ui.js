// Glass nav gets denser on scroll
const header = document.querySelector('header');
if (header){
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  });
}

// Gentle fade-up reveal for headings/sections as you scroll to them
const revealEls = document.querySelectorAll('h2, .section-desc, .why-card, .service-card, .spotlight-list li');
revealEls.forEach(el => el.classList.add('reveal'));

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      entry.target.classList.add('reveal-in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealEls.forEach(el => io.observe(el));

// ============ 3D tilt on cards (mouse-tracked) ============
// Cards tilt toward the cursor like floating 3D panels.
(function(){
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  var tiltables = document.querySelectorAll(
    '.service-card, .why-card, .team-card, .tool-card, .info-card, .cube-wrap'
  );
  if (!tiltables.length) return;

  tiltables.forEach(function(card){
    function onMove(e){
      if (e.pointerType === 'touch') return;
      var r = card.getBoundingClientRect();
      if (r.width < 1) return;
      var px = (e.clientX - r.left) / r.width;   // 0..1 left->right
      var py = (e.clientY - r.top) / r.height;  // 0..1 top->bottom
      var rx = (0.5 - py) * 24;                  // up to ±12°
      var ry = (px - 0.5) * 24;                  // up to ±12°
      card.style.transition = 'transform 0.12s ease-out';
      card.style.transform =
        'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-5px)';
    }

    function onLeave(){
      card.style.transition = '';
      card.style.transform = '';
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    card.addEventListener('pointercancel', onLeave);
  });
})();

// ============ 3D depth: parallax layers + cursor glow ============
// Elements with [data-depth] move at different rates under the cursor, and
// a radial light follows the mouse. Any section (.hero, .page-hero, .spotlight)
// can opt in. Elements with [data-tilt] also rotate in 3D toward the cursor.
(function(){
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  var sections = document.querySelectorAll('.hero, .page-hero, .spotlight');
  if (!sections.length) return;

  sections.forEach(function(sec){
    var layers = sec.querySelectorAll('[data-depth]');
    var glow = sec.querySelector('.hero-glow');
    if (!layers.length && !glow) return;

    sec.addEventListener('pointermove', function(e){
      if (e.pointerType === 'touch') return;
      var r = sec.getBoundingClientRect();
      if (r.width < 1) return;
      var nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
      var ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(function(layer){
        var d = parseFloat(layer.getAttribute('data-depth')) || 10;
        var tx = (-nx * d).toFixed(1);
        var ty = (-ny * d).toFixed(1);
        var t = 'translate3d(' + tx + 'px, ' + ty + 'px, 0)';
        if (layer.hasAttribute('data-tilt')){
          layer.style.transition = 'transform 0.1s ease-out';
          t += ' rotateX(' + (-ny * 8).toFixed(2) + 'deg) rotateY(' + (nx * 10).toFixed(2) + 'deg)';
        }
        layer.style.transform = t;
      });
      if (glow){
        glow.style.background =
          'radial-gradient(600px circle at ' +
          (e.clientX - r.left).toFixed(0) + 'px ' +
          (e.clientY - r.top).toFixed(0) + 'px, ' +
          'rgba(255,106,52,0.10), transparent 65%)';
      }
    });

    sec.addEventListener('pointerleave', function(){
      layers.forEach(function(layer){
        if (layer.hasAttribute('data-tilt')){
          layer.style.transition = 'transform 0.7s cubic-bezier(0.22,1,0.36,1)';
          var self = layer;
          setTimeout(function(){ self.style.transition = ''; }, 750);
        }
        layer.style.transform = '';
      });
      if (glow){ glow.style.background = ''; }
    });
  });
})();

// ============ Mobile navigation: hamburger button + slide-in drawer ============
// Builds the menu entirely from the existing desktop nav so every page gets a
// working mobile menu with zero HTML changes. The button + drawer only appear
// on small screens (CSS hides/shows them).
(function(){
  var nav = document.querySelector('nav');
  if (!nav) return;
  var links = nav.querySelector('.nav-links');
  if (!links) return;

  // Hamburger button
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(toggle);

  // Drawer: backdrop + sliding panel, links cloned from the desktop nav
  var drawer = document.createElement('div');
  drawer.className = 'mobile-menu';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML =
    '<div class="mobile-menu-backdrop"></div>' +
    '<div class="mobile-menu-panel"></div>';
  var panel = drawer.querySelector('.mobile-menu-panel');

  var clone = links.cloneNode(true);
  clone.classList.remove('nav-mobile-hide');
  clone.classList.add('mobile-links');
  panel.appendChild(clone);

  var cta = nav.querySelector('.nav-cta');
  if (cta){
    var ctaClone = cta.cloneNode(true);
    ctaClone.classList.add('mobile-cta');
    panel.appendChild(ctaClone);
  }

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mobile-menu-close';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.textContent = '×';
  panel.appendChild(closeBtn);

  document.body.appendChild(drawer);

  function isOpen(){ return drawer.classList.contains('open'); }

  function open(){
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('nav-open');
  }

  function close(){
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('nav-open');
  }

  toggle.addEventListener('click', function(){ isOpen() ? close() : open(); });
  drawer.querySelector('.mobile-menu-backdrop').addEventListener('click', close);
  drawer.querySelector('.mobile-menu-close').addEventListener('click', close);
  panel.addEventListener('click', function(e){
    if (e.target.closest('a')) close();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && isOpen()) close();
  });
})();

