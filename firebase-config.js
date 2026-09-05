// Firebase web config — paste the object from
// Firebase console → Project settings → Your apps → Web app → "Config".
// Web API keys are not secrets: access is enforced by Google sign-in plus
// the rules in firebase/database.rules.json. Leave as-is to run local-only.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD3k7uEqYR5aSQkLd35849qcSaTannoce0',
  authDomain: 'naama-s-dinner.firebaseapp.com',
  projectId: 'naama-s-dinner',
  appId: '1:225786167807:web:938c0cdb65ef015dff67ca',
  // Realtime Database URL (shown at the top of the Data tab in the console).
  databaseURL: 'https://naama-s-dinner-default-rtdb.europe-west1.firebasedatabase.app',
};

// Which shared plan this page shows. Members are managed in the database
// under groups/<GROUP_ID>/members, in the Firebase console only.
const GROUP_ID = 'family';
