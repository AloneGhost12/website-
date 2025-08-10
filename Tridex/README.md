# Tidex — Beautiful shopping frontend

A modern, responsive, accessible static storefront for Tidex. Includes:

- Hero section with branding
- Category filters, search (press `/`), and sorting
- Product grid with sample items
- Cart drawer with quantity controls and subtotal (persisted via localStorage)
- Light/dark theme toggle
 - Beautiful Login and Signup pages with subtle animations

## Run
Just open `index.html` in your browser, or serve the folder.

### Optional: local server (recommended for caching)

```powershell
# Windows PowerShell
# Serve on http://localhost:5500 using Python (if installed)
python -m http.server 5500
```

Then visit `http://localhost:5500` and open `index.html`.

## Backend API (MongoDB)
This repo includes a tiny Node.js/Express API to store users and newsletter emails in MongoDB.

1) Copy `.env.example` to `.env` and set your connection string:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_DB=tidex
PORT=3000
```

2) Install and run the API:

```powershell
cd server
npm install
npm run start
```

3) Point the frontend to the API (optional if using default localhost:3000):

```powershell
# In the browser devtools console or adjust in code
localStorage.setItem('tidex-api', 'http://localhost:3000')
```

The login/signup and newsletter forms will call the API automatically, with a graceful fallback to local demo behavior if the API is offline.

## Customize
- Edit `script.js` — replace `sample` array with your real products (id, title, cat, price, rating, img).
- Update colors or spacing in `styles.css`.
- Replace `assets/logo.svg` with your logo.
 - Update auth flows in `auth.js` if connecting to a backend. Currently uses localStorage for demo only.
 - Server code lives under `server/` (Express + Mongoose). Adjust schemas and routes as needed.

## Notes
- No build step required. Pure HTML/CSS/JS.
- All state is client-side; integrate your backend/cart API later as needed.
