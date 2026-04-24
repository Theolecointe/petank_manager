const { initializeApp } = require('firebase/app');
const { getFirestore, writeBatch, doc } = require('firebase/firestore');
const aiStudioConfig = require('./firebase-applet-config.json');

const app = initializeApp(aiStudioConfig);
const db = getFirestore(app, aiStudioConfig.firestoreDatabaseId);

async function testMatch() {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'matches', 'test_123'));
  batch.set(doc(db, 'matches', 'test_124'), {
    id: 'test_124',
    type: "pool",
    poolName: "A",
    team1: "team_1",
    team2: "team_2",
    score1: null,
    score2: null,
    status: "pending",
    startedAt: null,
    terrain: 1
  });
  batch.update(doc(db, 'state', 'main'), { pools: { A: ["team_1", "team_2"] }, bracket: null });
  
  try {
    await batch.commit();
    console.log("MATCH SUCCESS");
  } catch (e) {
    console.error("MATCH FAIL: ", e.message);
  }
}
testMatch();
