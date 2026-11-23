/* shim-config.js — choose how the app stores data.
 *
 * 1) LOCAL mode (default): leave  firebase: null
 *    Data is saved only in the browser / Windows app you are using. Good for a single teacher computer.
 *
 * 2) FIREBASE mode: paste your Firebase web-app config and list teacher e-mails.
 *    Data is shared across all devices (teacher + students + parents). See README.md → "Firebase setup".
 */
window.GVRM_CONFIG = {
  firebase: null,
  /* firebase: {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       projectId: "YOUR_PROJECT",
       appId: "YOUR_APP_ID"
     }, */
  teacherEmails: []   /* example: ["teacher@gmail.com"] (must match the e-mail you create in Firebase Auth) */
};
