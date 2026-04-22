import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

export function useTournament() {
  const [state, setState] = useState<{ teams: any[], pools: any, matches: any[], bracket: any, tvMode?: string, tvMessage?: string }>({
    teams: [],
    pools: {},
    matches: [],
    bracket: null,
    tvMode: 'pools',
    tvMessage: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubs: any[] = [];
    
    const init = async () => {
      // Ensure state docs exist initially
      try {
        const stateMain = await getDoc(doc(db, 'state', 'main'));
        if (!stateMain.exists()) {
           await setDoc(doc(db, 'state', 'main'), { pools: {}, bracket: null });
        }
      } catch (e:any) {
        if(e?.message?.includes('offline')) {
           toast.error(e.message);
        }
      }

      const qTeams = collection(db, 'teams');
      const qMatches = collection(db, 'matches');
      const dState = doc(db, 'state', 'main');
      const dTv = doc(db, 'tv', 'main');
      let hasTvOverride = false;

      const u1 = onSnapshot(qTeams, (snap) => {
        const teams = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setState(prev => ({ ...prev, teams }));
      });
      
      const u2 = onSnapshot(qMatches, (snap) => {
        const matches = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setState(prev => ({ ...prev, matches }));
      });

      const u3 = onSnapshot(dState, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setState(prev => ({ 
            ...prev, 
            pools: data.pools || {}, 
            bracket: data.bracket || null,
            tvMode: hasTvOverride ? prev.tvMode : (data.tvMode || 'pools'),
            tvMessage: hasTvOverride ? prev.tvMessage : (data.tvMessage || '')
          }));
        }
      });

      const u4 = onSnapshot(dTv, (snap) => {
        if (snap.exists()) {
          hasTvOverride = true;
          const data = snap.data();
          setState(prev => ({
            ...prev,
            tvMode: data.tvMode || 'pools',
            tvMessage: data.tvMessage || ''
          }));
        } else {
          hasTvOverride = false;
        }
      });

      unsubs = [u1, u2, u3, u4];
      setLoading(false);
    };

    init();
    
    return () => unsubs.forEach(u => u());
  }, []);

  return { state, loading };
}

// Utils to push data to FB
export function generatePin() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for(let i = 0; i < 4; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}
