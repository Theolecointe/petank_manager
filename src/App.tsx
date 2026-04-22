import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Trophy, Users, LayoutGrid, Settings, Swords, Trash2, Plus, RefreshCw, Hand, Upload, Check } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useTournament, generateId, generatePin } from './hooks/useTournament';
import { db } from './lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { executeGeneratePools as doGeneratePools, executeGenerateBracket as doGenerateBracket, advanceBracketMatch, resetBracketMatch } from './lib/tournamentLogic';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<PublicView />} />
        <Route path="/tv" element={<TvDisplayView />} />
        
        {/* Admin Routes with Auth Guard */}
        <Route path="/admin" element={<AdminAuthGuard />}>
          <Route index element={<Navigate to="teams" replace />} />
          <Route path="teams" element={<TeamsView />} />
          <Route path="pools" element={<PoolsView />} />
          <Route path="bracket" element={<BracketView />} />
          <Route path="tv" element={<TvManagerView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function AdminAuthGuard() {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function Sidebar() {
  const navItems = [
    { to: "/admin/teams", icon: <Users size={18} />, label: "Gestion Équipes" },
    { to: "/admin/pools", icon: <LayoutGrid size={18} />, label: "Phase de Poules" },
    { to: "/admin/bracket", icon: <Trophy size={18} />, label: "Tableau Final" },
    { to: "/admin/tv", icon: <Settings size={18} />, label: "Contrôle Écran TV" },
  ];

  return (
    <div className="w-[220px] bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 font-extrabold text-[18px] tracking-tight">
        Petank<span className="text-blue-500">Manager</span>
      </div>
      
      <nav className="flex-1 pt-2">
        <ul className="flex flex-col">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-5 py-3 text-sm transition-colors border-l-4 ${
                    isActive
                      ? "bg-slate-800 border-blue-500 text-white opacity-100"
                      : "border-transparent text-white opacity-70 hover:opacity-100 hover:bg-slate-800/50"
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="mt-auto p-5 text-[11px] opacity-50">
        Status: Connecté (JSON local)
      </div>
    </div>
  );
}

// --- VIEWS --- //

function TvManagerView() {
  const { state: { tvMode, tvMessage, bracket }, loading } = useTournament();
  const [msgInput, setMsgInput] = useState(tvMessage || '');

  useEffect(() => {
    setMsgInput(tvMessage || '');
  }, [tvMessage]);

  const updateTvSettings = async (mode: string, msg: string) => {
    try {
      await setDoc(
        doc(db, 'tv', 'main'),
        {
          tvMode: mode,
          tvMessage: msg
        },
        { merge: true }
      );
      toast.success("Affichage TV mis à jour !");
    } catch (e: any) {
      const projectId = (db as any)?.app?.options?.projectId || 'unknown-project';
      const databaseId = (db as any)?._databaseId?.database || 'unknown-db';
      toast.error(`Erreur de mise à jour (${e?.code || 'no-code'}) [${projectId}/${databaseId}]: ${e?.message || 'inconnue'}`);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 shrink-0 shadow-sm">
        <h1 className="text-[18px] font-bold text-slate-900 m-0 leading-tight">Contrôle de l'Écran TV</h1>
      </header>
      <div className="p-8 max-w-2xl mx-auto w-full flex flex-col gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Phase affichée à l'écran</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => updateTvSettings('pools', msgInput)}
              className={`py-4 rounded-xl border-2 font-bold transition-all ${tvMode !== 'bracket' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              Phase de poules
            </button>
            <button 
              onClick={() => updateTvSettings('bracket', msgInput)}
              disabled={!bracket}
              className={`py-4 rounded-xl border-2 font-bold transition-all ${(tvMode === 'bracket') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'} ${!bracket ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Tableau Final
            </button>
          </div>
          {!bracket && <p className="text-xs text-slate-400 mt-2 italic">Le tableau final n'est pas encore généré.</p>}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Message défilant (Bandeau VIP)</h2>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              placeholder="Ex: Rendez-vous à la buvette pour la tombola !" 
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <button 
              onClick={() => updateTvSettings(tvMode || 'pools', msgInput)}
              className="bg-slate-800 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-900 transition-colors shadow-sm"
            >
              Publier
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Laissez vide pour masquer le bandeau sur la TV.</p>
        </div>
        
        <div className="flex justify-center mt-4">
           <a href="/tv" target="_blank" className="text-blue-500 font-bold hover:underline flex items-center gap-2">Ouvrir l'écran TV dans un nouvel onglet</a>
        </div>
      </div>
    </div>
  );
}

function TeamsView() {
  const { state: { teams, pools, matches }, loading } = useTournament();
  const [newTeamName, setNewTeamName] = useState("");
  const [newP1, setNewP1] = useState("");
  const [newP2, setNewP2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    
    try {
      const id = generateId();
      await setDoc(doc(db, 'teams', id), {
        id,
        pin: generatePin(),
        name: newTeamName,
        player1: newP1,
        player2: newP2,
        email: newEmail
      });
      setNewTeamName(""); setNewP1(""); setNewP2(""); setNewEmail("");
      toast.success("Équipe ajoutée");
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const deleteTeam = (id: string) => {
    setTeamToDelete(id);
  };

  const executeDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      const batch = writeBatch(db);
      
      // Delete team doc
      batch.delete(doc(db, 'teams', teamToDelete));

      // Remove from pools
      const newPools = { ...pools };
      let poolsModified = false;
      for (const pool in newPools) {
        if (newPools[pool].includes(teamToDelete)) {
          newPools[pool] = newPools[pool].filter((tid: string) => tid !== teamToDelete);
          poolsModified = true;
        }
      }
      if (poolsModified) {
        batch.update(doc(db, 'state', 'main'), { pools: newPools });
      }

      // Delete matches involving the team
      const matchesToDelete = matches.filter(m => m.team1 === teamToDelete || m.team2 === teamToDelete);
      matchesToDelete.forEach(m => {
        batch.delete(doc(db, 'matches', m.id));
      });

      await batch.commit();
      toast.success("Équipe supprimée");
    } catch (e:any) {
      toast.error("Erreur: " + e.message);
    }
    setTeamToDelete(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const importedTeams = jsonData.map((row) => {
          const findKey = (search: string) => Object.keys(row).find(k => k.trim().toLowerCase() === search.toLowerCase());
          
          const teamNameKey = findKey("Nom de l'équipe");
          const p1FirstKey = findKey("Prénom (capitaine)");
          const p1LastKey = findKey("Nom (capitaine)");
          const p2FirstKey = findKey("Prénom (personne 2)");
          const p2LastKey = findKey("Nom (personne 2)");
          const emailKey = findKey("Email payeur");

          return {
            name: teamNameKey ? String(row[teamNameKey]).trim() : "Équipe importée",
            player1: `${p1FirstKey && row[p1FirstKey] ? row[p1FirstKey] : ''} ${p1LastKey && row[p1LastKey] ? row[p1LastKey] : ''}`.trim(),
            player2: `${p2FirstKey && row[p2FirstKey] ? row[p2FirstKey] : ''} ${p2LastKey && row[p2LastKey] ? row[p2LastKey] : ''}`.trim(),
            email: emailKey ? String(row[emailKey]).trim() : ""
          };
        });

        const validTeams = importedTeams.filter(t => t.name !== "Équipe importée" || t.player1 !== "" || t.email !== "");

        if (validTeams.length === 0) {
          toast.error("Aucune équipe valide trouvée dans le fichier.");
          return;
        }

        const batch = writeBatch(db);
        validTeams.forEach((t) => {
          const id = generateId();
          batch.set(doc(db, 'teams', id), {
             id,
             pin: generatePin(),
             name: t.name || "Nouvelle Équipe",
             player1: t.player1 || "",
             player2: t.player2 || "",
             email: t.email || ""
          });
        });
        
        await batch.commit();
        toast.success(`${validTeams.length} équipes importées !`);
      } catch (err) {
        toast.error("Erreur lors de la lecture du fichier Excel/CSV.");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      <ConfirmModal 
        isOpen={!!teamToDelete} 
        title="Supprimer l'équipe" 
        message="Êtes-vous sûr de vouloir supprimer cette équipe ? Cette action retirera également l'équipe de toutes les poules correspondantes."
        onConfirm={executeDeleteTeam}
        onCancel={() => setTeamToDelete(null)}
      />
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 m-0 leading-tight">Gestion des Équipes</h1>
          <p className="text-xs text-slate-500 m-0">Inscrivez les participants au tournoi de pétanque.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase">Préparation</span>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md text-xs font-semibold border border-slate-300 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Upload size={14} /> Importer
          </button>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md font-medium text-slate-600 text-xs shadow-sm">
            <span className="font-bold text-slate-900">{teams.length}</span> équipes
          </div>
        </div>
      </header>

      <div className="p-6 flex-1 overflow-y-auto w-full">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm mb-6 overflow-hidden max-w-4xl mx-auto">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 text-sm">Ajouter une nouvelle équipe</h3>
          </div>
          <form onSubmit={addTeam} className="p-4 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nom de l'équipe</label>
              <input 
                type="text" 
                required
                value={newTeamName} 
                onChange={e => setNewTeamName(e.target.value)} 
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="ex: Les Joyeux Boulistes"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Joueur 1 (opt)</label>
              <input 
                type="text" 
                value={newP1} 
                onChange={e => setNewP1(e.target.value)} 
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Prénom"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Joueur 2 (opt)</label>
              <input 
                type="text" 
                value={newP2} 
                onChange={e => setNewP2(e.target.value)} 
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Prénom"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Email Payeur (opt)</label>
              <input 
                type="email" 
                value={newEmail} 
                onChange={e => setNewEmail(e.target.value)} 
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="email@..."
              />
            </div>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md font-medium text-[13px] flex items-center gap-2 hover:bg-blue-600 transition-colors border-none cursor-pointer h-[38px]">
              Ajouter
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden max-w-5xl mx-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold">Équipe</th>
                <th className="px-6 py-3 font-semibold">Code PIN</th>
                <th className="px-6 py-3 font-semibold">Joueurs</th>
                <th className="px-6 py-3 font-semibold">Contact (Email)</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">Chargement...</td></tr>
              ) : teams.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">Aucune équipe inscrite.</td></tr>
              ) : (
                teams.map(team => (
                  <tr key={team.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-slate-800">{team.name}</td>
                    <td className="px-6 py-3 text-sm font-mono font-bold tracking-widest text-blue-600">{team.pin || '----'}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {team.player1 || '-'} &amp; {team.player2 || '-'}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {team.email ? <a href={`mailto:${team.email}`} className="text-blue-500 hover:underline">{team.email}</a> : '-'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => deleteTeam(team.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PoolsView() {
  const { state: { teams, pools, matches, bracket }, loading } = useTournament();
  const [teamsPerPool, setTeamsPerPool] = useState(4);
  const [confirmAction, setConfirmAction] = useState<{type: 'generate'|'reset'|'generate_bracket'|'stop', id?: string} | null>(null);
  const navigate = useNavigate();

  const generatePools = async () => {
    if (teams.length < 4) {
      toast.error("Il faut au moins 4 équipes pour générer des poules.");
      return;
    }
    setConfirmAction({ type: 'generate' });
  };

  const executeGeneratePools = async () => {
    try {
      await doGeneratePools(teams, matches, pools, teamsPerPool);
      toast.success("Poules générées !");
    } catch(e:any) {
      toast.error("Erreur lors de la génération: " + e.message);
    }
    setConfirmAction(null);
  };

  const executeGenerateBracket = async () => {
    try {
      await doGenerateBracket(teams, matches, pools);
      toast.success("Tableau final généré !");
      navigate("/admin/bracket");
    } catch(e:any) {
      toast.error("Erreur lors de la création du tableau final: " + e.message);
    }
    setConfirmAction(null);
  };

  const updateScore = async (matchId: string, s1: number, s2: number) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        score1: s1,
        score2: s2,
        status: "finished"
      });
    } catch(e:any) {
      toast.error("Erreur - Impossible d'enregistrer le score: " + e.message);
    }
  };

  const startMatch = async (matchId: string) => {
    try {
      const match = matches.find((m: any) => m.id === matchId);
      if (!match) return;
      const bracketM = bracket?.matches || [];
      const isBusy = (t: string) => t && (matches.some((m:any) => m.status === 'playing' && m.id !== matchId && (m.team1 === t || m.team2 === t)) || bracketM.some((m:any) => m.status === 'playing' && (m.team1 === t || m.team2 === t)));
      
      if (isBusy(match.team1) || isBusy(match.team2)) {
        toast.error("Impossible : l'une des équipes joue déjà un autre match !");
        return;
      }

      await updateDoc(doc(db, 'matches', matchId), {
        status: "playing",
        startedAt: Date.now()
      });
    } catch(e:any) {
      toast.error("Erreur - Impossible de démarrer le match: " + e.message);
    }
  };

  const stopMatch = async (matchId: string) => {
    setConfirmAction({ type: 'stop', id: matchId });
  };

  const pauseMatch = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status: "paused",
        pausedAt: Date.now()
      });
    } catch {
      toast.error("Erreur de pause");
    }
  };

  const resumeMatch = async (matchId: string) => {
    try {
      const match = matches.find((m:any) => m.id === matchId);
      if (!match || !match.startedAt || !match.pausedAt) return;
      const pauseDuration = Date.now() - match.pausedAt;
      await updateDoc(doc(db, 'matches', matchId), {
        status: "playing",
        startedAt: match.startedAt + pauseDuration,
        pausedAt: null
      });
    } catch {
      toast.error("Erreur de reprise");
    }
  };

  const executeStopMatch = async () => {
    if (confirmAction?.type !== 'stop' || !confirmAction.id) return;
    try {
      await updateDoc(doc(db, 'matches', confirmAction.id), {
        status: "pending",
        startedAt: null
      });
      toast.success("Match arrêté");
    } catch(e:any) {
      toast.error("Erreur d'arrêt: " + e.message);
    }
    setConfirmAction(null);
  };

  const resetMatch = async (matchId: string) => {
    setConfirmAction({ type: 'reset', id: matchId });
  };

  const executeResetMatch = async () => {
    if (confirmAction?.type !== 'reset' || !confirmAction.id) return;
    try {
      await updateDoc(doc(db, 'matches', confirmAction.id), {
        score1: null,
        score2: null,
        status: "pending",
        startedAt: null
      });
      toast.success("Match réinitialisé");
    } catch {
      toast.error("Erreur");
    }
    setConfirmAction(null);
  };

  const handleConfirm = () => {
    if (confirmAction?.type === 'generate') executeGeneratePools();
    if (confirmAction?.type === 'generate_bracket') executeGenerateBracket();
    if (confirmAction?.type === 'reset') executeResetMatch();
    if (confirmAction?.type === 'stop') executeStopMatch();
  };

  const moveTeam = async (teamId: string, fromPool: string, toPool: string) => {
    try {
      const newPools = { ...pools };
      if (newPools[fromPool] && newPools[toPool]) {
         newPools[fromPool] = newPools[fromPool].filter((id: string) => id !== teamId);
         newPools[toPool].push(teamId);
         await updateDoc(doc(db, 'state', 'main'), { pools: newPools });
         toast.success("Équipe déplacée. (Attention: Les matchs n'ont pas été regénérés pour ces poules !)");
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const getTeam = (id: string) => teams.find(t => t.id === id) || { name: 'Inconnu' };

  const simulatePoolMatches = async () => {
    try {
      const dbMatches = [...matches];
      const batch = writeBatch(db);
      for (const m of dbMatches) {
        if (m.status !== 'finished') {
          // Generate realistic petanque scores. 13 for winner, 0-12 for loser.
          const winnerScore = 13;
          const loserScore = Math.floor(Math.random() * 13);
          const t1Wins = Math.random() > 0.5;
          const s1 = t1Wins ? winnerScore : loserScore;
          const s2 = t1Wins ? loserScore : winnerScore;
          
          batch.update(doc(db, 'matches', m.id), {
            score1: s1,
            score2: s2,
            status: "finished"
          });
        }
      }
      await batch.commit();
      toast.success("Toutes les poules ont été simulées !");
    } catch(e:any) {
      toast.error("Erreur de simulation: " + e.message);
    }
  };

  const poolNames = Object.keys(pools || {}).sort();

  return (
    <div className="flex flex-col h-full">
      <ConfirmModal 
        isOpen={!!confirmAction} 
        title={confirmAction?.type === 'generate' ? "Générer les poules" : confirmAction?.type === 'generate_bracket' ? "Générer le tableau final" : confirmAction?.type === 'stop' ? "Arrêter le chronomètre" : "Réinitialiser le match"}
        message={
          confirmAction?.type === 'generate' 
            ? "Attention, générer réinitialisera TOUTES les poules et TOUS les matchs existants. Cette action est irréversible. Continuer ?" 
            : confirmAction?.type === 'generate_bracket' 
            ? "Êtes-vous sûr de vouloir figer le classement actuel et déterminer l'arbre du tournoi ? (Assurez-vous que tous les matchs importants sont terminés)."
            : confirmAction?.type === 'stop'
            ? "Voulez-vous vraiment arrêter le chronomètre pour ce match ?"
            : "Annuler ce match et remettre les scores à zéro ?"
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 m-0 leading-tight">Phase de Poules</h1>
          <p className="text-xs text-slate-500 m-0">{teams.length} équipes inscrites • {matches.filter(m => m.status === 'finished').length} matchs terminés</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={simulatePoolMatches}
            className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-md font-bold text-[11px] transition-colors shadow-sm ml-2"
          >
            🧪 SIMULER MATCHS
          </button>
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase">En cours</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-xs">
              <span className="font-medium text-slate-500 mr-2">Taille poules:</span>
              <select 
                value={teamsPerPool} 
                onChange={e => setTeamsPerPool(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>
            <button 
              onClick={generatePools}
              className="bg-blue-500 text-white px-3 py-1.5 rounded-md font-medium text-[13px] flex items-center gap-2 hover:bg-blue-600 transition-colors border-none cursor-pointer"
            >
              <RefreshCw size={14} /> Générer
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50">
        {loading ? (
          <div className="text-center text-slate-500 py-12 text-sm">Chargement des données...</div>
        ) : poolNames.length === 0 ? (
          <div className="m-6 bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center">
            <LayoutGrid size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-1">Aucune poule générée</h3>
            <p className="text-slate-500 max-w-md text-sm">Commencez par ajouter des équipes, puis cliquez sur "Générer" pour créer la phase de groupes.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
              {poolNames.map(poolName => {
                const teamIds = pools[poolName];
                const poolMatches = matches.filter(m => m.poolName === poolName);
                const finishedMatches = poolMatches.filter((m: any) => m.status === 'finished').length;
                const poolStatus = finishedMatches === poolMatches.length && poolMatches.length > 0 ? "Terminé" : "En cours";
                
                // Classement Pétanque (Victoires -> Différence -> Points Pour)
                const rankings = teamIds.map((id: string) => {
                  const team = getTeam(id);
                  let wins = 0;
                  let losses = 0;
                  let pointsFor = 0;
                  let pointsAgainst = 0;
                  
                  poolMatches.filter((m: any) => m.status === 'finished').forEach((m: any) => {
                    const s1 = parseInt(m.score1) || 0;
                    const s2 = parseInt(m.score2) || 0;
                    
                    if (m.team1 === id) {
                      if (s1 > s2) wins++;
                      else if (s1 < s2) losses++;
                      pointsFor += s1;
                      pointsAgainst += s2;
                    }
                    if (m.team2 === id) {
                      if (s2 > s1) wins++;
                      else if (s2 < s1) losses++;
                      pointsFor += s2;
                      pointsAgainst += s1;
                    }
                  });
                  const diff = pointsFor - pointsAgainst;
                  return { id, name: team.name, wins, losses, pointsFor, pointsAgainst, diff };
                }).sort((a: any, b: any) => {
                  if (b.wins !== a.wins) return b.wins - a.wins;
                  if (b.diff !== a.diff) return b.diff - a.diff;
                  return b.pointsFor - a.pointsFor;
                });

                return (
                  <div key={poolName} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-slate-100 px-3 py-2 font-bold text-[13px] flex justify-between items-center border-b border-slate-200 text-slate-800">
                      <span>Poule {poolName}</span>
                      <span className="font-normal text-[11px] text-slate-500">{poolStatus}</span>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                      {/* Rankings */}
                      <div className="flex-1">
                        <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 flex justify-end gap-3 text-[10px] font-semibold text-slate-400 uppercase">
                          <span className="w-5 text-right pr-2">V</span>
                          <span className="w-6 text-right">Diff</span>
                        </div>
                        {rankings.map((r: any, idx: number) => (
                          <div key={r.id} className="px-3 py-1.5 border-b border-slate-100 text-xs flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="text-slate-400 font-medium shrink-0">{idx + 1}.</span>
                              <span className="font-medium text-slate-800 truncate" title={r.name}>{r.name}</span>
                            </div>
                            <div className="flex gap-3 shrink-0 ml-2 text-[11px]">
                              <div className="text-right w-5 flex border-r border-slate-200 pr-2">
                                <span className="font-bold text-slate-700">{r.wins}</span>
                              </div>
                              <div className="text-right w-6 flex justify-end">
                                <span className={`font-semibold ${r.diff > 0 ? 'text-emerald-600' : r.diff < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                  {r.diff > 0 ? '+' : ''}{r.diff}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Matches */}
                      <div className="mt-auto border-t border-slate-200 bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 px-1 flex justify-between tracking-wider">
                          <span>Matchs</span>
                          <span>{finishedMatches}/{poolMatches.length}</span>
                        </p>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {poolMatches.map((m: any) => (
                              <MatchRow 
                              key={m.id} 
                              match={m} 
                              team1={getTeam(m.team1)} 
                              team2={getTeam(m.team2)} 
                              onSave={(s1: number, s2: number) => updateScore(m.id, s1, s2)}
                              onReset={() => resetMatch(m.id)}
                              onStart={() => startMatch(m.id)}
                              onStop={() => stopMatch(m.id)}
                              onPause={() => pauseMatch(m.id)}
                              onResume={() => resumeMatch(m.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 flex justify-center border-t border-slate-200 bg-white">
              <button 
                onClick={() => setConfirmAction({ type: 'generate_bracket' })}
                className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold text-sm shadow-md hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trophy size={18} />
                Clôturer les poules et générer le tableau final
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MatchRow({ match, team1, team2, onSave, onReset, onStart, onStop, onPause, onResume }: any) {
  const [s1, setS1] = useState<string>(match.score1 ?? "");
  const [s2, setS2] = useState<string>(match.score2 ?? "");
  const [isEditing, setIsEditing] = useState(false);
  
  // Update internal state if match props change (e.g. parent reset or external update)
  useEffect(() => {
    setS1(match.score1 ?? "");
    setS2(match.score2 ?? "");
    setIsEditing(false);
  }, [match.score1, match.score2]);

  const isFinished = match.status === "finished";
  const isPlaying = match.status === "playing";
  const isPaused = match.status === "paused";
  const isActive = isPlaying || isPaused;
  const isDisabled = isFinished && !isEditing;

  const handleSave = () => {
    if (s1 === "" || s2 === "") return;
    onSave(Number(s1), Number(s2));
    setIsEditing(false);
  };

  return (
    <div className={`p-1.5 rounded-md border ${isFinished ? 'bg-white border-slate-200' : isPlaying ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100' : isPaused ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-100' : 'bg-slate-50 border-slate-200'} ${isEditing ? 'border-blue-300 ring-1 ring-blue-100' : ''} flex flex-col gap-1.5 shadow-sm transition-all`}>
      {isActive && !isEditing && (
         <div className="flex justify-between items-center px-1 mb-[-4px]">
           <div className="flex items-center gap-1.5">
             <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{isPlaying ? 'En cours' : 'En pause'}</span>
           </div>
           <MatchTimer startedAt={match.startedAt} pausedAt={match.pausedAt} status={match.status} />
         </div>
      )}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <span className="font-medium text-slate-700 truncate flex-1 text-right" title={team1.name}>{team1.name}</span>
        <div className="flex items-center gap-1 shrink-0 px-1">
          <input 
            type="number" 
            value={s1} 
            onChange={e => setS1(e.target.value)} 
            disabled={isDisabled}
            className={`w-7 h-6 text-center border bg-white rounded text-[11px] font-bold hide-arrows focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${isDisabled ? 'border-transparent text-slate-700 pointer-events-none' : 'border-slate-300 text-slate-900'} disabled:bg-transparent`} 
            placeholder="-"
          />
          <span className="text-slate-400 font-bold text-[9px] uppercase">vs</span>
          <input 
            type="number" 
            value={s2} 
            onChange={e => setS2(e.target.value)}
            disabled={isDisabled} 
            className={`w-7 h-6 text-center border bg-white rounded text-[11px] font-bold hide-arrows focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${isDisabled ? 'border-transparent text-slate-700 pointer-events-none' : 'border-slate-300 text-slate-900'} disabled:bg-transparent`}
            placeholder="-"
          />
        </div>
        <span className="font-medium text-slate-700 truncate flex-1 text-left" title={team2.name}>{team2.name}</span>
      </div>
      
      {isFinished && !isEditing && (
        <button onClick={() => setIsEditing(true)} className="w-full text-[10px] font-medium text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-0.5 rounded transition-colors text-center cursor-pointer flex items-center justify-center gap-1">
          Modifier score
        </button>
      )}

      {isEditing && (
        <div className="flex items-center gap-1 pt-0.5">
          <button onClick={() => onReset()} className="flex-1 text-[10px] text-red-500 font-medium hover:bg-red-50 py-1 rounded transition-colors border-none cursor-pointer" title="Effacer le match">
            Effacer
          </button>
          <button onClick={() => { setS1(match.score1 ?? ""); setS2(match.score2 ?? ""); setIsEditing(false); }} className="flex-1 text-[10px] text-slate-500 font-medium hover:bg-slate-100 py-1 rounded transition-colors border-none cursor-pointer">
            Annuler
          </button>
          <button onClick={handleSave} className="flex-1 bg-blue-500 text-white text-[10px] py-1 rounded font-medium hover:bg-blue-600 transition-colors border-none cursor-pointer">
            Enregistrer
          </button>
        </div>
      )}

      {!isFinished && !isEditing && (
        <div className="flex gap-1">
          {!isActive && s1 === "" && s2 === "" && team1.id && team2.id && (
            <button onClick={onStart} className="flex-1 bg-slate-100 text-slate-600 text-[10px] py-1 rounded font-medium hover:bg-slate-200 transition-colors border-none cursor-pointer">
              Démarrer le match
            </button>
          )}
          {isPlaying && onPause && (
            <button onClick={onPause} className="flex-1 bg-amber-50 text-amber-600 text-[10px] py-1 rounded font-medium hover:bg-amber-100 transition-colors border-none cursor-pointer">
              Pause
            </button>
          )}
          {isPaused && onResume && (
            <button onClick={onResume} className="flex-1 bg-blue-50 text-blue-600 text-[10px] py-1 rounded font-medium hover:bg-blue-100 transition-colors border-none cursor-pointer">
              Reprendre
            </button>
          )}
          {isActive && s1 === "" && s2 === "" && onStop && (
            <button onClick={onStop} className="flex-1 bg-red-50 text-red-600 text-[10px] py-1 rounded font-medium hover:bg-red-100 transition-colors border-none cursor-pointer">
              Arrêter
            </button>
          )}
          {s1 !== "" && s2 !== "" && (
            <button onClick={handleSave} className="flex-1 bg-blue-500 text-white text-[10px] py-1 rounded font-medium hover:bg-blue-600 transition-colors border-none cursor-pointer">
              Valider Score
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BracketView() {
  const { state: { teams, bracket, matches }, loading } = useTournament();
  const [confirmAction, setConfirmAction] = useState<{type: 'reset'|'stop', id?: string} | null>(null);

  const getTeam = (id: string) => {
    return teams.find((t:any) => t.id === id) || { name: "TBD", player1: "", player2: "" };
  };

  const updateScore = async (matchId: string, s1: number, s2: number) => {
    try {
      await advanceBracketMatch(bracket, matchId, s1, s2);
    } catch {
      toast.error("Erreur d'enregistrement du score");
    }
  };

  const resetMatch = async (matchId: string) => {
    setConfirmAction({ type: 'reset', id: matchId });
  };

  const executeResetMatch = async () => {
    if (confirmAction?.type !== 'reset' || !confirmAction.id) return;
    try {
      await resetBracketMatch(bracket, confirmAction.id);
    } catch {
      toast.error("Erreur");
    }
    setConfirmAction(null);
  };

  const startMatch = async (matchId: string) => {
    try {
      if (!bracket || !bracket.matches) return;
      const matchIdx = bracket.matches.findIndex((m:any) => m.id === matchId);
      if (matchIdx === -1) return;
      const match = bracket.matches[matchIdx];
      
      const isBusy = (t: string) => t && (matches.some((m:any) => m.status === 'playing' && (m.team1 === t || m.team2 === t)) || bracket.matches.some((m:any) => m.status === 'playing' && m.id !== matchId && (m.team1 === t || m.team2 === t)));
      
      if (isBusy(match.team1) || isBusy(match.team2)) {
        toast.error("Impossible : l'une des équipes joue déjà un autre match !");
        return;
      }

      const newMatches = [...bracket.matches];
      newMatches[matchIdx].status = "playing";
      newMatches[matchIdx].startedAt = Date.now();
      await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
    } catch {
      toast.error("Erreur au démarrage du match");
    }
  };

  const stopMatch = async (matchId: string) => {
    setConfirmAction({ type: 'stop', id: matchId });
  };

  const pauseMatch = async (matchId: string) => {
    try {
      if (!bracket || !bracket.matches) return;
      const newMatches = [...bracket.matches];
      const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
      if (matchIdx > -1) {
        newMatches[matchIdx].status = "paused";
        newMatches[matchIdx].pausedAt = Date.now();
        await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
      }
    } catch {
      toast.error("Erreur de pause");
    }
  };

  const resumeMatch = async (matchId: string) => {
    try {
      if (!bracket || !bracket.matches) return;
      const newMatches = [...bracket.matches];
      const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
      if (matchIdx > -1) {
        const m = newMatches[matchIdx];
        if (m.startedAt && m.pausedAt) {
           const pauseDuration = Date.now() - m.pausedAt;
           newMatches[matchIdx].status = "playing";
           newMatches[matchIdx].startedAt = m.startedAt + pauseDuration;
           newMatches[matchIdx].pausedAt = null;
           await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
        }
      }
    } catch {
      toast.error("Erreur de reprise");
    }
  };

  const executeStopMatch = async () => {
    if (confirmAction?.type !== 'stop' || !confirmAction.id) return;
    try {
      if (!bracket || !bracket.matches) return;
      const newMatches = [...bracket.matches];
      const matchIdx = newMatches.findIndex((m:any) => m.id === confirmAction.id);
      if (matchIdx > -1) {
        newMatches[matchIdx].status = "pending";
        newMatches[matchIdx].startedAt = null;
        await updateDoc(doc(db, 'state', 'main'), { bracket: { ...bracket, matches: newMatches } });
      }
    } catch {
      toast.error("Erreur à l'arrêt du match");
    }
    setConfirmAction(null);
  };

  const handleConfirm = () => {
    if (confirmAction?.type === 'reset') executeResetMatch();
    if (confirmAction?.type === 'stop') executeStopMatch();
  };

  const simulateBracketMatches = async () => {
    try {
      if (!bracket || !bracket.matches) return;
      const bMatches = bracket.matches;
      // Get the earliest pending match
      let madeProgress = false;
      for (const m of bMatches) {
        if (m.status !== 'finished' && m.team1 && m.team2) {
          // Both teams are resolved. Random score
          const t1Wins = Math.random() > 0.5;
          const s1 = t1Wins ? 13 : Math.floor(Math.random() * 13);
          const s2 = t1Wins ? Math.floor(Math.random() * 13) : 13;
          await advanceBracketMatch(bracket, m.id, s1, s2);
          madeProgress = true;
          break; // Simulation advances one match at a time because of bracket logic which needs fresh state
        }
      }
      if (madeProgress) {
        toast.success("1 match simulé. Cliquez encore pour simuler la suite.");
      } else {
         toast.success("Tableau final complet ou aucun match ne peut être simulé.");
      }
    } catch(e:any) {
      toast.error("Erreur de simulation: " + e.message);
    }
  };

  const getRoundLabel = (size: number) => {
    if (size === 2) return "Finale";
    if (size === 4) return "1/2 Finales";
    if (size === 8) return "1/4 Finales";
    if (size === 16) return "1/8 Finales";
    if (size === 32) return "1/16 Finales";
    return `Tours (${size})`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500">Chargement...</div>;
  }

  const hasBracket = bracket && bracket.matches && bracket.matches.length > 0;
  
  // Group matches by round
  const roundsMap = new Map<number, any[]>();
  if (hasBracket) {
    bracket.matches.forEach((m: any) => {
      if (!roundsMap.has(m.round)) roundsMap.set(m.round, []);
      roundsMap.get(m.round)!.push(m);
    });
  }
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => b - a);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative z-10 shadow-sm">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 m-0 leading-tight">
            Tableau Final {hasBracket && `(Top ${bracket.size})`}
          </h1>
          <p className="text-xs text-slate-500 m-0">Phase à élimination directe.</p>
        </div>
        {hasBracket && (
          <button 
            onClick={simulateBracketMatches}
            className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-md font-bold text-[11px] transition-colors shadow-sm"
          >
            🧪 SIMULER MATCH (x1)
          </button>
        )}
      </header>
      
      {!hasBracket ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center max-w-md mx-auto">
          <Trophy size={48} className="text-slate-300 mb-4" />
          <h2 className="text-lg font-bold text-slate-700 mb-2">Phase finale non générée</h2>
          <p className="text-sm">Pour générer le tableau final, rendez-vous dans la partie "Phase de Poules" et cliquez sur le bouton de clôture en bas de page.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-8 bg-slate-100">
          <div className="flex gap-16 min-w-[max-content] min-h-[600px] items-stretch justify-start">
            {sortedRounds.map((roundSize, index) => {
              const matchesInRound = roundsMap.get(roundSize) || [];

              return (
                <div key={roundSize} className="flex flex-col w-[300px]">
                  <div className="h-[50px] shrink-0 text-center font-bold text-sm tracking-wide uppercase text-slate-400 mb-8 border-b-2 border-slate-200 pb-2">
                    {getRoundLabel(roundSize)}
                  </div>
                  <div className="flex-1 flex flex-col justify-around">
                    {matchesInRound.map((match: any) => (
                      <div key={match.id} className="relative z-10 bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200/60 ring-1 ring-slate-900/5 my-4">
                        <MatchRow 
                          match={match} 
                          team1={getTeam(match.team1)} 
                          team2={getTeam(match.team2)}
                          onSave={(s1: number, s2: number) => updateScore(match.id, s1, s2)}
                          onReset={() => resetMatch(match.id)}
                          onStart={() => startMatch(match.id)}
                          onStop={() => stopMatch(match.id)}
                          onPause={() => pauseMatch(match.id)}
                          onResume={() => resumeMatch(match.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors border-none cursor-pointer">Annuler</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors border-none cursor-pointer">Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function PublicView() {
  const { state: dbState, loading } = useTournament();
  const [activeTab, setActiveTab] = useState<'pools' | 'bracket'>('pools');
  const [teamPin, setTeamPin] = useState(localStorage.getItem('team_pin') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('team_pin'));
  const [pinInput, setPinInput] = useState('');
  const [confirmAction, setConfirmAction] = useState<{type: 'stop', id?: string} | null>(null);
  const [scoreInput, setScoreInput] = useState<{id: string, s1: string, s2: string} | null>(null);

  const getTeam = (id: string) => dbState.teams?.find((t:any) => t.id === id) || { name: "TBD" };

  const handleScoreSubmit = async (matchId: string) => {
    if (!scoreInput || scoreInput.id !== matchId) return;
    const s1 = parseInt(scoreInput.s1);
    const s2 = parseInt(scoreInput.s2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      toast.error("Veuillez entrer un score valide.");
      return;
    }
    if (s1 === s2) {
      toast.error("Le match nul n'est pas autorisé.");
      return;
    }
    
    try {
      const poolMatch = dbState.matches?.find((m:any) => m.id === matchId);
      if (poolMatch) {
         await updateDoc(doc(db, 'matches', matchId), {
            score1: s1,
            score2: s2,
            status: "finished"
         });
         setScoreInput(null);
         toast.success("Score enregistré !");
         return;
      }
      
      const bracketMatch = dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (bracketMatch) {
         await advanceBracketMatch(dbState.bracket, matchId, s1, s2);
         setScoreInput(null);
         toast.success("Score enregistré !");
      }
    } catch(e:any) {
      toast.error("Erreur d'enregistrement: " + e.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const pinUpper = pinInput.toUpperCase();
    const team = dbState.teams?.find((t: any) => t.pin === pinUpper);
    if (team) {
      localStorage.setItem('team_pin', pinUpper);
      setTeamPin(pinUpper);
      setIsAuthenticated(true);
      toast.success(`Connecté : ${team.name}`);
    } else {
      toast.error("Code d'accès incorrect");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('team_pin');
    setIsAuthenticated(false);
    setTeamPin('');
  };

  const startMatch = async (matchId: string) => {
    try {
      const match = dbState.matches?.find((m:any) => m.id === matchId) || dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (!match) return;

      const isBusy = (t: string) => t && ((dbState.matches || []).some((m:any) => m.status === 'playing' && m.id !== matchId && (m.team1 === t || m.team2 === t)) || (dbState.bracket?.matches || []).some((m:any) => m.status === 'playing' && m.id !== matchId && (m.team1 === t || m.team2 === t)));
      
      if (isBusy(match.team1) || isBusy(match.team2)) {
         toast.error("Action impossible : Une des équipes joue déjà un autre match actuellement !");
         return;
      }
      
      // We have bracket matches and pool matches. They are both in state, but bracket matches are in db.bracket.matches, while pool matches are in db.matches
      // we need to know if it's a bracket math or pool match
      const poolMatch = poolMatches?.find((m:any) => m.id === matchId);
      if (poolMatch) {
         await updateDoc(doc(db, 'matches', matchId), {
            status: "playing",
            startedAt: Date.now()
         });
         toast.success("C'est parti ! 30 minutes au chrono.");
         return;
      }
      const bracketMatch = dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (bracketMatch) {
         const newMatches = [...dbState.bracket.matches];
         const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
         newMatches[matchIdx].status = "playing";
         newMatches[matchIdx].startedAt = Date.now();
         await updateDoc(doc(db, 'state', 'main'), { bracket: { ...dbState.bracket, matches: newMatches } });
         toast.success("C'est parti ! 30 minutes au chrono.");
      }
    } catch(e:any) {
      toast.error("Erreur de démarrage: " + e.message);
    }
  };

  const stopMatch = async (matchId: string) => {
    setConfirmAction({ type: 'stop', id: matchId });
  };

  const pauseMatch = async (matchId: string) => {
    try {
      const poolMatch = poolMatches?.find((m:any) => m.id === matchId);
      if (poolMatch) {
         await updateDoc(doc(db, 'matches', matchId), {
            status: "paused",
            pausedAt: Date.now()
         });
         return;
      }
      const bracketMatch = dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (bracketMatch) {
         const newMatches = [...dbState.bracket.matches];
         const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
         newMatches[matchIdx].status = "paused";
         newMatches[matchIdx].pausedAt = Date.now();
         await updateDoc(doc(db, 'state', 'main'), { bracket: { ...dbState.bracket, matches: newMatches } });
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const resumeMatch = async (matchId: string) => {
    try {
      const poolMatch = poolMatches?.find((m:any) => m.id === matchId);
      if (poolMatch && poolMatch.startedAt && poolMatch.pausedAt) {
         const pauseDuration = Date.now() - poolMatch.pausedAt;
         await updateDoc(doc(db, 'matches', matchId), {
            status: "playing",
            startedAt: poolMatch.startedAt + pauseDuration,
            pausedAt: null
         });
         return;
      }
      const bracketMatch = dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (bracketMatch && bracketMatch.startedAt && bracketMatch.pausedAt) {
         const newMatches = [...dbState.bracket.matches];
         const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
         const pauseDuration = Date.now() - bracketMatch.pausedAt;
         newMatches[matchIdx].status = "playing";
         newMatches[matchIdx].startedAt = bracketMatch.startedAt + pauseDuration;
         newMatches[matchIdx].pausedAt = null;
         await updateDoc(doc(db, 'state', 'main'), { bracket: { ...dbState.bracket, matches: newMatches } });
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const executeStopMatch = async () => {
    if (confirmAction?.type !== 'stop' || !confirmAction.id) return;
    const matchId = confirmAction.id;
    try {
      const poolMatch = poolMatches?.find((m:any) => m.id === matchId);
      if (poolMatch) {
         await updateDoc(doc(db, 'matches', matchId), {
            status: "pending",
            startedAt: null
         });
         setConfirmAction(null);
         return;
      }
      const bracketMatch = dbState.bracket?.matches?.find((m:any) => m.id === matchId);
      if (bracketMatch) {
         const newMatches = [...dbState.bracket.matches];
         const matchIdx = newMatches.findIndex((m:any) => m.id === matchId);
         newMatches[matchIdx].status = "pending";
         newMatches[matchIdx].startedAt = null;
         await updateDoc(doc(db, 'state', 'main'), { bracket: { ...dbState.bracket, matches: newMatches } });
      }
    } catch(e:any) {
      toast.error("Erreur d'arrêt: " + e.message);
    }
    setConfirmAction(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400 bg-slate-50 font-sans">Chargement du tournoi...</div>;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 text-center">
          <Trophy className="mx-auto mb-4 text-blue-500" size={48} />
          <div className="mb-2 font-extrabold text-[24px] tracking-tight text-slate-900">
            Petank<span className="text-blue-500">Live</span>
          </div>
          <h2 className="text-slate-500 mb-8 text-sm leading-relaxed">Entrez le code d'accès de votre équipe pour suivre vos matchs en direct.</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="text" 
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="CODE (ex: A7B2)" 
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-bold tracking-widest uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-md hover:bg-blue-700 transition-colors shadow-md cursor-pointer">
              Accéder à mes matchs
            </button>
          </form>
        </div>
      </div>
    );
  }

  const myTeam = dbState.teams?.find((t: any) => t.pin === teamPin);
  // Find which pool corresponds to myTeam
  let myPoolName = null;
  for (const poolName of Object.keys(dbState.pools || {})) {
    if (dbState.pools[poolName].includes(myTeam?.id)) {
      myPoolName = poolName;
      break;
    }
  }

  const poolNames = myPoolName ? [myPoolName] : [];
  const hasBracket = dbState.bracket && dbState.bracket.matches && dbState.bracket.matches.length > 0;
  const poolMatches = dbState.matches?.filter((m: any) => m.poolName === myPoolName) || [];
  const myBracketMatches = dbState.bracket?.matches?.filter((m:any) => m.team1 === myTeam?.id || m.team2 === myTeam?.id) || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <ConfirmModal 
        isOpen={!!confirmAction} 
        title="Arrêter le chronomètre"
        message="Voulez-vous vraiment arrêter le chronomètre pour ce match ?"
        onConfirm={executeStopMatch}
        onCancel={() => setConfirmAction(null)}
      />
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
        <div className="font-extrabold text-[18px] tracking-tight">
          Petank<span className="text-blue-500">Live</span>
        </div>
        <div className="flex gap-2">
           <button onClick={handleLogout} className="px-3 py-1.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border-none uppercase tracking-wider">
             Déconnexion
           </button>
        </div>
      </header>

      <div className="bg-blue-600 text-white p-6 shadow-iner text-center">
        <h2 className="text-2xl font-black mb-1 truncate">{myTeam?.name}</h2>
        <p className="opacity-80 text-sm">{myTeam?.player1} {myTeam?.player2 && `& ${myTeam.player2}`}</p>
        
        <div className="flex justify-center gap-2 mt-4">
           <button onClick={() => setActiveTab('pools')} className={`px-5 py-2 text-sm font-bold rounded-full transition-colors cursor-pointer border-none ${activeTab === 'pools' ? 'bg-white text-blue-600' : 'bg-blue-700/50 text-blue-100 hover:bg-blue-700'}`}>Ma Poule</button>
           {hasBracket && (
             <button onClick={() => setActiveTab('bracket')} className={`px-5 py-2 text-sm font-bold rounded-full transition-colors cursor-pointer border-none ${activeTab === 'bracket' ? 'bg-white text-blue-600' : 'bg-blue-700/50 text-blue-100 hover:bg-blue-700'}`}>Phases Finales</button>
           )}
        </div>
      </div>

      <main className="flex-1 p-4 pb-12 w-full mt-2">
        {activeTab === 'pools' && (
          poolNames.length === 0 ? (
            <div className="text-center text-slate-400 mt-12 text-sm bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <LayoutGrid className="mx-auto mb-3 opacity-50 text-slate-300" size={48} />
              <p>Vous n'êtes assigné à aucune poule pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {poolNames.map(poolName => {
                const teamIds = dbState.pools[poolName];
                const poolMatches = dbState.matches.filter((m: any) => m.poolName === poolName);
                
                // Calcul classement Petanque
                const rankings = teamIds.map((id: string) => {
                  const team = getTeam(id);
                  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
                  poolMatches.filter((m: any) => m.status === 'finished').forEach((m: any) => {
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
                  return { id, name: team.name, wins, diff: pointsFor - pointsAgainst, pointsFor };
                }).sort((a: any, b: any) => {
                  if (b.wins !== a.wins) return b.wins - a.wins;
                  if (b.diff !== a.diff) return b.diff - a.diff;
                  return b.pointsFor - a.pointsFor;
                });

                const finishedCount = poolMatches.filter((m:any) => m.status === 'finished').length;
                const totalCount = poolMatches.length;

                return (
                  <div key={poolName} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-5 py-3 font-black text-[16px] text-slate-800 border-b border-slate-200 flex justify-between items-center">
                      <span>Poule {poolName}</span>
                      <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">{finishedCount}/{totalCount} terminés</span>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                      {rankings.map((r:any, idx:number) => {
                        const isMe = r.id === myTeam?.id;
                        return (
                         <div key={r.id} className={`px-5 py-3 flex items-center justify-between text-sm ${isMe ? 'bg-blue-50/50' : ''}`}>
                           <div className="flex items-center gap-3 truncate flex-1">
                             <span className={`font-bold w-4 text-right ${isMe ? 'text-blue-600' : 'text-slate-400'}`}>{idx + 1}.</span>
                             <span className={`font-bold truncate ${isMe ? 'text-blue-900' : 'text-slate-700'}`}>{r.name} {isMe && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Moi</span>}</span>
                           </div>
                           <div className="flex gap-4 text-[13px] shrink-0 pl-2">
                             <span className={`font-black w-4 text-right ${isMe ? 'text-blue-900' : 'text-slate-900'}`}>{r.wins}</span>
                             <span className={`w-8 text-right font-bold ${r.diff > 0 ? 'text-emerald-500' : r.diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                               {r.diff > 0 ? '+' : ''}{r.diff}
                             </span>
                           </div>
                         </div>
                        )}
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 border-t border-slate-200">
                       <h4 className="text-[11px] font-bold uppercase text-slate-500 mb-3 tracking-wider">Vos rencontres</h4>
                       <div className="grid grid-cols-1 gap-2.5">
                         {(() => {
                           const myPoolMatches = poolMatches.filter((m: any) => m.team1 === myTeam?.id || m.team2 === myTeam?.id);
                           const firstPendingIdx = myPoolMatches.findIndex((m:any) => m.status === 'pending');
                           
                           return myPoolMatches.map((m:any, idx:number) => {
                             const t1 = getTeam(m.team1);
                             const t2 = getTeam(m.team2);
                             const isFin = m.status === 'finished';
                             const isPlaying = m.status === 'playing';
                             const isPaused = m.status === 'paused';
                             const isActive = isPlaying || isPaused;
                             const isPending = m.status === 'pending';
                             const isNextMatch = isPending && idx === firstPendingIdx;
                             const isUpcoming = isPending && !isNextMatch;
                             
                             const t1Won = isFin && Number(m.score1) > Number(m.score2);
                             const t2Won = isFin && Number(m.score2) > Number(m.score1);

                             return (
                               <div key={m.id} className={`flex flex-col text-sm border p-3 rounded-xl shadow-sm transition-all gap-3 overflow-hidden relative ${isUpcoming ? 'bg-slate-50 border-slate-200 opacity-60 grayscale-[50%]' : isFin ? 'bg-white border-slate-300 ring-2 ring-slate-100' : isPlaying ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-200' : isPaused ? 'bg-amber-50/20 border-amber-300 ring-2 ring-amber-100' : 'bg-white border-blue-300 ring-2 ring-blue-100'}`}>
                                 <div className="flex justify-between items-center w-full relative z-10">
                                   <span className={`flex-1 truncate text-right ${t1Won ? 'font-bold text-slate-900' : isFin ? 'text-slate-500' : 'font-medium text-slate-700'}`}>{t1.name}</span>
                                   <div className="px-2 flex flex-col gap-1 items-center justify-center shrink-0 min-w-[70px]">
                                     {isUpcoming ? (
                                        <span className="text-[9px] bg-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider">À venir</span>
                                     ) : isNextMatch ? (
                                        <span className="text-[20px] font-black text-slate-300">- : -</span>
                                     ) : !isActive && !isFin ? (
                                        <span className="text-[20px] font-black text-slate-300">- : -</span>
                                     ) : (
                                       <div className="flex gap-2 font-black text-[16px] text-slate-800">
                                         <span className={t1Won ? 'text-blue-600' : ''}>{isFin ? m.score1 : '-'}</span>
                                         <span className="text-slate-300 font-normal">:</span>
                                         <span className={t2Won ? 'text-blue-600' : ''}>{isFin ? m.score2 : '-'}</span>
                                       </div>
                                     )}
                                   </div>
                                   <span className={`flex-1 truncate text-left ${t2Won ? 'font-bold text-slate-900' : isFin ? 'text-slate-500' : 'font-medium text-slate-700'}`}>{t2.name}</span>
                                 </div>
                                 
                                 {isNextMatch && (
                                   <button onClick={() => startMatch(m.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs transition-colors border-none cursor-pointer mt-1 relative z-10">
                                      ▶ Démarrer la rencontre (30 min)
                                   </button>
                                 )}

                                 {scoreInput?.id === m.id ? (
                                   <div className="flex flex-col gap-2 mt-2 bg-slate-100 p-3 rounded-lg border border-slate-200 relative z-20">
                                     <div className="text-xs font-bold text-slate-700 text-center mb-1">Fin du match - Entrez le score</div>
                                     <div className="flex gap-2 items-center">
                                        <div className="flex-1 text-right text-xs font-bold text-slate-800 truncate pr-2">{t1.name}</div>
                                        <input type="number" 
                                           value={scoreInput.s1} 
                                           onChange={e => setScoreInput({...scoreInput, s1: e.target.value})} 
                                           className="w-12 h-10 text-center font-bold text-lg rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" 
                                           placeholder="0" 
                                        />
                                        <span className="font-bold text-slate-400">:</span>
                                        <input type="number" 
                                           value={scoreInput.s2} 
                                           onChange={e => setScoreInput({...scoreInput, s2: e.target.value})} 
                                           className="w-12 h-10 text-center font-bold text-lg rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" 
                                           placeholder="0" 
                                        />
                                        <div className="flex-1 text-left text-xs font-bold text-slate-800 truncate pl-2">{t2.name}</div>
                                     </div>
                                     <div className="flex gap-2 mt-2">
                                        <button onClick={() => setScoreInput(null)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">Annuler</button>
                                        <button onClick={() => handleScoreSubmit(m.id)} className="flex-1 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-700 cursor-pointer transition-colors border-none shadow-sm flex items-center justify-center gap-1">
                                           <Check size={14} /> Valider
                                        </button>
                                     </div>
                                   </div>
                                 ) : isActive && (
                                   <div className="flex flex-col gap-2 mt-1 relative z-10">
                                     <div className="flex justify-center items-center gap-2 bg-white/50 py-1.5 rounded-md">
                                       <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                       <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{isPlaying ? 'En cours' : 'En pause'}</span>
                                       <div className="ml-2 scale-125 origin-left"><MatchTimer startedAt={m.startedAt} pausedAt={m.pausedAt} status={m.status} /></div>
                                     </div>
                                     
                                     <button onClick={() => setScoreInput({id: m.id, s1: '', s2: ''})} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-[13px] transition-colors border-none cursor-pointer shadow-sm">
                                        Saisir le score
                                     </button>

                                     <div className="flex gap-2">
                                       {isPlaying ? (
                                         <button onClick={() => pauseMatch(m.id)} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                            ❚❚ Pause
                                         </button>
                                       ) : (
                                         <button onClick={() => resumeMatch(m.id)} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                            ▶ Reprendre
                                         </button>
                                       )}
                                       <button onClick={() => stopMatch(m.id)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                          ⏹ Annuler chrono
                                       </button>
                                     </div>
                                   </div>
                                 )}
                               </div>
                             );
                           });
                         })()}
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'bracket' && hasBracket && (
          <div className="bg-slate-50 p-4 border-t border-slate-200">
             <h4 className="text-[11px] font-bold uppercase text-slate-500 mb-3 tracking-wider">Tableau Final</h4>
             <div className="grid grid-cols-1 gap-2.5">
               {(() => {
                 const firstPendingIdx = myBracketMatches.findIndex((m:any) => m.status === 'pending');
                 
                 return myBracketMatches.map((m:any, idx:number) => {
                   const t1 = getTeam(m.team1);
                   const t2 = getTeam(m.team2);
                   const isFin = m.status === 'finished';
                   const isPlaying = m.status === 'playing';
                   const isPaused = m.status === 'paused';
                   const isActive = isPlaying || isPaused;
                   const isPending = m.status === 'pending';
                   const isNextMatch = isPending && idx === firstPendingIdx;
                   const isUpcoming = isPending && !isNextMatch;
                   
                   const t1Won = isFin && Number(m.score1) > Number(m.score2);
                   const t2Won = isFin && Number(m.score2) > Number(m.score1);

                   return (
                     <div key={m.id} className={`flex flex-col text-sm border p-3 rounded-xl shadow-sm transition-all gap-3 overflow-hidden relative ${isUpcoming ? 'bg-slate-50 border-slate-200 opacity-60 grayscale-[50%]' : isFin ? 'bg-white border-slate-300 ring-2 ring-slate-100' : isPlaying ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-200' : isPaused ? 'bg-amber-50/20 border-amber-300 ring-2 ring-amber-100' : 'bg-white border-blue-300 ring-2 ring-blue-100'}`}>
                       <div className="flex justify-between items-center w-full relative z-10">
                         <span className={`flex-1 truncate text-right ${t1Won ? 'font-bold text-slate-900' : isFin ? 'text-slate-500' : 'font-medium text-slate-700'}`}>{t1.name}</span>
                         <div className="px-2 flex flex-col gap-1 items-center justify-center shrink-0 min-w-[70px]">
                           {isUpcoming ? (
                              <span className="text-[9px] bg-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider">À venir</span>
                           ) : isNextMatch ? (
                              <span className="text-[20px] font-black text-slate-300">- : -</span>
                           ) : !isActive && !isFin ? (
                              <span className="text-[20px] font-black text-slate-300">- : -</span>
                           ) : (
                             <div className="flex gap-2 font-black text-[16px] text-slate-800">
                               <span className={t1Won ? 'text-blue-600' : ''}>{isFin ? m.score1 : '-'}</span>
                               <span className="text-slate-300 font-normal">:</span>
                               <span className={t2Won ? 'text-blue-600' : ''}>{isFin ? m.score2 : '-'}</span>
                             </div>
                           )}
                         </div>
                         <span className={`flex-1 truncate text-left ${t2Won ? 'font-bold text-slate-900' : isFin ? 'text-slate-500' : 'font-medium text-slate-700'}`}>{t2.name}</span>
                       </div>
                       
                       {isNextMatch && (
                         <button onClick={() => startMatch(m.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs transition-colors border-none cursor-pointer mt-1 relative z-10">
                            ▶ Démarrer la rencontre (30 min)
                         </button>
                       )}

                       {scoreInput?.id === m.id ? (
                         <div className="flex flex-col gap-2 mt-2 bg-slate-100 p-3 rounded-lg border border-slate-200 relative z-20">
                           <div className="text-xs font-bold text-slate-700 text-center mb-1">Fin du match - Entrez le score</div>
                           <div className="flex gap-2 items-center">
                              <div className="flex-1 text-right text-xs font-bold text-slate-800 truncate pr-2">{t1.name}</div>
                              <input type="number" 
                                 value={scoreInput.s1} 
                                 onChange={e => setScoreInput({...scoreInput, s1: e.target.value})} 
                                 className="w-12 h-10 text-center font-bold text-lg rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" 
                                 placeholder="0" 
                              />
                              <span className="font-bold text-slate-400">:</span>
                              <input type="number" 
                                 value={scoreInput.s2} 
                                 onChange={e => setScoreInput({...scoreInput, s2: e.target.value})} 
                                 className="w-12 h-10 text-center font-bold text-lg rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" 
                                 placeholder="0" 
                              />
                              <div className="flex-1 text-left text-xs font-bold text-slate-800 truncate pl-2">{t2.name}</div>
                           </div>
                           <div className="flex gap-2 mt-2">
                              <button onClick={() => setScoreInput(null)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">Annuler</button>
                              <button onClick={() => handleScoreSubmit(m.id)} className="flex-1 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-700 cursor-pointer transition-colors border-none shadow-sm flex items-center justify-center gap-1">
                                 <Check size={14} /> Valider
                              </button>
                           </div>
                         </div>
                       ) : isActive && (
                         <div className="flex flex-col gap-2 mt-1 relative z-10">
                           <div className="flex justify-center items-center gap-2 bg-white/50 py-1.5 rounded-md">
                             <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{isPlaying ? 'En cours' : 'En pause'}</span>
                             <div className="ml-2 scale-125 origin-left"><MatchTimer startedAt={m.startedAt} pausedAt={m.pausedAt} status={m.status} /></div>
                           </div>
                           
                           <button onClick={() => setScoreInput({id: m.id, s1: '', s2: ''})} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-[13px] transition-colors border-none cursor-pointer shadow-sm">
                              Saisir le score
                           </button>

                           <div className="flex gap-2">
                             {isPlaying ? (
                               <button onClick={() => pauseMatch(m.id)} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                  ❚❚ Pause
                               </button>
                             ) : (
                               <button onClick={() => resumeMatch(m.id)} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                  ▶ Reprendre
                               </button>
                             )}
                             <button onClick={() => stopMatch(m.id)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 rounded-lg text-xs transition-colors border-none cursor-pointer">
                                ⏹ Annuler chrono
                             </button>
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 });
               })()}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TvDisplayView() {
  const { state: db, loading } = useTournament();

  const getTeam = (id: string) => db.teams?.find((t:any) => t.id === id) || { name: "TBD" };

  if (loading) return <div className="h-screen bg-[#0B1120] flex items-center justify-center text-blue-500 text-2xl font-bold">Lancement de la régie...</div>;

  const poolNames = Object.keys(db.pools || {});
  const isBracketMode = db.tvMode === 'bracket' && db.bracket && db.bracket.matches;
  
  // Group matches by round for bracket view
  const roundsMap = new Map<number, any[]>();
  if (isBracketMode) {
    db.bracket.matches.forEach((m: any) => {
      if (!roundsMap.has(m.round)) roundsMap.set(m.round, []);
      roundsMap.get(m.round)!.push(m);
    });
  }
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => b - a);

  const getRoundLabel = (size: number) => {
    if (size === 2) return "Finale";
    if (size === 4) return "1/2 Finales";
    if (size === 8) return "1/4 Finales";
    if (size === 16) return "1/8 Finales";
    if (size === 32) return "1/16 Finales";
    return `Tours`;
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans flex flex-col h-screen overflow-hidden selection:bg-blue-500/30">
      <header className="flex justify-between items-end shrink-0 border-b border-white/10 p-4 md:p-8 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Trophy className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-black text-4xl tracking-tight text-white mb-0.5">
              Petank<span className="text-blue-500">TV</span>
            </h1>
            <div className="text-blue-400/80 font-bold tracking-widest uppercase text-[11px]">
              {isBracketMode ? 'Tableau Final En Direct' : 'Classement En Direct'}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-slate-300 uppercase">Direct</span>
          </div>
          <div className="text-slate-500 font-medium font-mono text-lg">
            {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4 md:p-8 pt-4">
        {isBracketMode ? (
          <div className="flex-1 overflow-x-auto overflow-y-auto w-full h-full custom-scrollbar">
            <div className="flex gap-12 min-w-[max-content] min-h-max items-stretch justify-start pb-12">
              {sortedRounds.map((roundSize, index) => {
                const matchesInRound = roundsMap.get(roundSize) || [];
                
                return (
                  <div key={roundSize} className="flex flex-col w-[280px]">
                    <div className="h-[60px] shrink-0 text-center mb-8 sticky top-0 bg-[#0B1120] z-20 py-2">
                       <h3 className="font-bold text-blue-400 uppercase tracking-widest text-sm">{getRoundLabel(roundSize)}</h3>
                       <div className="h-0.5 w-12 bg-blue-500/50 mx-auto mt-2 rounded-full"></div>
                    </div>
                    <div className="flex-1 flex flex-col justify-around">
                      {matchesInRound.map((m: any) => {
                        const t1 = getTeam(m.team1);
                        const t2 = getTeam(m.team2);
                        const s1 = m.score1 !== null ? m.score1 : '-';
                        const s2 = m.score2 !== null ? m.score2 : '-';
                        const isFin = m.status === 'finished';
                        const t1Won = isFin && Number(m.score1) > Number(m.score2);
                        const t2Won = isFin && Number(m.score2) > Number(m.score1);
                        const isPlaying = m.status === 'playing';
                        const isPaused = m.status === 'paused';

                        return (
                          <div key={m.id} className={`flex flex-col bg-[#111827] border ${isPlaying ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : isPaused ? 'border-amber-500/50' : 'border-white/10'} rounded-xl overflow-hidden relative group my-4`}>
                            {isPlaying && <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-pulse"></div>}
                            
                            <div className="flex justify-between items-center w-full">
                              <div className="flex flex-col flex-1">
                                <div className={`px-4 py-3 border-b border-white/5 flex justify-between items-center ${t1Won ? 'bg-white/5' : ''}`}>
                                  <span className={`truncate mr-2 ${t1Won ? 'font-bold text-white' : isFin ? 'text-slate-500' : 'text-slate-300 font-medium'}`}>{t1.name}</span>
                                  <span className={`font-black text-lg w-6 text-center ${t1Won ? 'text-blue-400' : 'text-slate-600'}`}>{s1}</span>
                                </div>
                                <div className={`px-4 py-3 flex justify-between items-center ${t2Won ? 'bg-white/5' : ''}`}>
                                  <span className={`truncate mr-2 ${t2Won ? 'font-bold text-white' : isFin ? 'text-slate-500' : 'text-slate-300 font-medium'}`}>{t2.name}</span>
                                  <span className={`font-black text-lg w-6 text-center ${t2Won ? 'text-blue-400' : 'text-slate-600'}`}>{s2}</span>
                                </div>
                              </div>
                            </div>
                            {(isPlaying || isPaused) && (
                              <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isPlaying ? 'En cours' : 'En pause'}</span>
                                </div>
                                <MatchTimer startedAt={m.startedAt} pausedAt={m.pausedAt} status={m.status} className={`font-bold bg-transparent px-0 py-0 ${isPaused ? 'text-amber-400' : 'text-blue-400'}`} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
        </div>
          </div>
        ) : poolNames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700">
            <Swords size={64} className="mb-6 opacity-20" />
            <span className="text-3xl font-bold tracking-tight">Le tirage au sort n'a pas encore eu lieu</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full auto-rows-max overflow-y-auto pr-2 pb-8 custom-scrollbar">
            {poolNames.sort().map(poolName => {
              const teamIds = db.pools[poolName];
              const poolMatches = db.matches.filter((m: any) => m.poolName === poolName);
              
              const rankings = teamIds.map((id: string) => {
                const team = getTeam(id);
                let wins = 0;
                let losses = 0;
                let pointsFor = 0;
                let pointsAgainst = 0;

                poolMatches.filter((m: any) => m.status === 'finished').forEach((m: any) => {
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
                
                const diff = pointsFor - pointsAgainst;
                return { id, name: team.name, wins, diff, pointsFor };
              }).sort((a: any, b: any) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.diff !== a.diff) return b.diff - a.diff;
                return b.pointsFor - a.pointsFor;
              });

              return (
                <div key={poolName} className="bg-[#111827] rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-xl relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                  
                  <div className="px-4 py-2.5 flex justify-between items-center bg-[#1F2937]/50 border-b border-white/5 relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-black text-white shadow-inner text-sm">
                        {poolName}
                      </div>
                      <h3 className="font-bold text-base text-white">Poule {poolName}</h3>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col relative z-10">
                    <div className="px-4 py-1.5 flex justify-end gap-4 border-b border-white/5 bg-black/20 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span className="w-4 text-center">V</span>
                      <span className="w-8 text-center">Diff</span>
                    </div>

                    <div className="p-1 space-y-0.5">
                      {rankings.map((r:any, idx:number) => {
                        const isFirst = idx === 0;
                        return (
                          <div key={r.id} className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                            isFirst ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent'
                          }`}>
                            <div className="flex items-center gap-2 flex-1 pr-2">
                              <span className={`font-black text-sm w-4 text-right shrink-0 ${isFirst ? 'text-blue-400' : 'text-slate-600'}`}>{idx + 1}.</span>
                              <span className={`font-bold text-[14px] leading-tight break-words ${isFirst ? 'text-white' : 'text-slate-300'}`}>{r.name}</span>
                            </div>
                            <div className="flex gap-4 shrink-0 pl-1 text-[13px]">
                              <span className={`w-4 text-center font-black ${isFirst ? 'text-blue-400' : 'text-slate-400'}`}>{r.wins}</span>
                              <span className={`w-8 text-center font-bold ${r.diff > 0 ? 'text-emerald-400' : r.diff < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                                {r.diff > 0 ? '+' : ''}{r.diff}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    {poolMatches.filter((m:any) => m.status === 'playing' || m.status === 'paused').length > 0 && (
                      <div className="px-2 pb-2 space-y-1">
                        {poolMatches.filter((m:any) => m.status === 'playing' || m.status === 'paused').map((match: any) => (
                           <div key={match.id} className={`p-2 bg-slate-900/50 rounded-lg border relative overflow-hidden group ${match.status === 'paused' ? 'border-amber-700/50' : 'border-slate-700/50'}`}>
                              <div className={`absolute top-0 left-0 w-0.5 h-full ${match.status === 'paused' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]'}`}></div>
                              <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5 pl-2">
                                 <span className="truncate flex-1 text-right font-medium">{getTeam(match.team1).name}</span>
                                 <span className="px-2 font-black text-slate-600 text-[9px] uppercase">vs</span>
                                 <span className="truncate flex-1 text-left font-medium">{getTeam(match.team2).name}</span>
                              </div>
                              <div className="flex justify-center items-center gap-2 bg-black/40 rounded p-1 mx-2 border border-white/5">
                                 <div className={`w-1.5 h-1.5 rounded-full ${match.status === 'paused' ? 'bg-amber-500' : 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                                 <MatchTimer startedAt={match.startedAt} pausedAt={match.pausedAt} status={match.status} className={`font-bold bg-transparent px-0 py-0 ${match.status === 'paused' ? 'text-amber-400' : 'text-blue-400'}`} />
                              </div>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      {db.tvMessage && db.tvMessage.trim() !== '' && (
        <div className="bg-blue-600 text-white font-bold text-xl py-4 overflow-hidden relative border-t border-blue-500/50 shadow-[0_-10px_20px_rgba(59,130,246,0.2)] shrink-0 h-[60px]">
          <div className="animate-marquee whitespace-nowrap absolute left-0 top-1/2 -translate-y-1/2">
            <span className="mx-12">⭐ {db.tvMessage} ⭐</span>
            <span className="mx-12">⭐ {db.tvMessage} ⭐</span>
            <span className="mx-12">⭐ {db.tvMessage} ⭐</span>
            <span className="mx-12">⭐ {db.tvMessage} ⭐</span>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        @keyframes marquee {
          0% { transform: translateY(-50%) translateX(100vw); }
          100% { transform: translateY(-50%) translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}

function MatchTimer({ startedAt, pausedAt, status, className }: { startedAt: number | null, pausedAt?: number | null, status?: string, className?: string }) {
  if (!startedAt) return null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status === 'paused') {
      if (pausedAt) setNow(pausedAt);
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status, pausedAt]);
  
  const referenceTime = status === 'paused' && pausedAt ? pausedAt : now;
  const maxTime = 30 * 60; // 30 mins
  const elapsed = Math.floor((referenceTime - startedAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isOverTime = elapsed >= maxTime;
  
  const defaultLightClass = isOverTime && status !== 'paused' ? 'bg-red-100 text-red-600 animate-pulse' : status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
  const appliedClass = className !== undefined ? className : defaultLightClass;

  return (
    <span className={`inline-flex items-center justify-center font-mono font-bold px-2 py-0.5 rounded text-[10px] tabular-nums tracking-tighter ${appliedClass} ${isOverTime && status !== 'paused' ? 'animate-pulse' : ''}`}>
      {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}
