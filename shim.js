/*!
 * shim.js — standalone runtime for Thaanvikaa’s Smart Learning Ecosystem
 * Provides window.claude.use("db" | "user" | "downloads" | "assets") outside Claude.
 *
 *  LOCAL mode    (default)  : data is stored in this browser / app (IndexedDB). No server needed.
 *  FIREBASE mode (optional) : set GVRM_CONFIG.firebase in shim-config.js. Shared data across devices,
 *                             teacher signs in with Firebase email + password, everyone else is anonymous.
 */
(function () {
  "use strict";
  var CFG = window.GVRM_CONFIG || {};
  var FB = CFG.firebase && CFG.firebase.apiKey && CFG.firebase.projectId ? CFG.firebase : null;
  var TEACHERS = (CFG.teacherEmails || []).map(function (e) { return String(e).trim().toLowerCase(); });
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function rnd() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  /* ---------------- downloads (both modes) ---------------- */
  function mimeFor(n) {
    var e = String(n || "").split(".").pop().toLowerCase();
    return ({ html: "text/html;charset=utf-8", csv: "text/csv;charset=utf-8", json: "application/json", pdf: "application/pdf", txt: "text/plain;charset=utf-8" })[e] || "application/octet-stream";
  }
  var downloads = {
    save: function (o) {
      var d = o.data, b = d instanceof Blob ? d : new Blob([d], { type: mimeFor(o.filename) });
      var u = URL.createObjectURL(b), a = document.createElement("a");
      a.href = u; a.download = o.filename || "download";
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 2000);
      return Promise.resolve(true);
    }
  };

  /* ---------------- LOCAL storage (IndexedDB, memory fallback) ---------------- */
  var mem = { docs: {}, blobs: {} }, idbp = null;
  function idb() {
    if (idbp) return idbp;
    idbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      var r = indexedDB.open("gvrm-local", 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "k" });
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs", { keyPath: "id" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    }).catch(function () { return null; });
    return idbp;
  }
  function req(store, mode, fn) {
    return idb().then(function (d) {
      if (!d) return null;
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out = fn(t.objectStore(store));
        t.oncomplete = function () { res(out && "result" in out ? out.result : undefined); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function kvAll(col) {
    return idb().then(function (d) {
      if (!d) return Object.keys(mem.docs).filter(function (k) { return k.indexOf(col + "/") === 0; }).map(function (k) { return mem.docs[k]; });
      return req("docs", "readonly", function (s) { return s.getAll(IDBKeyRange.bound(col + "/", col + "/\uffff")); });
    });
  }
  function kvGet(col, id) {
    return idb().then(function (d) {
      if (!d) return mem.docs[col + "/" + id];
      return req("docs", "readonly", function (s) { return s.get(col + "/" + id); });
    });
  }
  function kvPut(col, id, data) {
    var row = { k: col + "/" + id, col: col, id: id, data: clone(data) };
    return idb().then(function (d) {
      if (!d) { mem.docs[row.k] = row; return; }
      return req("docs", "readwrite", function (s) { return s.put(row); });
    });
  }
  function kvDel(col, id) {
    return idb().then(function (d) {
      if (!d) { delete mem.docs[col + "/" + id]; return; }
      return req("docs", "readwrite", function (s) { return s.delete(col + "/" + id); });
    });
  }
  var listeners = {}, bc = null;
  try { bc = "BroadcastChannel" in window ? new BroadcastChannel("gvrm-db") : null; } catch (e) { bc = null; }
  function emit(col) { (listeners[col] || []).slice().forEach(function (f) { f(); }); }
  if (bc) bc.onmessage = function (e) { emit(e.data); };
  function changed(col) { emit(col); if (bc) bc.postMessage(col); }
  function listen(col, run) {
    (listeners[col] = listeners[col] || []).push(run);
    run();
    return function () { listeners[col] = listeners[col].filter(function (f) { return f !== run; }); };
  }
  var localDB = {
    collection: function (col) {
      return {
        onSnapshot: function (cb, err) {
          var alive = true;
          return listen(col, function () {
            kvAll(col).then(function (rows) {
              if (!alive) return;
              cb({ docs: (rows || []).map(function (r) { return { id: r.id, data: function () { return clone(r.data); } }; }) });
            }).catch(function (e) { if (err) err(e); });
          });
        },
        doc: function (id) {
          return {
            set: function (data) { return kvPut(col, id, data).then(function () { changed(col); }); },
            delete: function () { return kvDel(col, id).then(function () { changed(col); }); },
            get: function () { return kvGet(col, id).then(function (r) { return { id: id, exists: !!r, data: function () { return r ? clone(r.data) : undefined; } }; }); },
            onSnapshot: function (cb, err) {
              return listen(col, function () {
                kvGet(col, id).then(function (r) { cb({ id: id, exists: !!r, data: function () { return r ? clone(r.data) : undefined; } }); })
                  .catch(function (e) { if (err) err(e); });
              });
            }
          };
        }
      };
    }
  };
  var localAssets = {
    upload: function (file) {
      var id = rnd();
      return idb().then(function (d) {
        if (!d) { mem.blobs[id] = file; return { id: id }; }
        return req("blobs", "readwrite", function (s) { return s.put({ id: id, name: file.name, type: file.type, blob: file }); }).then(function () { return { id: id }; });
      });
    },
    delete: function (id) {
      return idb().then(function (d) {
        if (!d) { delete mem.blobs[id]; return; }
        return req("blobs", "readwrite", function (s) { return s.delete(id); });
      });
    },
    url: function (id) {
      return idb().then(function (d) {
        if (!d) return mem.blobs[id] ? URL.createObjectURL(mem.blobs[id]) : Promise.reject(new Error("missing"));
        return req("blobs", "readonly", function (s) { return s.get(id); }).then(function (r) {
          if (!r) throw new Error("missing");
          return URL.createObjectURL(r.blob);
        });
      });
    }
  };
  function localUser() {
    var id;
    try { id = localStorage.getItem("gvrm-uid"); if (!id) { id = "local-" + rnd(); localStorage.setItem("gvrm-uid", id); } } catch (e) { id = "local-session"; }
    return { canEdit: function () { return Promise.resolve(true); }, id: function () { return Promise.resolve(id); } };
  }

  /* ---------------- FIREBASE mode (optional) ---------------- */
  var fbp = null, fs = null, auth = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  function fbInit() {
    if (fbp) return fbp;
    var b = "https://www.gstatic.com/firebasejs/10.12.2/";
    fbp = loadScript(b + "firebase-app-compat.js")
      .then(function () { return Promise.all([loadScript(b + "firebase-auth-compat.js"), loadScript(b + "firebase-firestore-compat.js")]); })
      .then(function () {
        firebase.initializeApp(FB);
        auth = firebase.auth(); fs = firebase.firestore();
        fs.settings({ ignoreUndefinedProperties: true });
        return new Promise(function (res) { var un = auth.onAuthStateChanged(function (u) { un(); res(u); }); });
      })
      .then(function (u) { return u || auth.signInAnonymously(); });
    return fbp;
  }
  function isTeacherUser(u) { return !!(u && !u.isAnonymous && u.email && TEACHERS.indexOf(u.email.toLowerCase()) >= 0); }
  function fbUser() {
    return {
      canEdit: function () { return fbInit().then(function () { return isTeacherUser(auth.currentUser); }); },
      id: function () { return fbInit().then(function () { return auth.currentUser.uid; }); }
    };
  }
  function teacherSignIn() {
    if (document.getElementById("gvrm-si")) return;
    var o = document.createElement("div"); o.id = "gvrm-si";
    o.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(20,2,4,.65);display:grid;place-items:center;font-family:Inter,system-ui,sans-serif";
    o.innerHTML = '<form style="background:#fff;color:#111;border-radius:16px;padding:22px;width:min(92vw,360px);box-shadow:0 20px 60px rgba(0,0,0,.4)"><h3 style="margin:0 0 4px;color:#5e070f">Teacher sign-in</h3><p style="margin:0 0 12px;font-size:13px;color:#666">Use the teacher e-mail and password created in Firebase.</p><input name="e" type="email" placeholder="Email" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:11px;margin-bottom:8px;border:1px solid #ccc;border-radius:10px"><input name="p" type="password" placeholder="Password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;padding:11px;margin-bottom:8px;border:1px solid #ccc;border-radius:10px"><div id="gvrm-si-err" style="color:#c62828;font-size:13px;min-height:18px"></div><div style="display:flex;gap:8px;margin-top:6px"><button type="submit" style="flex:1;padding:11px;border:0;border-radius:10px;background:#8a0b1e;color:#fff;font-weight:700;cursor:pointer">Sign in</button><button type="button" id="gvrm-si-x" style="padding:11px 16px;border:1px solid #ccc;border-radius:10px;background:#fff;cursor:pointer">Cancel</button></div></form>';
    document.body.appendChild(o);
    var f = o.querySelector("form"), er = o.querySelector("#gvrm-si-err");
    o.querySelector("#gvrm-si-x").onclick = function () { o.remove(); };
    f.onsubmit = function (ev) {
      ev.preventDefault(); er.textContent = "Signing in…";
      fbInit().then(function () { return auth.signInWithEmailAndPassword(f.e.value.trim(), f.p.value); })
        .then(function () {
          if (!isTeacherUser(auth.currentUser)) { er.textContent = "This account is not in teacherEmails (shim-config.js)."; return auth.signOut(); }
          location.reload();
        }).catch(function (e) { er.textContent = e.message || "Sign-in failed"; });
    };
  }
  if (FB) {
    window.GVRM_teacherSignIn = teacherSignIn;
    window.GVRM_afterLogout = function () {
      if (auth && auth.currentUser && !auth.currentUser.isAnonymous) auth.signOut().then(function () { location.reload(); });
    };
  }

  /* ---------------- window.claude ---------------- */
  window.GVRM_MODE = FB ? "firebase" : "local";
  window.claude = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "user") return Promise.resolve(FB ? fbUser() : localUser());
      if (name === "db") {
        if (!FB) return Promise.resolve(localDB);
        return fbInit().then(function () { return { collection: function (c) { return fs.collection(c); } }; });
      }
      if (name === "assets") return Promise.resolve(FB ? null : localAssets); /* Firebase mode: use links instead of uploads */
      return Promise.resolve(null);
    }
  };
})();
