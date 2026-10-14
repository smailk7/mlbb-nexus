'use strict';

// MLBBDex is a community-maintained data source, not an official Moonton API.
const API_BASE = 'https://mlbbdex.com/api/v1';
const FALLBACK_HEROES = [
  {name:'Miya',slug:'miya',role:'Marksman'}, {name:'Tigreal',slug:'tigreal',role:'Tank'},
  {name:'Nana',slug:'nana',role:'Mage'}, {name:'Alucard',slug:'alucard',role:'Fighter'},
  {name:'Fanny',slug:'fanny',role:'Assassin'}, {name:'Rafaela',slug:'rafaela',role:'Support'},
  {name:'Layla',slug:'layla',role:'Marksman'}, {name:'Zilong',slug:'zilong',role:'Fighter'},
  {name:'Eudora',slug:'eudora',role:'Mage'}, {name:'Saber',slug:'saber',role:'Assassin'},
  {name:'Franco',slug:'franco',role:'Tank'}, {name:'Angela',slug:'angela',role:'Support'}
];
const state = { heroes: [], visible: [], role: 'all', query: '', selected: null };
const $ = (selector) => document.querySelector(selector);
const heroGrid = $('#heroGrid');

function firstText(...values) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}
function getImage(value) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of ['url','src','image','portrait','cover','artwork','thumbnail','hero_image']) {
      if (typeof value[key] === 'string' && /^https?:\/\//i.test(value[key])) return value[key];
    }
  }
  return '';
}
function normalizeHero(item, index) {
  const name = firstText(item.name, item.hero_name, item.title, item.localized_name, item.key) || `Hero ${index + 1}`;
  const slug = firstText(item.slug, item.id, item.key, item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let roleValue = item.role || item.roles || item.main_role || item.type || item.position || '';
  if (Array.isArray(roleValue)) roleValue = roleValue.join(' ');
  const roleText = String(roleValue).toLowerCase();
  const roles = ['Tank','Fighter','Assassin','Mage','Marksman','Support'];
  const role = roles.find((r) => roleText.includes(r.toLowerCase())) || (roles.find((r) => String(item.role || '').toLowerCase().includes(r.toLowerCase()))) || 'Hero';
  const image = getImage(item.image) || getImage(item.images) || getImage(item.portrait) || getImage(item.artwork) || getImage(item.cover) || getImage(item.image_url) || getImage(item.icon) || '';
  return {...item, name, slug, role, image, _index:index + 1};
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function imageMarkup(url, name, className='') {
  if (!url) return `<span class="card-monogram ${className}" aria-label="Ilustrasi belum tersedia">${escapeHTML((name || '?').slice(0,1).toUpperCase())}</span>`;
  return `<img class="${className}" src="${escapeHTML(url)}" alt="Ilustrasi ${escapeHTML(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
}
function setHeroCounts(count) {
  $('#heroCount').textContent = count ? count : '—';
  $('#statHeroes').textContent = count ? count : 'Belum tersedia';
}
function renderCards() {
  const q = state.query.trim().toLowerCase();
  state.visible = state.heroes.filter((hero) => {
    const matchesName = hero.name.toLowerCase().includes(q);
    const matchesRole = state.role === 'all' || hero.role.toLowerCase() === state.role.toLowerCase() || (Array.isArray(hero.roles) && hero.roles.some(r => String(r).toLowerCase() === state.role.toLowerCase()));
    return matchesName && matchesRole;
  });
  $('#resultsLabel').textContent = `${state.visible.length} hero ditampilkan`;
  if (!state.visible.length) {
    heroGrid.innerHTML = '<div class="empty-state"><strong>HERO TIDAK DITEMUKAN</strong><span>Coba kata kunci atau filter role yang lain.</span></div>';
    return;
  }
  heroGrid.innerHTML = state.visible.map((hero, i) => `
    <article class="hero-card" tabindex="0" role="button" data-slug="${escapeHTML(hero.slug)}" aria-label="Lihat detail ${escapeHTML(hero.name)}" style="animation-delay:${Math.min(i * 35, 280)}ms">
      <div class="card-art"><span class="card-role">${escapeHTML(hero.role)}</span><span class="card-number">${String(hero._index || i + 1).padStart(2,'0')}</span>${imageMarkup(hero.image, hero.name)}</div>
      <div class="card-info"><h3 title="${escapeHTML(hero.name)}">${escapeHTML(hero.name)}</h3><p>${escapeHTML(hero.lane || hero.position || 'Hero MLBB')}</p><div class="card-footer"><span>LIHAT PROFIL</span><span class="card-arrow">↗</span></div></div>
    </article>`).join('');
}
async function loadHeroes() {
  try {
    const response = await fetch(`${API_BASE}/heroes`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : (payload.data || payload.heroes || payload.results || payload.items || []);
    if (!Array.isArray(list) || !list.length) throw new Error('Format data tidak dikenal');
    state.heroes = list.map(normalizeHero);
    setHeroCounts(state.heroes.length);
    $('#loadNote').textContent = `Memuat ${state.heroes.length} entri dari MLBBDex. Data komunitas dapat berubah dan belum tentu mencakup seluruh aset terbaru.`;
    renderCards();
  } catch (error) {
    // Keep the page usable when the community API is offline or blocked by browser CORS.
    state.heroes = FALLBACK_HEROES.map(normalizeHero);
    setHeroCounts('—');
    $('#loadNote').textContent = 'API komunitas tidak dapat dijangkau saat ini. Yang ditampilkan adalah daftar contoh terbatas, bukan katalog lengkap. Coba muat ulang saat koneksi API tersedia.';
    renderCards();
    showToast('Katalog live tidak tersedia. Menampilkan contoh hero terbatas.');
  }
}
async function openHero(slug) {
  const hero = state.heroes.find((item) => item.slug === slug) || state.heroes.find((item) => item.name.toLowerCase() === String(slug).toLowerCase());
  if (!hero) return;
  state.selected = hero;
  $('#modalName').textContent = hero.name;
  $('#modalDescription').textContent = 'Mengambil detail hero dan daftar skin dari sumber komunitas…';
  $('#modalBadges').innerHTML = `<span>${escapeHTML(hero.role)}</span>${hero.lane ? `<span>${escapeHTML(hero.lane)}</span>` : ''}`;
  $('#modalArt').innerHTML = `${imageMarkup(hero.image, hero.name)}<span class="modal-monogram">${escapeHTML(hero.name.slice(0,1))}</span>`;
  $('#modalSkinCount').textContent = 'Memuat…';
  $('#modalSkins').innerHTML = '<div class="loading-state"><span class="loader"></span></div>';
  $('#heroModal').classList.add('open');
  $('#heroModal').setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  try {
    const response = await fetch(`${API_BASE}/heroes/${encodeURIComponent(hero.slug)}`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error('Detail tidak tersedia');
    const payload = await response.json();
    const detail = payload.data || payload.hero || payload;
    const description = firstText(detail.description, detail.bio, detail.lore, detail.story, detail.overview);
    $('#modalDescription').textContent = description || 'Belum ada deskripsi hero pada respons sumber. Detail visual dan skin bergantung pada data yang tersedia.';
    const roles = detail.roles || detail.role;
    if (roles) {
      const roleArray = Array.isArray(roles) ? roles : [roles];
      $('#modalBadges').innerHTML = roleArray.slice(0,4).map(r => `<span>${escapeHTML(typeof r === 'string' ? r : r.name || 'Role')}</span>`).join('');
    }
    const skinCandidates = detail.skins || detail.skin_list || detail.costumes || detail.outfits || detail.appearances || [];
    const skins = Array.isArray(skinCandidates) ? skinCandidates : Object.values(skinCandidates || {});
    $('#modalSkinCount').textContent = `${skins.length} skin`;
    if (skins.length) {
      $('#modalSkins').innerHTML = skins.map((skin, index) => {
        const skinName = typeof skin === 'string' ? skin : firstText(skin.name, skin.title, skin.skin_name, skin.label) || `Skin ${index + 1}`;
        const skinType = typeof skin === 'object' ? firstText(skin.rarity, skin.type, skin.tier, skin.category) : '';
        const skinImage = typeof skin === 'object' ? (getImage(skin.image) || getImage(skin.artwork) || getImage(skin.image_url) || getImage(skin.cover)) : '';
        return `<div class="modal-skin">${skinImage ? `<img src="${escapeHTML(skinImage)}" alt="${escapeHTML(skinName)}" loading="lazy" style="width:100%;height:92px;object-fit:cover;margin-bottom:9px" onerror="this.remove()">` : ''}<strong>${escapeHTML(skinName)}</strong><small>${escapeHTML(skinType || 'Skin')}</small></div>`;
      }).join('');
      renderSkinGallery(hero, skins);
    } else {
      $('#modalSkins').innerHTML = '<div class="empty-state"><span>Data skin belum tersedia untuk hero ini.</span></div>';
      $('#skinGallery').innerHTML = '<div class="skin-placeholder"><span>✦</span><strong>DATA SKIN BELUM TERSEDIA</strong><small>Pilih hero lain atau coba lagi nanti.</small></div>';
    }
  } catch (error) {
    $('#modalDescription').textContent = 'Profil ringkas tersedia dari katalog hero, tetapi detail dan skin tidak dapat diambil saat ini. Ini bisa terjadi jika API sedang offline atau koneksi browser membatasi permintaan.';
    $('#modalSkinCount').textContent = 'Belum tersedia';
    $('#modalSkins').innerHTML = '<div class="empty-state"><span>Detail skin tidak dapat dimuat sekarang.</span></div>';
    showToast('Detail tidak tersedia dari API saat ini.');
  }
}
function renderSkinGallery(hero, skins) {
  const withImages = skins.map((skin, i) => ({skin, i, image: typeof skin === 'object' ? (getImage(skin.image) || getImage(skin.artwork) || getImage(skin.image_url) || getImage(skin.cover)) : ''})).filter(x => x.image).slice(0,8);
  if (!withImages.length) {
    $('#skinGallery').innerHTML = `<div class="skin-placeholder"><span>✦</span><strong>${escapeHTML(hero.name.toUpperCase())} — SKIN COLLECTION</strong><small>${skins.length} skin terdata, tetapi sumber belum menyediakan gambar skin.</small></div>`;
    return;
  }
  $('#skinGallery').innerHTML = withImages.map(({skin, i, image}) => {
    const name = typeof skin === 'string' ? skin : firstText(skin.name, skin.title, skin.skin_name, skin.label) || `Skin ${i+1}`;
    const type = typeof skin === 'object' ? firstText(skin.rarity, skin.type, skin.tier, skin.category) : '';
    return `<article class="skin-card"><img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.style.display='none'"><div><strong>${escapeHTML(name)}</strong><small>${escapeHTML(hero.name)}${type ? ` · ${escapeHTML(type)}` : ''}</small></div></article>`;
  }).join('');
}
function closeModal() {
  $('#heroModal').classList.remove('open');
  $('#heroModal').setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}
let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
$('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; renderCards(); });
$('#roleFilters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-role]');
  if (!button) return;
  state.role = button.dataset.role;
  $('#roleFilters').querySelectorAll('.role-chip').forEach((chip) => chip.classList.toggle('active', chip === button));
  renderCards();
});
$('#resetFilters').addEventListener('click', () => {
  state.query = ''; state.role = 'all'; $('#searchInput').value = '';
  $('#roleFilters').querySelectorAll('.role-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.role === 'all'));
  renderCards();
});
heroGrid.addEventListener('click', (event) => { const card = event.target.closest('[data-slug]'); if (card) openHero(card.dataset.slug); });
heroGrid.addEventListener('keydown', (event) => { const card = event.target.closest('[data-slug]'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openHero(card.dataset.slug); } });
$('#modalClose').addEventListener('click', closeModal);
$('#heroModal').addEventListener('click', (event) => { if (event.target === $('#heroModal')) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
$('#menuToggle').addEventListener('click', () => {
  const nav = $('.main-nav'); const open = nav.classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', String(open));
});
$('.main-nav').addEventListener('click', (event) => { if (event.target.closest('a')) { $('.main-nav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded','false'); } });
loadHeroes();

