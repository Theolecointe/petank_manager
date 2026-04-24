const { initializeApp } = require('firebase/app');
const { getFirestore, writeBatch, doc } = require('firebase/firestore');
const aiStudioConfig = require('./firebase-applet-config.json');

const app = initializeApp(aiStudioConfig);
const db = getFirestore(app, aiStudioConfig.firestoreDatabaseId);

async function runTests() {
  // Test 1: delete match
  try {
    const b1 = writeBatch(db);
    b1.delete(doc(db, 'matches', 'test_123'));
    await b1.commit();
    console.log("TEST 1 (delete) SUCCESS");
  } catch(e) { console.error("TEST 1 FAIL: ", e.message); }

  // Test 2: set match
  try {
    const b2 = writeBatch(db);
    b2.set(doc(db, 'matches', 'test_124'), { status: "pending" });
    await b2.commit();
    console.log("TEST 2 (set) SUCCESS");
  } catch(e) { console.error("TEST 2 FAIL: ", e.message); }

  // Test 3: update state
  try {
    const b3 = writeBatch(db);
    b3.update(doc(db, 'state', 'main'), { pools: {} });
    await b3.commit();
    console.log("TEST 3 (update) SUCCESS");
  } catch(e) { console.error("TEST 3 FAIL: ", e.message); }
}
runTests();
