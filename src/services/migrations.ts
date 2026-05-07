import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export async function runMigrations(userId: string): Promise<void> {
  await migrateDefenceSkill(userId);
  await migrateWoodworkingToConstruction(userId);
  await migrateKayakingToSailing(userId);
}

// Renames the skill document 'Defense' → 'Defence' and updates all references.
// Safe to call multiple times — exits immediately if Defense doc no longer exists.
async function migrateDefenceSkill(userId: string): Promise<void> {
  const oldRef = doc(db, 'users', userId, 'skills', 'Defense');
  const oldSnap = await getDoc(oldRef);
  if (!oldSnap.exists()) return;

  const batch = writeBatch(db);

  // Copy skill doc to new name
  const newRef = doc(db, 'users', userId, 'skills', 'Defence');
  batch.set(newRef, { ...oldSnap.data(), skillName: 'Defence' });
  batch.delete(oldRef);

  // Update userActivities referencing Defense
  const activitiesSnap = await getDocs(
    query(collection(db, 'users', userId, 'userActivities'), where('skillId', '==', 'Defense'))
  );
  activitiesSnap.forEach(d => batch.update(d.ref, { skillId: 'Defence' }));

  // Update activity_completions referencing Defense
  const completionsSnap = await getDocs(
    query(collection(db, 'users', userId, 'activity_completions'), where('skillId', '==', 'Defense'))
  );
  completionsSnap.forEach(d => batch.update(d.ref, { skillId: 'Defence' }));

  await batch.commit();
  console.log(`✅ Migration: Defense → Defence complete for user ${userId}`);
}

// Moves the Woodworking activity from Smithing → Construction.
// Only targets docs where activityTemplateId/activityId === 'woodworking' to avoid
// touching Metalworking and Leatherworking which legitimately belong to Smithing.
async function migrateWoodworkingToConstruction(userId: string): Promise<void> {
  const batch = writeBatch(db);
  let changes = 0;

  // userActivities — update skillId where this is the woodworking template
  const activitiesSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'userActivities'),
      where('activityTemplateId', '==', 'woodworking'),
      where('skillId', '==', 'Smithing')
    )
  );
  activitiesSnap.forEach(d => { batch.update(d.ref, { skillId: 'Construction' }); changes++; });

  // activity_completions — update skillId for woodworking completions
  const completionsSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'activity_completions'),
      where('activityId', '==', 'woodworking'),
      where('skillId', '==', 'Smithing')
    )
  );
  completionsSnap.forEach(d => { batch.update(d.ref, { skillId: 'Construction' }); changes++; });

  if (changes === 0) return;
  await batch.commit();
  console.log(`✅ Migration: Woodworking Smithing → Construction (${changes} docs) for user ${userId}`);
}

// Moves Kayaking from Fishing → Sailing.
async function migrateKayakingToSailing(userId: string): Promise<void> {
  const batch = writeBatch(db);
  let changes = 0;

  const activitiesSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'userActivities'),
      where('activityTemplateId', '==', 'kayaking'),
      where('skillId', '==', 'Fishing')
    )
  );
  activitiesSnap.forEach(d => { batch.update(d.ref, { skillId: 'Sailing' }); changes++; });

  const completionsSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'activity_completions'),
      where('activityId', '==', 'kayaking'),
      where('skillId', '==', 'Fishing')
    )
  );
  completionsSnap.forEach(d => { batch.update(d.ref, { skillId: 'Sailing' }); changes++; });

  if (changes === 0) return;
  await batch.commit();
  console.log(`✅ Migration: Kayaking Fishing → Sailing (${changes} docs) for user ${userId}`);
}
