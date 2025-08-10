// Tidex Forgot Password JS
(function(){
  const API = (path) => `${localStorage.getItem('tidex-api') || 'http://localhost:3000'}/api${path}`;
  const form = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');
  const msg = document.getElementById('fp-msg');
  let email = '';
  form.onsubmit = async function(e){
    e.preventDefault();
    email = document.getElementById('email').value.trim();
    msg.textContent = '';
    if(!email) return msg.textContent = 'Enter your registered email.';
    try {
      const res = await fetch(API('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Failed to send OTP');
      form.style.display = 'none';
      resetForm.style.display = '';
      msg.style.color = '#2a5';
      msg.textContent = 'OTP sent to your email.';
    } catch(err) {
      msg.style.color = '#e66';
      msg.textContent = err.message || 'Failed to send OTP.';
    }
  };
  resetForm.onsubmit = async function(e){
    e.preventDefault();
    const otp = document.getElementById('otp').value.trim();
    const newpass = document.getElementById('newpass').value;
    msg.textContent = '';
    if(!otp || !newpass) return msg.textContent = 'Enter OTP and new password.';
    try {
      const res = await fetch(API('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword: newpass })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Failed to reset password');
      resetForm.style.display = 'none';
      msg.style.color = '#2a5';
      msg.textContent = 'Password reset! You can now log in.';
    } catch(err) {
      msg.style.color = '#e66';
      msg.textContent = err.message || 'Failed to reset password.';
    }
  };
})();
