// Shared state via Firebase (Google sign-in + Realtime Database).
// Exposes a tiny `Sync` API used by app.js. If FIREBASE_CONFIG is null the
// page runs local-only and every call here is a no-op.
const Sync = (() => {
  'use strict';
  const enabled = typeof FIREBASE_CONFIG === 'object' && FIREBASE_CONFIG !== null && typeof firebase !== 'undefined';
  let ref = null;
  let handlers = { onData: () => {}, onAuth: () => {} };

  function stop() {
    if (ref) { ref.off(); ref = null; }
  }

  function listen() {
    stop();
    ref = firebase.database().ref(`groups/${GROUP_ID}/plan`);
    ref.on('value',
      snap => handlers.onData(snap.val()),
      err => {
        stop();
        handlers.onAuth(err && err.code === 'PERMISSION_DENIED' ? 'denied' : 'error', firebase.auth().currentUser, err);
      });
  }

  function start(h) {
    handlers = { ...handlers, ...h };
    if (!enabled) { handlers.onAuth('local'); return; }
    firebase.initializeApp(FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(user => {
      if (user) { handlers.onAuth('signed-in', user); listen(); }
      else { stop(); handlers.onAuth('signed-out'); }
    });
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await firebase.auth().signInWithPopup(provider);
    } catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        await firebase.auth().signInWithRedirect(provider);
      } else if (!e || e.code !== 'auth/popup-closed-by-user') {
        handlers.onAuth('error', null, e);
      }
    }
  }

  function signOut() { return firebase.auth().signOut(); }

  function save(data) {
    if (!ref) return Promise.resolve();
    return ref.set(data).catch(err => handlers.onAuth('error', firebase.auth().currentUser, err));
  }

  return { enabled, start, signIn, signOut, save };
})();
