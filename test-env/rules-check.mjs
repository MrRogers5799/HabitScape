// Checks firestore.rules against the local emulators. Never touches production:
// the demo- project ID can only exist in the emulator.
// Run: npx firebase-tools@15.34.0 emulators:exec --only auth,firestore --project demo-habitscape "node test-env/rules-check.mjs"
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, writeBatch, deleteDoc,
} from 'firebase/firestore';

const PROJECT = 'demo-habitscape';

async function client(name, email) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  let uid = null;
  if (email) uid = (await createUserWithEmailAndPassword(auth, email, 'test-only-pw-123')).user.uid;
  return { db, uid };
}

let failed = 0;
async function expect(label, shouldAllow, fn) {
  let allowed = true;
  try { await fn(); } catch (e) {
    if (!String(e?.code ?? e).includes('permission-denied')) { console.log(`ERROR ${label}: ${e}`); failed++; return; }
    allowed = false;
  }
  const ok = allowed === shouldAllow;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${shouldAllow ? 'allow' : 'deny '}  ${label}`);
}

const A = await client('a', 'a@rules.test');
const B = await client('b', 'b@rules.test');
const anon = await client('anon', null);

await expect('A creates own profile + skills in one batch (sign-up)', true, () => {
  const b = writeBatch(A.db);
  b.set(doc(A.db, 'users', A.uid), { uid: A.uid, email: 'a@rules.test', displayName: '' });
  b.set(doc(A.db, 'users', A.uid, 'skills', 'Magic'), { skillName: 'Magic', totalXP: 0, level: 1 });
  return b.commit();
});
await expect('A reads own profile', true, () => getDoc(doc(A.db, 'users', A.uid)));
await expect('A updates own display name', true, () => updateDoc(doc(A.db, 'users', A.uid), { displayName: 'A' }));
await expect('A writes own completion', true, () => setDoc(doc(A.db, 'users', A.uid, 'activity_completions', 'c1'), { activityId: 'x' }));
await expect('A changes the uid field on own profile', false, () => updateDoc(doc(A.db, 'users', A.uid), { uid: B.uid }));
await expect('A creates a profile under B', false, () => setDoc(doc(A.db, 'users', B.uid), { uid: B.uid }));
await expect('B reads A profile', false, () => getDoc(doc(B.db, 'users', A.uid)));
await expect('B reads A skills', false, () => getDocs(collection(B.db, 'users', A.uid, 'skills')));
await expect('B writes A skill XP', false, () => setDoc(doc(B.db, 'users', A.uid, 'skills', 'Magic'), { totalXP: 999999 }));
await expect('signed-out reads A profile', false, () => getDoc(doc(anon.db, 'users', A.uid)));

// Adventure (beta) game layer
const adv = (rev, extra = {}) => ({
  schemaVersion: 1, rev, xp: { Mining: 0 }, bank: { bronze_pickaxe: 1 },
  time: { bankHours: 4, weekId: '2026-11-16', weekEarnedHours: 4 },
  quests: {}, kills: {}, dryKills: {}, lamps: [], activeTripId: null, ...extra,
});
const advRef = (c, uid) => doc(c.db, 'users', uid, 'game', 'adventurer');
const trip = (legs = 1, extra = {}) => ({
  schemaVersion: 1, startMs: 1763539200000, nextChunk: 0, done: false, finishedMs: null, seenMs: null,
  legs: Array.from({ length: legs }, () => ({ activityId: 'mine-copper', regionId: 'millbrook', hours: 1, chunksDone: 0, refundedHours: 0, ended: false })),
  report: { xp: {}, gained: {} }, ...extra,
});
await expect('A opts in to the adventure beta on own profile', true, () => updateDoc(doc(A.db, 'users', A.uid), { adventureBeta: true }));
await expect('A creates own adventurer at rev 0', true, () => setDoc(advRef(A, A.uid), adv(0)));
await expect('A saves the next rev', true, () => setDoc(advRef(A, A.uid), adv(1, { activeTripId: 't1' })));
await expect('A saves a stale rev (same number)', false, () => setDoc(advRef(A, A.uid), adv(1)));
await expect('A skips a rev', false, () => setDoc(advRef(A, A.uid), adv(3)));
await expect('A adds an unknown field', false, () => setDoc(advRef(A, A.uid), adv(2, { cheat: true })));
await expect('A saves a bank that is not a map', false, () => setDoc(advRef(A, A.uid), adv(2, { bank: 'lots' })));
await expect('A creates a second game document', false, () => setDoc(doc(A.db, 'users', A.uid, 'game', 'other'), adv(0)));
await expect('B reads A adventurer', false, () => getDoc(advRef(B, A.uid)));
await expect('B writes A adventurer', false, () => setDoc(advRef(B, A.uid), adv(2)));
await expect('A writes own trip', true, () => setDoc(doc(A.db, 'users', A.uid, 'trips', 't1'), trip(3)));
await expect('A updates own trip progress', true, () => setDoc(doc(A.db, 'users', A.uid, 'trips', 't1'), trip(3, { nextChunk: 2 })));
await expect('A writes a trip with 4 legs', false, () => setDoc(doc(A.db, 'users', A.uid, 'trips', 't2'), trip(4)));
await expect('A writes a trip with no legs', false, () => setDoc(doc(A.db, 'users', A.uid, 'trips', 't3'), trip(0)));
await expect('B reads A trips', false, () => getDocs(collection(B.db, 'users', A.uid, 'trips')));
await expect('A deletes own trip and adventurer (account deletion)', true, async () => {
  await deleteDoc(doc(A.db, 'users', A.uid, 'trips', 't1'));
  await deleteDoc(advRef(A, A.uid));
});

const share = { templates: [{ name: 'Push', exercises: [] }], createdBy: A.uid };
await expect('A shares templates', true, () => setDoc(doc(A.db, 'sharedTemplates', 'ABC234'), share));
await expect('B imports by code', true, () => getDoc(doc(B.db, 'sharedTemplates', 'ABC234')));
await expect('B lists all share codes', false, () => getDocs(collection(B.db, 'sharedTemplates')));
await expect('B overwrites A share', false, () => setDoc(doc(B.db, 'sharedTemplates', 'ABC234'), { ...share, createdBy: B.uid }));
await expect('B deletes A share', false, () => deleteDoc(doc(B.db, 'sharedTemplates', 'ABC234')));
await expect('A shares pretending to be B', false, () => setDoc(doc(A.db, 'sharedTemplates', 'XYZ789'), { ...share, createdBy: B.uid }));
await expect('A shares with a bad code length', false, () => setDoc(doc(A.db, 'sharedTemplates', 'TOOLONGCODE'), share));
await expect('signed-out reads a share', false, () => getDoc(doc(anon.db, 'sharedTemplates', 'ABC234')));
await expect('A deletes own share', true, () => deleteDoc(doc(A.db, 'sharedTemplates', 'ABC234')));
await expect('A deletes own profile (account deletion)', true, () => deleteDoc(doc(A.db, 'users', A.uid)));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll rules checks passed');
process.exit(failed ? 1 : 0);
