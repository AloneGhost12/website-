/* Simple demo auth with localStorage, animated feedback, and header user-chip */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const themeKey = 'tidex-theme';
  const userKey = 'tidex-user-v1';
  const API = (path) => `${localStorage.getItem('tidex-api') || 'http://localhost:3000'}/api${path}`;
  function getUser(){ try { return JSON.parse(localStorage.getItem(userKey)||'null'); } catch { return null; } }
  function setUser(u){ localStorage.setItem(userKey, JSON.stringify(u)); }
  function clearUser(){ localStorage.removeItem(userKey); }

  // Shared theme toggle
  const root = document.body;
  function setTheme(t){ root.classList.toggle('theme-light', t==='light'); localStorage.setItem(themeKey,t); }
  setTheme(localStorage.getItem(themeKey) || 'light');
  const tgl = document.getElementById('theme-toggle');
  if(tgl){
    // Ensure initial icon/state works across pages
    setTheme(localStorage.getItem(themeKey) || 'light');
    tgl.addEventListener('click', ()=>{ const next = root.classList.contains('theme-light') ? 'dark' : 'light'; setTheme(next); });
  }

  // Header user area (on index.html only)
  const userArea = $('#user-area');
  function renderUser(){
    if(!userArea) return;
    userArea.innerHTML = '';
    const u = getUser();
    if(!u){
      const link = document.createElement('a');
      link.className = 'link'; link.href = 'login.html'; link.textContent = 'Sign in';
      userArea.appendChild(link);
      return;
    }
    const chip = document.createElement('a');
    chip.className = 'user-chip fade-up';
    chip.href = 'account.html';
    chip.setAttribute('aria-label','Account');
  const pic = u.profilePicUrl || '';
  chip.innerHTML = `<span class="avatar" style="${pic?`background:transparent;`:''}">${pic?`<img src="${pic}" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover"/>`:''}</span><span>${u.name||u.email}</span>`;
  const profile = document.createElement('a'); profile.className='btn'; profile.textContent='Profile'; profile.href='account.html';
  const out = document.createElement('button'); out.className='btn'; out.textContent = 'Sign out';
    out.onclick = ()=>{ clearUser(); renderUser(); };
  userArea.appendChild(chip); userArea.appendChild(profile); userArea.appendChild(out);
  }
  renderUser();

  // Login page
  const loginForm = $('#login-form');
  if(loginForm){
    loginForm.addEventListener('submit', (e)=>{
      e.preventDefault();
  const identifier = ($('#identifier') && $('#identifier').value.trim()) || '';
      const password = $('#password').value;
      const err = $('#login-error');
      err.textContent = '';
      const btn = $('#login-btn');
      btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Signing in…';
      (async ()=>{
        try{
          const res = await fetch(API('/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
          const data = await res.json();
          if(!res.ok) throw new Error(data.error || 'Login failed');
          setUser(data);
          window.location.href = 'index.html';
        }catch(ex){
          // Fallback to demo if API not reachable
          if(!identifier || !password || password.length < 6){
            err.textContent = ex.message || 'Invalid credentials (min 6 char password).';
          } else {
            setUser({email: identifier, name: identifier.split('@')[0]});
            window.location.href = 'index.html';
          }
        } finally {
          btn.disabled = false; btn.textContent = txt;
        }
      })();
    });
    // Show/hide password toggle buttons
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-toggle="password"]');
      if(!btn) return;
      const id = btn.getAttribute('data-target');
      const input = document.getElementById(id);
      if(!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  // Signup page
  const signupForm = $('#signup-form');
  if(signupForm){
    signupForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const username = ($('#username') && $('#username').value.trim()) || '';
  const phone = ($('#phone') && $('#phone').value.trim()) || '';
      const pass = $('#password').value;
      const confirm = $('#confirm').value;
      const err = $('#signup-error');
      err.textContent = '';
      if(!name || !email || pass.length < 6){ err.textContent = 'Please fill all fields. Password must be at least 6 characters.'; return; }
      if(pass !== confirm){ err.textContent = 'Passwords do not match.'; return; }
      const btn = $('#signup-btn'); btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Creating…';
      (async ()=>{
        try{
          const res = await fetch(API('/auth/signup'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, username, phone, password: pass }) });
          const data = await res.json();
          if(!res.ok) throw new Error(data.error || 'Signup failed');
          setUser(data); window.location.href='index.html';
        }catch(ex){
          // Fallback to demo local sign-in
          setUser({ name, email }); window.location.href='index.html';
        } finally {
          btn.disabled = false; btn.textContent = txt;
        }
      })();
    });
    // Show/hide toggles on signup page
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-toggle="password"]');
      if(!btn) return;
      const id = btn.getAttribute('data-target');
      const input = document.getElementById(id);
      if(!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }
})();
