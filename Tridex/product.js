(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const fmt = n => `$${Number(n||0).toFixed(2)}`;
  const API = (path) => `${localStorage.getItem('tidex-api') || 'http://localhost:3000'}/api${path}`;
  const userKey = 'tidex-user-v1';
  function getCart(){ try { return JSON.parse(localStorage.getItem('tidex-cart-v1')||'{}'); } catch { return {}; } }
  function setCart(c){ localStorage.setItem('tidex-cart-v1', JSON.stringify(c)); }
  function themeInit(){
    const root = document.body, key='tidex-theme';
    root.classList.toggle('theme-light', (localStorage.getItem(key)||'light')==='light');
    const tgl = document.getElementById('theme-toggle');
    tgl && tgl.addEventListener('click', ()=>{
      const next = root.classList.contains('theme-light') ? 'dark' : 'light';
      root.classList.toggle('theme-light', next==='light');
      localStorage.setItem(key, next);
    });
  }
  themeInit();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if(!id){ location.href = 'index.html'; return; }

  function render(p){
    $('#pimg').src = p.img || 'https://picsum.photos/seed/tidex-default/800/600';
    $('#ptitle').textContent = p.title || 'Product';
    $('#pcat').textContent = p.cat || '';
    $('#pprice').textContent = fmt(p.price || 0);
    $('#prating').textContent = `★ ${p.rating || 0}`;
    $('#pdesc').textContent = p.description || 'No description available.';
    let qty = 1; const qtyEl = $('#qty');
    $('#inc').onclick = ()=>{ qty = Math.min(99, qty+1); qtyEl.value = qty; };
    $('#dec').onclick = ()=>{ qty = Math.max(1, qty-1); qtyEl.value = qty; };
    qtyEl.addEventListener('input', ()=>{ const n = parseInt(qtyEl.value||'1', 10); qty = isNaN(n)?1:Math.max(1,Math.min(99,n)); qtyEl.value = qty; });
    $('#addtocart').onclick = ()=>{
      const cart = getCart(); cart[p.id] = (cart[p.id]||0) + qty; setCart(cart);
      alert('Added to cart');
    };
  }

  (async()=>{
    // Try backend first
    try{
      const res = await fetch(API(`/products`));
      if(res.ok){
        const list = await res.json();
        const prod = Array.isArray(list) ? list.find(x => (x._id||x.id) === id) : null;
        if(prod){
          const p = { id: prod._id||prod.id, title: prod.title, cat: prod.cat, price: prod.price, rating: prod.rating||0, img: prod.img, description: prod.description||'' };
          render(p);
          return;
        }
      }
    }catch{}
    // Fallback: try cached products in session from listing (optional) or show minimal
    const p = { id, title: 'Product', cat: '', price: 0, rating: 0, img: 'https://picsum.photos/seed/tidex-default/800/600', description: '' };
    render(p);
  })();

  // Reviews logic
  const reviewsEl = document.getElementById('reviews');
  const revForm = document.getElementById('rev-form');
  function getAuth(){ try{ const u = JSON.parse(localStorage.getItem(userKey)||'null'); return u && u.token ? { Authorization: `Bearer ${u.token}` } : {}; }catch{return {};}}
  async function loadReviews(){
    reviewsEl.innerHTML = '<p class="muted">Loading…</p>';
    try{
      const res = await fetch(API(`/products/${id}/reviews`));
      const list = res.ok ? await res.json() : [];
      if(!list.length){ reviewsEl.innerHTML = '<p class="muted">No reviews yet.</p>'; return; }
      reviewsEl.innerHTML = '';
      list.forEach(r=>{
        const box = document.createElement('div');
        box.className = 'auth-body'; box.style.padding='10px'; box.style.border='1px solid var(--border)'; box.style.borderRadius='10px'; box.style.marginBottom='10px';
        const replies = (r.replies||[]).map(rep=>`<div class="xs" style="margin-left:14px;margin-top:6px"><strong>${rep.userName||'User'}</strong>: ${rep.text}</div>`).join('');
        box.innerHTML = `<div><strong>${r.userName||'User'}</strong> <span class="muted xs">★ ${r.rating}</span><div>${r.text||''}</div>${replies}</div>
        <div class="row" style="gap:6px;margin-top:8px"><input class="input" data-reply="${r._id}" placeholder="Reply…" style="flex:1"><button class="btn" data-reply-send="${r._id}">Reply</button></div>`;
        reviewsEl.appendChild(box);
      });
    }catch{ reviewsEl.innerHTML = '<p class="muted">No reviews yet.</p>'; }
  }
  loadReviews();

  revForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const rating = parseInt(document.getElementById('rev-rating').value||'5', 10);
    const text = document.getElementById('rev-text').value.trim();
    if(!rating) return;
    try{
      const res = await fetch(API(`/products/${id}/reviews`), { method:'POST', headers: { 'Content-Type':'application/json', ...getAuth() }, body: JSON.stringify({ rating, text }) });
      if(!res.ok) throw 0; document.getElementById('rev-text').value=''; loadReviews();
    }catch{ alert('Sign in to post a review.'); }
  });

  document.addEventListener('click', async (e)=>{
    const rid = e.target.getAttribute && e.target.getAttribute('data-reply-send');
    if(!rid) return;
    const inp = document.querySelector(`input[data-reply="${rid}"]`);
    const text = (inp && inp.value.trim()) || '';
    if(!text) return;
    try{
      const res = await fetch(API(`/reviews/${rid}/replies`), { method:'POST', headers: { 'Content-Type':'application/json', ...getAuth() }, body: JSON.stringify({ text }) });
      if(!res.ok) throw 0; inp.value=''; loadReviews();
    }catch{ alert('Sign in to reply.'); }
  });
})();
