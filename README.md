# Thaanvikaa’s Smart Learning Ecosystem — GitHub Pages package
*Powered by G.V.R.M.Solutions*

This folder is a complete static website + installable app (PWA). Upload it to a GitHub repository and turn on GitHub Pages.

## 1. Publish on GitHub Pages (5 minutes)
1. Create a new repository on github.com (for example `thaanvikaa-learning`, **Public**).
2. Click **Add file → Upload files** and drag **everything inside this folder** (including the `icons` folder and the hidden `.nojekyll` file) → **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)** → **Save**.
4. After about a minute your app is live at  
   `https://YOUR-USERNAME.github.io/thaanvikaa-learning/`
5. On a phone (Chrome) open the link → menu → **Install app / Add to Home screen**. On Windows Chrome/Edge use the install icon in the address bar.

## 2. Files in this package
| File | Purpose |
|---|---|
| `index.html` | The complete app (all features, light/dark mode, Tamil/English) |
| `shim.js` | Runtime that gives the app its database, downloads and file storage outside Claude |
| `shim-config.js` | **The only file you normally edit** — chooses LOCAL or FIREBASE storage |
| `manifest.webmanifest`, `sw.js`, `icons/` | Install-as-app + offline support |
| `firestore.rules` | Security rules to paste into Firebase (Firebase mode only) |
| `.nojekyll` | Tells GitHub Pages to serve files as they are |

## 3. Choose how data is stored
### A) LOCAL mode (default — nothing to set up)
Data lives **inside the browser you use** (IndexedDB). Good for one teacher computer or a demo.  
⚠️ Every device/browser has its own separate data. Students on their own phones will **not** see the teacher’s data. Use *Settings → Backup* regularly.

### B) FIREBASE mode (shared data for teacher + students + parents)
1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started** and enable **Anonymous** and **Email/Password**.  
   In *Users* click **Add user** and create the teacher login (e-mail + password).
3. **Build → Firestore Database → Create database** (production mode, any region).  
   Open the **Rules** tab, paste the content of `firestore.rules` (change `teacher@example.com` to your teacher e-mail) → **Publish**.
4. **Project settings → General → Your apps → Web app (`</>`)** → register → copy the `firebaseConfig` values.
5. Open `shim-config.js` and fill it:
   ```js
   window.GVRM_CONFIG = {
     firebase: { apiKey: "…", authDomain: "…", projectId: "…", appId: "…" },
     teacherEmails: ["teacher@gmail.com"]
   };
   ```
6. In **Authentication → Settings → Authorized domains** add `YOUR-USERNAME.github.io`.
7. Upload the changed `shim-config.js` to GitHub (and bump `V = "gvrm-v1"` → `"gvrm-v2"` in `sw.js` so phones refresh).
8. Open the site → **Teacher** → **Sign in with teacher account** → e-mail + password. Everyone else (students/parents) just uses the normal Student/Parent login.

**Firebase mode — please know:**
* File uploads in *Notes* are switched off (Firestore is not a file store). Use Google Drive / YouTube links instead.
* A Firestore document can hold at most ~1 MB — keep student photos small.
* The app’s Student/Parent login compares against the student list inside the browser, so any visitor of your site can technically read that list. Do not put sensitive data in student records. Setting a teacher password in *Settings* adds an extra layer.
* Firebase has a free tier; check current limits at firebase.google.com/pricing.

## 4. Updating the app later
Replace `index.html` (and/or `shim-config.js`) in the repository and change the `V` number in `sw.js`. Phones will pick up the new version on the next open.

## 5. Notes
* The built-in teacher subscription/trial logic of the app is unchanged.
* Fonts (Inter, Playfair Display, Noto Sans Tamil) load from Google Fonts when online; the app falls back to system fonts offline.
* Admission number / Student ID + registered mobile number is how students and parents sign in.
