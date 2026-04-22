import { writeBatch, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generateId } from '../hooks/useTournament';

export async function executeGeneratePools(teams: any[], matches: any[], pools: any, teamsPerPool: number) {
  const batch = writeBatch(db);
  
  // Clear old matches
  matches.forEach(m => batch.delete(doc(db, 'matches', m.id)));

  // Shuffle teams
  const shuffled = [...teams].sort(() => 0.5 - Math.random());
  const newPools: any = {};
  
  let currentPoolCharCode = 65; // 'A'
  
  for (let i = 0; i < shuffled.length; i += teamsPerPool) {
    const chunk = shuffled.slice(i, i + teamsPerPool);
    const poolName = String.fromCharCode(currentPoolCharCode);
    newPools[poolName] = chunk.map(t => t.id);
    
    // Generate Round Robin matches for this pool
    for (let j = 0; j < chunk.length; j++) {
      for (let k = j + 1; k < chunk.length; k++) {
        const mId = generateId();
        batch.set(doc(db, 'matches', mId), {
          id: mId,
          type: "pool",
          poolName: poolName,
          team1: chunk[j].id,
          team2: chunk[k].id,
          score1: null,
          score2: null,
          status: "pending",
          startedAt: null
        });
      }
    }
    currentPoolCharCode++;
  }
  
  batch.update(doc(db, 'state', 'main'), { pools: newPools, bracket: null });
  await batch.commit();
}

function getBracketPairings(numTeams: number) {
  let rounds = Math.log2(numTeams);
  let pairings = [1, 2];
  for (let r = 1; r < rounds; r++) {
    let nextPairings: number[] = [];
    let sum = Math.pow(2, r + 1) + 1;
    for (let i = 0; i < pairings.length; i++) {
        nextPairings.push(pairings[i]);
        nextPairings.push(sum - pairings[i]);
    }
    pairings = nextPairings;
  }
  return pairings;
}

export async function executeGenerateBracket(teams: any[], matches: any[], pools: any) {
  const masterList: any[] = [];
  for (const poolName of Object.keys(pools)) {
    const teamIds = pools[poolName];
    const poolMatches = matches.filter(m => m.poolName === poolName && m.status === 'finished');
    
    const rankings = teamIds.map((id: string) => {
      let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
      poolMatches.forEach((m: any) => {
        const s1 = parseInt(m.score1) || 0;
        const s2 = parseInt(m.score2) || 0;
        if (m.team1 === id) {
          if (s1 > s2) wins++; else if (s1 < s2) losses++;
          pointsFor += s1; pointsAgainst += s2;
        }
        if (m.team2 === id) {
          if (s2 > s1) wins++; else if (s2 < s1) losses++;
          pointsFor += s2; pointsAgainst += s1;
        }
      });
      return { id, wins, diff: pointsFor - pointsAgainst, pointsFor };
    }).sort((a: any, b: any) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.pointsFor - a.pointsFor;
    });

    rankings.forEach((r: any, idx: number) => {
      masterList.push({ ...r, poolRank: idx + 1, poolName });
    });
  }

  masterList.sort((a, b) => {
    if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });

  const totalTeams = masterList.length;
  let bracketSize = 2;
  if (totalTeams >= 16) bracketSize = 16;
  else if (totalTeams >= 8) bracketSize = 8;
  else if (totalTeams >= 4) bracketSize = 4;

  const qualifiedTeams = masterList.slice(0, bracketSize).map(t => t.id);
  const pairings = getBracketPairings(bracketSize);
  
  let roundsMatches: any[] = [];
  let numMatches = bracketSize / 2;
  let currentRoundId = bracketSize;
  let maxId = 1;

  while (numMatches >= 1) {
    let roundArr = [];
    for (let i = 0; i < numMatches; i++) {
        roundArr.push({
            id: `bm_${maxId++}`,
            round: currentRoundId,
            team1: null,
            team2: null,
            score1: null,
            score2: null,
            status: "pending",
            startedAt: null,
            nextMatchId: null,
            nextSlot: null
        });
    }
    roundsMatches.push(roundArr);
    currentRoundId /= 2;
    numMatches /= 2;
  }

  for (let r = 0; r < roundsMatches.length - 1; r++) {
    let currentRound = roundsMatches[r];
    let nextRound = roundsMatches[r+1];
    for (let i = 0; i < currentRound.length; i++) {
        currentRound[i].nextMatchId = nextRound[Math.floor(i/2)].id;
        currentRound[i].nextSlot = i % 2 === 0 ? 1 : 2;
    }
  }

  for (let i = 0; i < (bracketSize / 2); i++) {
    const seed1 = pairings[i*2] - 1;
    const seed2 = pairings[i*2 + 1] - 1;
    roundsMatches[0][i].team1 = qualifiedTeams[seed1] || null;
    roundsMatches[0][i].team2 = qualifiedTeams[seed2] || null;
  }

  const bracket = { size: bracketSize, matches: roundsMatches.flat() };
  
  const batch = writeBatch(db);
  batch.update(doc(db, 'state', 'main'), { bracket, tvMode: 'bracket' });
  await batch.commit();
}

export async function advanceBracketMatch(bracket: any, matchId: string, s1: number, s2: number) {
  if (!bracket || !bracket.matches) return;
  const newMatches = [...bracket.matches];
  const matchIdx = newMatches.findIndex(m => m.id === matchId);
  if (matchIdx > -1) {
    const match = newMatches[matchIdx];
    match.score1 = s1;
    match.score2 = s2;
    match.status = "finished";
    
    const winnerId = Number(s1) > Number(s2) ? match.team1 : match.team2;
    
    if (match.nextMatchId) {
      const nextMatch = newMatches.find(m => m.id === match.nextMatchId);
      if (nextMatch) {
         if (match.nextSlot === 1) nextMatch.team1 = winnerId;
         else nextMatch.team2 = winnerId;
      }
    }
    await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
  }
}

export async function resetBracketMatch(bracket: any, matchId: string) {
  if (!bracket || !bracket.matches) return;
  const newMatches = [...bracket.matches];
  const match = newMatches.find(m => m.id === matchId);
  if (match) {
    match.score1 = null;
    match.score2 = null;
    match.status = "pending";
    match.startedAt = null;
    
    let nextId = match.nextMatchId;
    let currentSlot = match.nextSlot;
    while (nextId) {
       const nextMatch = newMatches.find(m => m.id === nextId);
       if (nextMatch) {
           if (currentSlot === 1) nextMatch.team1 = null;
           else nextMatch.team2 = null;
           nextMatch.score1 = null;
           nextMatch.score2 = null;
           nextMatch.status = "pending";
           nextMatch.startedAt = null;
           nextId = nextMatch.nextMatchId;
           currentSlot = nextMatch.nextSlot;
       } else break;
    }
    await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
  }
}
