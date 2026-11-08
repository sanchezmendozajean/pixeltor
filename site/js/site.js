// Pixeltor · sitio web. Sin dependencias.
(function () {
  var REPO = 'sanchezmendozajean/pixeltor';

  // --- Sprite de ejemplo (gema) dibujado como SVG de píxeles ---
  var art = document.querySelector('[data-pixelart]');
  if (art) {
    var rows = [
      '................',
      '.....oooooo.....',
      '....oLLLLWwo....',
      '...oLLLLLWwwo...',
      '..oLLLLMMMMMwo..',
      '.oLLLMMMMMMMMmo.',
      '.oLMMMMMMMMMMmo.',
      '.oMMMMMMMMMMmDo.',
      '..oMMMMMMMMmDo..',
      '...oMMMMMMmDo...',
      '....oMMMMmDo....',
      '.....oMMmDo.....',
      '......oMDo......',
      '.......oo.......',
      '................',
      '................'
    ];
    var pal = { o: '#14233f', L: '#8fd0ff', W: '#ffffff', w: '#d8f0ff', M: '#3d8bff', m: '#2a6dd9', D: '#1c4a9c' };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" role="img" aria-label="Sprite de ejemplo: una gema azul con sombra paralela">';
    // sombra paralela (efecto no destructivo, desplazada 1 px)
    rows.forEach(function (r, y) {
      for (var x = 0; x < 16; x++) if (r[x] !== '.') s += '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="1" height="1" fill="#000" opacity=".4"/>';
    });
    rows.forEach(function (r, y) {
      for (var x = 0; x < 16; x++) if (pal[r[x]]) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + pal[r[x]] + '"/>';
    });
    art.innerHTML = s + '</svg>';
  }

  // --- Enlaces de descarga desde la última release de GitHub ---
  var cards = document.querySelectorAll('[data-asset]');
  if (cards.length && window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rel) {
        var assets = rel.assets || [];
        document.querySelectorAll('[data-version]').forEach(function (el) { el.textContent = rel.tag_name; });
        cards.forEach(function (el) {
          var re = new RegExp(el.getAttribute('data-asset'), 'i');
          var a = assets.filter(function (x) { return re.test(x.name); })[0];
          if (a) {
            el.href = a.browser_download_url;
            var size = el.parentElement.querySelector('[data-size]');
            if (size) size.textContent = a.name + ' · ' + (a.size / 1048576).toFixed(0) + ' MB';
          }
        });
      })
      .catch(function () { /* sin red o sin releases: los enlaces apuntan a la página de releases */ });
  }

  // --- Documentación: filtro del índice y sección activa ---
  var toc = document.querySelector('.toc');
  if (toc) {
    var links = [].slice.call(toc.querySelectorAll('a'));
    var q = toc.querySelector('input');
    if (q) q.addEventListener('input', function () {
      var v = q.value.trim().toLowerCase();
      links.forEach(function (a) { a.hidden = v && a.textContent.toLowerCase().indexOf(v) < 0; });
    });
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var heads = [].slice.call(document.querySelectorAll('article h2[id]'));
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('active'); });
            if (map[e.target.id]) map[e.target.id].classList.add('active');
          }
        });
      }, { rootMargin: '-72px 0px -70% 0px' });
      heads.forEach(function (h) { io.observe(h); });
    }
  }
})();
