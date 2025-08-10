/* Tidex Admin UI: products, users, orders CRUD via API with Admin Key */
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const API_BASE = localStorage.getItem('tidex-api') || 'http://localhost:3000';
  const ADMIN_KEY = localStorage.getItem('tidex-admin-key') || '';
  function api(path, opts={}){
    return fetch(`${API_BASE}/api${path}`, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY, ...(opts.headers||{}) } })
      .then(async res => {
        if(res.status === 401 || res.status === 403){
          // bubble a special error to trigger redirect
          const err = new Error('unauthorized'); err.code = res.status; err.res = res; throw err;
        }
        return res;
      });
  }
  function money(n){ return `$${(n||0).toFixed(2)}`; }
  function fmtDate(s){ return new Date(s).toLocaleString(); }

  if(!ADMIN_KEY){
    alert('Please login as admin');
    location.href = 'admin-login.html';
    return;
  }

  // Tabs
  $$('.tab').forEach(t=> t.addEventListener('click', ()=>{
    $$('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const id = t.getAttribute('data-tab');
    ['products','users','orders'].forEach(n=> $('#tab-'+n).style.display = (n===id?'block':'none'));
  }));

  $('#logout').onclick = ()=>{ localStorage.removeItem('tidex-admin-key'); location.href='admin-login.html'; };

  async function loadProducts(){
    const res = await api('/products');
    const data = await res.json();
    const tbody = $('#products-table tbody');
    tbody.innerHTML = '';
    data.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.title}</td><td>${p.cat}</td><td>${money(p.price)}</td><td>${p.stock||0}</td>
        <td class="actions"><button data-del="${p._id}" class="btn">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    $('#kpi-products').textContent = data.length;
    document.addEventListener('click', async (e)=>{
      const id = e.target.getAttribute && e.target.getAttribute('data-del');
      if(!id) return;
      if(!confirm('Delete this product?')) return;
      const r = await api(`/admin/products/${id}`, { method:'DELETE' });
      if(r.ok) loadProducts();
    });
  }

  $('#add-product').onclick = async ()=>{
    const title = $('#p-title').value.trim();
    const cat = $('#p-cat').value.trim();
    const price = parseFloat($('#p-price').value||'0');
    const stock = parseInt($('#p-stock').value||'0');
    const img = $('#p-img').value.trim();
    const description = $('#p-desc').value.trim();
    if(!title||!cat||isNaN(price)) return alert('Title, Category, Price required');
    const res = await api('/admin/products', { method:'POST', body: JSON.stringify({ title, cat, price, stock, img, description }) });
    if(!res.ok){ const d = await res.json(); alert(d.error||'Failed'); return; }
    $('#p-title').value = $('#p-cat').value = $('#p-price').value = $('#p-stock').value = $('#p-img').value = $('#p-desc').value = '';
    loadProducts();
  };

  async function loadUsers(){
    const res = await api('/admin/users');
    const users = await res.json();
    $('#kpi-users').textContent = users.length;
    const tbody = $('#users-table tbody'); tbody.innerHTML='';
    users.forEach(u=>{
      const status = u.banned ? (u.banUntil ? `Temp until ${fmtDate(u.banUntil)}` : 'Banned') : 'Active';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.name||''}</td><td>${u.email}</td><td>${status}</td><td>${fmtDate(u.createdAt)}</td>
      <td class="actions">
        <button class="btn" data-act="ban" data-id="${u.id}">Ban</button>
        <button class="btn" data-act="temp" data-id="${u.id}">Temp Ban</button>
        <button class="btn" data-act="unban" data-id="${u.id}">Unban</button>
        <button class="btn" data-del-user="${u.id}">Delete</button>
      </td>`;
      tbody.appendChild(tr);
    });

    document.addEventListener('click', async (e)=>{
      const id = e.target.getAttribute && e.target.getAttribute('data-id');
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if(id && act){
        const payload = { action: act };
        if(act==='temp'){
          const days = parseInt(prompt('Temp ban days?', '7')||'7', 10);
          payload.until = new Date(Date.now()+days*24*3600*1000).toISOString();
        }
        const r = await api(`/admin/users/${id}/ban`, { method:'PATCH', body: JSON.stringify(payload) });
        if(r.ok) loadUsers();
      }
      const delId = e.target.getAttribute && e.target.getAttribute('data-del-user');
      if(delId){
        if(!confirm('Delete user?')) return;
        const r = await api(`/admin/users/${delId}`, { method:'DELETE' });
        if(r.ok) loadUsers();
      }
    });
  }

  async function loadOrders(){
    const res = await api('/admin/orders');
    const orders = await res.json();
    $('#kpi-orders').textContent = orders.length;
    let sum = 0;
    const tbody = $('#orders-table tbody'); tbody.innerHTML='';
    orders.forEach(o=>{ sum += o.subtotal||0; const items = (o.items||[]).map(i=>`${i.title} x${i.qty}`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${o._id}</td><td>${o.userId||''}</td><td>${items}</td><td>${money(o.subtotal)}</td>
      <td><select data-order="${o._id}"><option ${o.status==='pending'?'selected':''}>pending</option><option ${o.status==='paid'?'selected':''}>paid</option><option ${o.status==='shipped'?'selected':''}>shipped</option><option ${o.status==='cancelled'?'selected':''}>cancelled</option></select></td>
      <td>${fmtDate(o.updatedAt)}</td>`;
      tbody.appendChild(tr);
    });
    $('#kpi-rev').textContent = money(sum);

    document.addEventListener('change', async (e)=>{
      const id = e.target.getAttribute && e.target.getAttribute('data-order');
      if(!id) return;
      const status = e.target.value;
      const r = await api(`/admin/orders/${id}`, { method:'PATCH', body: JSON.stringify({ status }) });
      if(r.ok) loadOrders();
    });
  }

  async function init(){
    try{
      await Promise.all([loadProducts(), loadUsers(), loadOrders()]);
    }catch(e){
      if(e && (e.code === 401 || e.code === 403)){
        alert('Please login as admin');
        localStorage.removeItem('tidex-admin-key');
        location.href = 'admin-login.html';
        return;
      }
      alert('Admin API error. Check ADMIN_KEY and server status.');
    }
  }
  init();
})();
