/* Tidex Storefront - minimal JS (search, filter, sort, cart, theme) */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const fmt = n => `$${n.toFixed(2)}`;
  const userKey = 'tidex-user-v1';
  function getUser(){ try { return JSON.parse(localStorage.getItem(userKey)||'null'); } catch { return null; } }
  const store = {
    key: 'tidex-cart-v1',
    get(){ try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } },
    set(obj){ localStorage.setItem(this.key, JSON.stringify(obj)); }
  };

  const state = {
    products: [],
    categories: ['All', 'Apparel', 'Shoes', 'Accessories', 'Tech', 'Home'],
    query: '',
    category: 'All',
    sort: 'featured',
    cart: store.get()
  };

  // Sample data
  const sample = [
    {id:'p1', title:'Classic Tee', cat:'Apparel', price:24.00, rating:4.4, img:'https://picsum.photos/seed/tidex-tee/600/450'},
    {id:'p2', title:'Runner Sneaks', cat:'Shoes', price:89.00, rating:4.7, img:'https://picsum.photos/seed/tidex-shoes/600/450'},
    {id:'p3', title:'Minimal Watch', cat:'Accessories', price:129.00, rating:4.5, img:'https://picsum.photos/seed/tidex-watch/600/450'},
    {id:'p4', title:'Wireless Earbuds', cat:'Tech', price:59.00, rating:4.2, img:'https://picsum.photos/seed/tidex-buds/600/450'},
    {id:'p5', title:'Desk Lamp Pro', cat:'Home', price:39.00, rating:4.1, img:'https://picsum.photos/seed/tidex-lamp/600/450'},
    {id:'p6', title:'Hoodie Premium', cat:'Apparel', price:54.00, rating:4.8, img:'https://picsum.photos/seed/tidex-hoodie/600/450'},
    {id:'p7', title:'Smart Speaker', cat:'Tech', price:79.00, rating:4.6, img:'https://picsum.photos/seed/tidex-speaker/600/450'},
    {id:'p8', title:'Leather Wallet', cat:'Accessories', price:32.00, rating:4.3, img:'https://picsum.photos/seed/tidex-wallet/600/450'},
    {id:'p9', title:'Ceramic Mug Set', cat:'Home', price:22.00, rating:4.0, img:'https://picsum.photos/seed/tidex-mug/600/450'},
  ];

  state.products = sample;
  // Try loading live products from your deployed API
  (async ()=>{
    try{
      const API = (path) => `${localStorage.getItem('tidex-api') || 'https://website-0c1h.onrender.com'}/api${path}`;
      const res = await fetch(API('/products'));
      if(res.ok){
        const data = await res.json();
        if(Array.isArray(data) && data.length){
          state.products = data.map(p=>({
            id: p._id || p.id,
            title: p.title,
            cat: p.cat,
            price: p.price,
            rating: p.rating || 0,
            img: p.img || 'https://picsum.photos/seed/tidex-default/600/450'
          }));
          renderGrid();
        }
      }
    }catch(e){ /* keep sample data if API fails */ }
  })();

  // Elements
  const grid = $('#product-grid');
  const pills = $('#categories');
  const search = $('#search');
  const sortSel = $('#sort-select');
  const cartBtn = $('#cart-btn');
  const cartDrawer = $('#cart-drawer');
  const cartClose = $('#cart-close');
  const cartItems = $('#cart-items');
  const cartSubtotal = $('#cart-subtotal');
  const cartCount = $('#cart-count');
  const themeToggle = $('#theme-toggle');
  const userArea = $('#user-area');
  const mailBtn = $('#mail-btn');
  const mailCount = $('#mail-count');
  const API = (path) => `${localStorage.getItem('tidex-api') || 'http://localhost:3000'}/api${path}`;
  function getAuth(){ try{ const u = JSON.parse(localStorage.getItem(userKey)||'null'); return u && u.token ? { Authorization: `Bearer ${u.token}` } : {}; }catch{return {};}}

  // Accessibility helpers
  function trapFocus(container){
    const f = () => {
      const focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', container)
        .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      function onKey(e){
        if(e.key !== 'Tab') return;
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
      container.addEventListener('keydown', onKey);
      return () => container.removeEventListener('keydown', onKey);
    };
    return f();
  }

  // Render category pills
  function renderPills(){
    pills.innerHTML = '';
    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'pill' + (state.category === cat ? ' active' : '');
      b.role = 'tab';
      b.textContent = cat;
      b.onclick = () => { state.category = cat; render(); };
      pills.appendChild(b);
    });
  }

  function filtered(){
    let list = [...state.products];
    if(state.category !== 'All') list = list.filter(p => p.cat === state.category);
    if(state.query) list = list.filter(p => p.title.toLowerCase().includes(state.query));
    switch(state.sort){
      case 'price-asc': list.sort((a,b) => a.price - b.price); break;
      case 'price-desc': list.sort((a,b) => b.price - a.price); break;
      case 'rating-desc': list.sort((a,b) => b.rating - a.rating); break;
      default: break; // featured keep original order
    }
    return list;
  }

  function renderGrid(){
    const list = filtered();
    grid.innerHTML = '';
    if(!list.length){
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No products found.';
      grid.appendChild(empty);
      return;
    }
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e)=>{
        // Avoid intercepting inner button clicks
        if(e.target.closest('button')) return;
        location.href = `product.html?id=${encodeURIComponent(p.id)}`;
      });
      card.innerHTML = `
        <div class="media">
          <img src="${p.img}" alt="${p.title}" loading="lazy" />
        </div>
        <div class="body">
          <div class="title">${p.title}</div>
          <div class="muted xs">${p.cat}</div>
          <div class="price-row">
            <span class="price">${fmt(p.price)}</span>
            <span class="rating" aria-label="Rating ${p.rating} out of 5">★ ${p.rating}</span>
          </div>
          <div class="add">
            <button class="btn" data-add="${p.id}">Add to cart</button>
          </div>
        </div>`;
      grid.appendChild(card);
    });
  }

  function countCart(){
    return Object.values(state.cart).reduce((a,b)=>a+b,0);
  }
  function subtotal(){
    let s = 0;
    for(const [id, qty] of Object.entries(state.cart)){
      const p = state.products.find(x=>x.id===id);
      if(p) s += p.price * qty;
    }
    return s;
  }
  function saveCart(){ store.set(state.cart); }

  function renderCart(){
    cartItems.innerHTML = '';
    if(!Object.keys(state.cart).length){
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Your cart is empty.';
      cartItems.appendChild(p);
    } else {
      for(const [id, qty] of Object.entries(state.cart)){
        const p = state.products.find(x=>x.id===id);
        if(!p) continue;
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <img src="${p.img}" alt="${p.title}">
          <div class="meta">
            <div class="title">${p.title}</div>
            <div class="muted">${fmt(p.price)} • ${p.cat}</div>
            <div class="qty">
              <button data-dec="${p.id}">−</button>
              <input value="${qty}" inputmode="numeric" aria-label="Quantity for ${p.title}" />
              <button data-inc="${p.id}">+</button>
            </div>
          </div>
          <div class="price">${fmt(p.price * qty)}</div>`;
        cartItems.appendChild(row);
      }
    }
    cartSubtotal.textContent = fmt(subtotal());
    cartCount.textContent = countCart();
  }

  function openCart(){
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden','false');
    const cleanup = trapFocus(cartDrawer);
    const esc = (e)=>{ if(e.key==='Escape') closeCart(); };
    const click = (e)=>{ if(e.target.id==='cart-backdrop') closeCart(); };
    document.addEventListener('keydown', esc);
    cartDrawer.addEventListener('mousedown', click);
    cartDrawer._cleanup = ()=>{ document.removeEventListener('keydown', esc); cartDrawer.removeEventListener('mousedown', click); cleanup && cleanup(); };
  }
  function closeCart(){
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden','true');
    cartDrawer._cleanup && cartDrawer._cleanup();
  }

  // Events
  document.addEventListener('click', (e)=>{
    const t = e.target;
    if(t.matches('[data-add]')){
      const id = t.getAttribute('data-add');
      state.cart[id] = (state.cart[id]||0) + 1;
      saveCart();
      renderCart();
      cartBtn.classList.add('pulse');
      setTimeout(()=>cartBtn.classList.remove('pulse'), 300);
    }
    if(t.id==='cart-btn'){
      renderCart();
      openCart();
    }
  if(t.id==='cart-close') closeCart();
  if(t.id==='cart-backdrop') closeCart();
    if(t.id==='checkout-btn'){
      const items = Object.entries(state.cart).map(([id, qty])=>{
        const p = state.products.find(x=>x.id===id); if(!p) return null;
        return { productId: p._id || undefined, title: p.title, price: p.price, qty };
      }).filter(Boolean);
      if(items.length === 0){ alert('Your cart is empty.'); return; }
      (async()=>{
        try{
          const res = await fetch(API('/orders'), { method:'POST', headers: { 'Content-Type':'application/json', ...getAuth() }, body: JSON.stringify({ items }) });
          if(!res.ok) throw 0; const order = await res.json();
          alert('Order placed!'); state.cart = {}; saveCart(); renderCart(); closeCart();
        }catch{ alert('Checkout simulated (no backend).'); state.cart = {}; saveCart(); renderCart(); closeCart(); }
      })();
    }
    if(t.matches('[data-inc]')){
      const id = t.getAttribute('data-inc');
      state.cart[id] = (state.cart[id]||1) + 1;
      saveCart(); renderCart();
    }
    if(t.matches('[data-dec]')){
      const id = t.getAttribute('data-dec');
      const q = (state.cart[id]||1) - 1;
      if(q <= 0) delete state.cart[id]; else state.cart[id]=q;
      saveCart(); renderCart();
    }
  });

  document.addEventListener('input', (e)=>{
    const t = e.target;
    if(t.matches('.cart-item .qty input')){
      const title = t.closest('.cart-item').querySelector('.title').textContent;
      const p = state.products.find(x=>x.title===title);
      if(!p) return;
      const n = Math.max(0, parseInt(t.value || '0', 10));
      if(n === 0) delete state.cart[p.id]; else state.cart[p.id]=n;
      saveCart(); renderCart();
    }
  });

  // Search & sort
  search && search.addEventListener('input', (e)=>{ state.query = e.target.value.trim().toLowerCase(); renderGrid(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key === '/' && document.activeElement.tagName !== 'INPUT'){
      e.preventDefault(); search && search.focus();
    }
  });
  sortSel.addEventListener('change', ()=>{ state.sort = sortSel.value; renderGrid(); });

  // Theme (ensure initial from saved preference)
  const root = document.body;
  const themeKey = 'tidex-theme';
  function setTheme(t){ root.classList.toggle('theme-light', t==='light'); localStorage.setItem(themeKey,t); }
  root.classList.toggle('theme-light', (localStorage.getItem(themeKey) || 'light') === 'light');
  themeToggle && themeToggle.addEventListener('click', ()=>{
    const next = root.classList.contains('theme-light') ? 'dark' : 'light';
    setTheme(next);
  });

  // Newsletter
  const yearEl = $('#year'); if(yearEl) yearEl.textContent = new Date().getFullYear();
  const newsletter = $('#newsletter');
  newsletter && newsletter.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = $('#email').value.trim();
    if(!email){ alert('Please enter your email'); return; }
    try{
      const res = await fetch(API('/newsletter'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if(!res.ok) throw new Error('Request failed');
      alert(`Thanks for subscribing, ${email}!`);
      $('#email').value = '';
    }catch{
      alert(`Thanks for subscribing, ${email}!`);
      $('#email').value = '';
    }
  });

  function render(){ renderPills(); renderGrid(); renderCart(); }
  render();

  // Progressive user area if auth.js is not loaded yet
  if(userArea && !userArea.childElementCount){
    const u = getUser();
    if(!u){
      const link = document.createElement('a');
      link.className = 'link'; link.href = 'login.html'; link.textContent = 'Sign in';
      userArea.appendChild(link);
    } else {
      const chip = document.createElement('a');
      chip.className='user-chip';
      chip.href='account.html';
      chip.setAttribute('aria-label','Account');
      const pic = u.profilePicUrl || '';
      chip.innerHTML = `<span class="avatar" style="${pic?`background:transparent;`:''}">${pic?`<img src="${pic}" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover"/>`:''}</span><span>${u.name||u.email}</span>`;
      userArea.appendChild(chip);
    }
  }

  // Announcements mailbox
  const READ_KEY = 'tidex-read-anns';
  function getRead(){ try{return JSON.parse(localStorage.getItem(READ_KEY)||'[]');}catch{return [];} }
  function setRead(arr){ localStorage.setItem(READ_KEY, JSON.stringify(arr)); }
  async function loadAnns(){
    try{
      const res = await fetch(API('/announcements'));
      if(!res.ok) return;
      const list = await res.json();
      const read = new Set(getRead());
      const unread = list.filter(a=>!read.has(a._id));
      if(unread.length){ mailCount.style.display=''; mailCount.textContent = String(unread.length); }
      else { mailCount.style.display='none'; }
      mailBtn && mailBtn.addEventListener('click', ()=>{
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modal-content');
        if(!list.length){ modalContent.innerHTML = '<p style="color:#8a94a6">No announcements.</p>'; modal.style.display = 'flex'; return; }
        let html = '<h3>Announcements</h3>';
        html += '<ul style="padding-left:1.2em">' + list.map(a=>`<li style='margin-bottom:1em'><strong>${a.subject||'Announcement'}</strong><br><span style='font-size:13px;color:#8a94a6'>${a.createdAt?new Date(a.createdAt).toLocaleString():''}</span><br>${a.message||''}</li>`).join('') + '</ul>';
        modalContent.innerHTML = html;
        modal.style.display = 'flex';
        setRead(list.map(a=>a._id));
        mailCount.style.display='none';
      });
      // Modal close logic
      const modal = document.getElementById('modal');
      const closeBtn = document.getElementById('modal-close');
      if(closeBtn){
        closeBtn.onclick = ()=>{ modal.style.display = 'none'; };
      }
      modal.addEventListener('click', function(e){ if(e.target === modal) modal.style.display = 'none'; });
    }catch{}
  }
  mailBtn && loadAnns();

  // One-time welcome notice after signup
  const u = getUser();
  if(u && u.welcome){
    alert('Welcome to Tidex!');
    delete u.welcome; localStorage.setItem(userKey, JSON.stringify(u));
  }
})();
