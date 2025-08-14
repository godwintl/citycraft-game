import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Coins, Undo2, Play, Info, Target, RefreshCcw, ListChecks, X, AlertCircle, Lock, MessageSquare, Sparkles } from "lucide-react";

/**
 * CityCraft — Built Environment (Enhanced Graphics Edition)
 */

const GRID = 7;
const MAX_TURNS = 30;
const START_BUDGET = 1000;

const SPRITES = {
  hdb: { emoji: "🏢", bg: "from-amber-300 to-orange-400", text: "HDB Block", glow: "shadow-amber-400/50" },
  mrt: { emoji: "🚇", bg: "from-yellow-300 to-yellow-500", text: "MRT", glow: "shadow-yellow-400/50" },
  park: { emoji: "🌳", bg: "from-green-300 to-emerald-400", text: "Park", glow: "shadow-emerald-400/50" },
  hawker: { emoji: "🍜", bg: "from-rose-300 to-orange-300", text: "Hawker", glow: "shadow-rose-400/50" },
  school: { emoji: "🏫", bg: "from-sky-300 to-indigo-300", text: "School", glow: "shadow-indigo-400/50" },
  factory: { emoji: "🏭", bg: "from-zinc-300 to-neutral-400", text: "Factory", glow: "shadow-zinc-400/50" },
  road: { emoji: "🛣️", bg: "from-stone-300 to-stone-400", text: "Road", glow: "shadow-stone-400/50" },
};

const CATALOGUE = [
  { id: "hdb", name: "HDB Block", cost: 60, effect: { access: 5, green: 0, noise: 4, jobs: 0, housing: 12 }, tip: "Adds homes. Best near MRT." },
  { id: "mrt", name: "MRT Station", cost: 150, effect: { access: 25, green: 0, noise: 6, jobs: 2, housing: 0 }, tip: "Big access. Slightly noisy." },
  { id: "park", name: "Park", cost: 45, effect: { access: 0, green: 12, noise: -3, jobs: 0, housing: 0 }, tip: "Calms noise and adds green." },
  { id: "hawker", name: "Hawker Centre", cost: 70, effect: { access: 8, green: 0, noise: 5, jobs: 6, housing: 0 }, tip: "Food & jobs. A bit noisy." },
  { id: "school", name: "Primary School", cost: 85, effect: { access: 10, green: 0, noise: 2, jobs: 3, housing: 3 }, tip: "Families like this nearby." },
  { id: "factory", name: "Factory", cost: 100, effect: { access: 2, green: -6, noise: 12, jobs: 15, housing: 0 }, tip: "Many jobs, hurts green & noise." },
  { id: "road", name: "Road", cost: 30, effect: { access: 4, green: -2, noise: 3, jobs: 0, housing: 0 }, tip: "Faster travel, more noise." },
];

const TARGETS = { access: 85, green: 60, noiseMax: 50, jobs: 45, housing: 55 };

const DEBRIEF_QUESTIONS = [
  { q: "What sacrifices did you have to make to stay within budget?", id: "budget" },
  { q: "Why do factories provide many jobs but hurt green space and create noise? Can you think of real examples?", id: "factories" },
  { q: "Why do you think HDB blocks get bonus points when placed near MRT stations?", id: "hdb-mrt" },
  { q: "The game shows parks reducing noise. How do green spaces actually help with noise in real life?", id: "parks" },
  { q: "Is it realistic to meet all five targets in real city planning? Why or why not?", id: "realistic" },
  { q: "Compare your winning layouts with classmates. What patterns do you notice?", id: "patterns" }
];

function neighbours(idx) {
  const r = Math.floor(idx / GRID);
  const c = idx % GRID;
  const ds = [ [1,0], [-1,0], [0,1], [0,-1] ];
  const res = [];
  for (const [dr, dc] of ds) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID) res.push(rr * GRID + cc);
  }
  return res;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// Simplified sound system (no Tone.js to avoid errors)
const useSounds = () => {
  const playSound = async (type) => {
    // Sound disabled to avoid Tone.js import errors
    // Game works perfectly without sound effects
    return;
  };
  
  return { playSound };
};

// Animated background particles
const FloatingParticle = ({ delay }) => {
  return (
    <motion.div
      className="absolute w-1 h-1 bg-white/20 rounded-full"
      initial={{ y: 100, x: Math.random() * 100 + "%", opacity: 0 }}
      animate={{ 
        y: -20, 
        x: Math.random() * 100 + "%",
        opacity: [0, 0.5, 0]
      }}
      transition={{ 
        duration: 10 + Math.random() * 5,
        delay: delay,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
};

const Bar = ({ label, value, target, inverse=false }) => {
  const pct = inverse ? (value <= target ? 100 : clamp(100 - ((value - target)/Math.max(target,1))*100, 0, 100)) : clamp((value/Math.max(target,1))*100, 0, 100);
  const good = inverse ? value <= target : value >= target;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-semibold">
        <span className="uppercase tracking-wide text-slate-600">{label}</span>
        <span className={`flex items-center gap-1 ${good ? "text-emerald-600" : "text-rose-600"}`}>
          {good && <Sparkles size={12}/>}
          {inverse ? `≤ ${target}`: `≥ ${target}`} · {value}
        </span>
      </div>
      <div className="w-full h-3 rounded-full bg-gradient-to-r from-slate-200 to-slate-300 overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className={`h-3 ${good ? "bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-emerald-400/50" : "bg-gradient-to-r from-rose-400 to-rose-600 shadow-rose-400/50"} shadow-lg`}
        />
      </div>
    </div>
  );
};

const Tile = ({ id, isNew = false }) => {
  if (!id) return (
    <div className="w-full h-full bg-transparent"/>
  );
  const sp = SPRITES[id];
  return (
    <motion.div
      initial={isNew ? { scale: 0, y: 30, opacity: 0, rotateX: -90 } : { scale: 1, opacity: 1 }}
      animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
      exit={{ scale: 0, y: 20, opacity: 0, rotateX: 90 }}
      transition={{ 
        type: "spring", 
        stiffness: 180, 
        damping: 12,
        duration: 0.5
      }}
      className={`w-full h-full rounded-xl bg-gradient-to-br ${sp.bg} relative flex items-center justify-center select-none shadow-xl ${sp.glow} shadow-lg hover:scale-105 transition-transform`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <motion.div 
        initial={isNew ? { scale: 0, rotate: -180 } : { scale: 1 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="text-3xl md:text-4xl drop-shadow-lg"
      >
        {sp.emoji}
      </motion.div>
      <div className="absolute bottom-1 left-1 right-1 text-[10px] text-slate-800 bg-white/90 backdrop-blur-sm rounded px-1 line-clamp-1 font-medium">
        {sp.text}
      </div>
      {isNew && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />
      )}
    </motion.div>
  );
};

function terrainClass(t) {
  switch (t) {
    case 'water':
      return 'bg-gradient-to-br from-sky-300 to-blue-400';
    case 'greenbelt':
      return 'bg-gradient-to-br from-green-200 to-emerald-300';
    default:
      return 'bg-gradient-to-br from-emerald-100 to-lime-200';
  }
}

function CityCraft() {
  const [grid, setGrid] = useState(Array(GRID * GRID).fill(null));
  const [selected, setSelected] = useState(null);
  const [budget, setBudget] = useState(START_BUDGET);
  const [turns, setTurns] = useState(0);
  const [phase, setPhase] = useState("menu");
  const [hoverIdx, setHoverIdx] = useState(null);
  const [toast, setToast] = useState("Pick a building, then click the map.");
  const [showObjectives, setShowObjectives] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [debriefUnlocked, setDebriefUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [newTiles, setNewTiles] = useState(new Set());
  const { playSound } = useSounds();

  const TERRAIN = useMemo(() => {
    const a = Array(GRID*GRID).fill('land');
    for (let c = 0; c < GRID; c++) a[0*GRID + c] = 'water';
    for (let r = 0; r < GRID; r++) a[r*GRID + 0] = 'water';
    for (let r = 2; r < GRID-1; r++) a[r*GRID + 3] = 'water';
    a[2*GRID + 5] = 'greenbelt';
    a[3*GRID + 5] = 'greenbelt';
    a[4*GRID + 1] = 'greenbelt';
    a[5*GRID + 2] = 'greenbelt';
    return a;
  }, []);

  const metrics = useMemo(() => {
    let access=0, green=0, noise=0, jobs=0, housing=0;
    grid.forEach((cell, idx) => {
      if (!cell) return;
      const e = CATALOGUE.find(x=>x.id===cell).effect;
      access += e.access; green += e.green; noise += e.noise; jobs += e.jobs; housing += e.housing;
      if (cell === "hdb") {
        if (neighbours(idx).some(n => grid[n] === "mrt")) access += 6;
      }
      if (["hdb","school","hawker"].includes(cell)) {
        if (neighbours(idx).some(n => grid[n] === "park")) noise -= 1;
      }
    });
    return { access: Math.round(access), green: Math.round(green), noise: Math.max(0,Math.round(noise)), jobs: Math.round(jobs), housing: Math.round(housing) };
  }, [grid]);

  const targetsMet = metrics.access>=TARGETS.access && metrics.green>=TARGETS.green && metrics.noise<=TARGETS.noiseMax && metrics.jobs>=TARGETS.jobs && metrics.housing>=TARGETS.housing;

  function start() {
    setGrid(Array(GRID * GRID).fill(null));
    setSelected(null); 
    setBudget(START_BUDGET); 
    setTurns(0); 
    setPhase("play");
    setToast("Hint: HDB next to MRT boosts access.");
    setShowObjectives(false);
    setShowHelp(false);
    setShowDebrief(false);
    setShowResult(false);
    setNewTiles(new Set());
    playSound('select');
  }

  function selectBuilding(id) {
    setSelected(id);
    playSound('select');
  }

  function place(idx) {
    if (phase !== "play") return;
    
    if (TERRAIN[idx] === 'water' && !grid[idx]) {
      setToast("⚠️ Cannot build on water!");
      playSound('error');
      return;
    }
    
    if (grid[idx]) {
      const cur = CATALOGUE.find(x=>x.id===grid[idx]);
      const refund = Math.ceil(cur.cost/2);
      const g2 = [...grid]; 
      g2[idx] = null; 
      setGrid(g2); 
      setBudget(b=>b+refund);
      setToast(`Demolished ${cur.name}. Refund: +${refund}`);
      playSound('remove');
      
      setNewTiles(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
      return;
    }
    
    if (!selected) { 
      setToast("Select a building first."); 
      playSound('error');
      return; 
    }
    
    const item = CATALOGUE.find(x=>x.id===selected);
    if (budget - item.cost < -50) { 
      setToast("Budget too low."); 
      playSound('error');
      return; 
    }
    
    const g2 = [...grid]; 
    g2[idx] = selected; 
    setGrid(g2);
    setBudget(b=>b-item.cost); 
    setTurns(t=>t+1); 
    setToast(`✓ ${item.name} built! -${item.cost}`);
    
    setNewTiles(prev => new Set(prev).add(idx));
    setTimeout(() => {
      setNewTiles(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }, 600);
    
    playSound('place');
  }

  const turnsLeft = MAX_TURNS - turns;

  useEffect(()=>{
    if (phase!=="play") return;
    if (targetsMet) {
      setPhase("result");
      setShowResult(true);
      playSound('win');
    } else if (turnsLeft<=0 || budget<-50) {
      setPhase("result");
      setShowResult(true);
    }
  }, [turnsLeft, budget, targetsMet, phase, playSound]);

  const handlePasswordSubmit = () => {
    if (passwordInput.toLowerCase() === "hems") {
      setDebriefUnlocked(true);
      setPasswordInput("");
      playSound('select');
    } else {
      setToast("Incorrect password");
      playSound('error');
      setPasswordInput("");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-100 text-slate-900 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({length: 20}).map((_, i) => (
          <FloatingParticle key={i} delay={i * 0.5} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              CityCraft: Built Environment
            </h1>
            <p className="text-sm text-slate-600">Balance access, green space, noise, jobs, and housing to create a liveable town.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {phase!=="play" && (
              <button onClick={start} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
                <Play size={16}/> Start
              </button>
            )}
            {phase==="play" && (
              <button onClick={()=>{setPhase("result"); setShowResult(true);}} className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
                <Target size={16}/> Finish
              </button>
            )}
            <button onClick={()=>setShowObjectives(true)} className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
              <ListChecks size={16}/> Objectives
            </button>
            <button onClick={()=>setShowHelp(!showHelp)} className="px-3 py-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
              <Info size={16}/> {showHelp?"Close":"How to Play"}
            </button>
            <button onClick={()=>setShowDebrief(!showDebrief)} className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
              <MessageSquare size={16}/> Debrief
            </button>
          </div>
        </div>

        {/* HUD ribbon */}
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-900 border border-indigo-200/50 backdrop-blur-sm text-sm inline-flex items-center gap-2 shadow-md">
          <Target size={16}/> <span className="font-semibold">Goal:</span> Meet <span className="font-bold">all five targets</span> before you run out of <span className="font-bold">budget ($1000)</span> or <span className="font-bold">turns (30)</span>.
        </div>

        {/* HUD Stats */}
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg flex items-center justify-between">
            <div className="text-xs text-slate-500">Budget</div>
            <div className={`text-2xl font-bold tabular-nums flex items-center gap-2 ${budget>=0?"text-emerald-700":"text-rose-700"}`}>
              <Coins size={18}/>${budget}
            </div>
          </div>
          <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg flex items-center justify-between">
            <div className="text-xs text-slate-500">Turns Left</div>
            <div className={`text-2xl font-bold ${turnsLeft>=6?"text-emerald-700":turnsLeft>=1?"text-amber-600":"text-rose-700"}`}>
              {Math.max(0,turnsLeft)}
            </div>
          </div>
          <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg flex items-center justify-between">
            <div className="text-xs text-slate-500">Win Check</div>
            <div className="text-xs text-slate-700">All bars green ✔️</div>
          </div>
          <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg md:col-span-1 text-sm">
            <span className="font-semibold">Tip:</span> {toast}
          </div>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50 backdrop-blur-sm shadow-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Info size={16}/> How to Play
            </h3>
            <ol className="list-decimal ml-5 space-y-1 text-sm">
              <li>Select a building from the Build Menu on the left.</li>
              <li>Click on the map grid to place it (cannot build on water tiles).</li>
              <li>Click on a placed building to remove it (get 50% refund).</li>
              <li>Meet all five targets before running out of budget or turns.</li>
              <li><strong>Bonus:</strong> HDB blocks next to MRT stations get +6 accessibility.</li>
              <li><strong>Bonus:</strong> Parks reduce noise for adjacent homes, schools, and hawker centres.</li>
            </ol>
            <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <p className="flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0"/>
                <span>Blue tiles are water - you cannot build on them!</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Debrief Panel */}
        {showDebrief && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/50 backdrop-blur-sm shadow-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare size={16}/> Debrief Questions
            </h3>
            {!debriefUnlocked ? (
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-purple-600"/>
                <input
                  type="password"
                  placeholder="Enter password to unlock"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  className="flex-1 px-3 py-2 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handlePasswordSubmit}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  Unlock
                </button>
              </div>
            ) : (
              <ol className="space-y-3 text-sm">
                {DEBRIEF_QUESTIONS.map((item, idx) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="font-semibold text-purple-600">{idx + 1}.</span>
                    <span>{item.q}</span>
                  </li>
                ))}
              </ol>
            )}
          </motion.div>
        )}

        <div className="grid md:grid-cols-12 gap-4">
          {/* Catalogue */}
          <aside className="md:col-span-3 p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-xl h-max">
            <h2 className="font-bold mb-3 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Build Menu</h2>
            <div className="space-y-2">
              {CATALOGUE.map(b => (
                <button key={b.id} onClick={()=>selectBuilding(b.id)} title={b.tip}
                  className={`w-full p-2 rounded-xl border-2 flex items-center gap-3 transition-all ${selected===b.id?"border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 scale-105 shadow-lg":"border-slate-200 hover:border-indigo-300 hover:shadow-md bg-white"}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${SPRITES[b.id].bg} flex items-center justify-center text-xl shadow-md`}>
                    {SPRITES[b.id].emoji}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium leading-tight">{b.name}</div>
                    <div className="text-[11px] text-slate-600">{b.tip}</div>
                  </div>
                  <div className="text-sm font-bold text-indigo-600">${b.cost}</div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs text-slate-600 flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <Undo2 size={14}/>Click a placed tile to remove it (50% refund).
            </div>

            {/* Minimap legend */}
            <div className="mt-4 p-2 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border text-xs">
              <div className="font-semibold mb-1">Minimap Legend</div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-gradient-to-br from-sky-300 to-blue-400 shadow-sm"/> Water (No Build)
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-gradient-to-br from-emerald-100 to-lime-200 shadow-sm"/> Land
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-gradient-to-br from-green-200 to-emerald-300 shadow-sm"/> Greenbelt
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <main className="md:col-span-6">
            <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-xl">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`, perspective: '1000px' }}>
                {Array.from({ length: GRID*GRID }).map((_, idx) => {
                  const cell = grid[idx];
                  const preview = !cell && selected && TERRAIN[idx] !== 'water';
                  const terr = TERRAIN[idx];
                  const isWater = terr === 'water';
                  const canBuild = !isWater || cell;
                  
                  return (
                    <div key={idx}
                         className="relative aspect-square"
                         onMouseEnter={()=>setHoverIdx(idx)} 
                         onMouseLeave={()=>setHoverIdx(null)}>
                      <button
                        onClick={()=>place(idx)}
                        className={`w-full h-full rounded-xl border-2 overflow-hidden group transition-all ${canBuild ? 'border-white/50 hover:border-indigo-300' : 'border-blue-400/50 cursor-not-allowed'}`}>
                        {/* Terrain background */}
                        <div className={`absolute inset-0 ${terrainClass(terr)} opacity-90`} />
                        {/* Water animation */}
                        {isWater && (
                          <motion.div 
                            className="absolute inset-0 flex items-center justify-center text-sky-600/40 text-2xl"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}>
                            🌊
                          </motion.div>
                        )}
                        {/* Placed tile */}
                        <AnimatePresence>
                          {cell && (
                            <motion.div key="tile" className="absolute inset-0 z-10">
                              <Tile id={cell} isNew={newTiles.has(idx)}/>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {/* Ghost preview */}
                        {preview && hoverIdx===idx && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={`absolute inset-0 rounded-xl ring-2 ring-indigo-400/70 bg-gradient-to-br ${SPRITES[selected].bg} opacity-60 flex items-center justify-center z-5`}>
                            <div className="text-3xl animate-pulse">{SPRITES[selected].emoji}</div>
                            <div className="absolute top-1 right-1 text-[10px] bg-white/90 backdrop-blur-sm rounded px-1 font-bold">
                              -${CATALOGUE.find(x=>x.id===selected).cost}
                            </div>
                          </motion.div>
                        )}
                        {/* Water warning */}
                        {isWater && !cell && selected && hoverIdx===idx && (
                          <div className="absolute inset-0 flex items-center justify-center z-20">
                            <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded animate-pulse">
                              Can't build on water!
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>

          {/* Targets */}
          <aside className="md:col-span-3 p-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-xl h-max">
            <h2 className="font-bold mb-3 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Targets</h2>
            <Bar label="Accessibility" value={metrics.access} target={TARGETS.access} />
            <Bar label="Green Space" value={metrics.green} target={TARGETS.green} />
            <Bar label="Noise" value={metrics.noise} target={TARGETS.noiseMax} inverse />
            <Bar label="Jobs" value={metrics.jobs} target={TARGETS.jobs} />
            <Bar label="Housing" value={metrics.housing} target={TARGETS.housing} />

            <div className="mt-3 text-xs bg-gradient-to-r from-slate-50 to-slate-100 border rounded-xl p-2">
              <div className="font-semibold mb-1">Quick Hints</div>
              <ul className="list-disc ml-4 space-y-1">
                <li>HDB next to MRT gives extra accessibility.</li>
                <li>Parks reduce nearby noise.</li>
                <li>Factories = jobs but hurt green + noise.</li>
                <li>Blue water tiles cannot be built on.</li>
              </ul>
            </div>

            {targetsMet && (
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="mt-3 p-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 text-emerald-700 text-sm inline-flex items-center gap-2 shadow-lg">
                <CheckCircle2 size={16}/> All targets met!
              </motion.div>
            )}
          </aside>
        </div>
      </div>

      {/* Objectives Modal */}
      <AnimatePresence>
        {showObjectives && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowObjectives(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border p-5">
              <button className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-100 transition-colors" onClick={()=>setShowObjectives(false)} aria-label="Close objectives">
                <X size={18}/>
              </button>
              
              <div className="text-center mb-4">
                <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                  Welcome to CityCraft: Built Environment
                </h2>
                <p className="text-sm text-slate-600 italic">Designed by Godwin Tan</p>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <ListChecks size={18} className="text-emerald-700"/>
                <h3 className="text-xl font-bold">Game Objectives</h3>
              </div>
              <ol className="list-decimal ml-5 space-y-1 text-sm">
                <li><span className="font-semibold">Win Condition:</span> Turn all five meters green by the end of the game.</li>
                <li><span className="font-semibold">Targets to meet:</span> Accessibility ≥ {TARGETS.access}; Green Space ≥ {TARGETS.green}; Noise ≤ {TARGETS.noiseMax}; Jobs ≥ {TARGETS.jobs}; Housing ≥ {TARGETS.housing}.</li>
                <li><span className="font-semibold">Limits:</span> Budget starts at $1000. You have 30 turns (placements).</li>
                <li><span className="font-semibold">Bonuses:</span> HDB next to MRT gives extra Accessibility. Parks reduce noise for nearby HDB/School/Hawker.</li>
                <li><span className="font-semibold">Note:</span> Remove a tile to get <b>50% refund</b> and try a new idea.</li>
                <li><span className="font-semibold">Water Tiles:</span> Blue water tiles cannot be built on - plan around them!</li>
              </ol>
              <div className="mt-4 flex gap-2 justify-center">
                <button onClick={start} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
                  <Play size={16}/> Start Game
                </button>
                <button onClick={()=>setShowObjectives(false)} className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 transition-colors">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border p-6 text-center">
              <div className="mb-4">
                {targetsMet ? (
                  <>
                    <div className="text-6xl mb-3">🎉</div>
                    <h3 className="text-2xl font-bold mb-2 text-emerald-600">Victory!</h3>
                    <p className="text-sm text-slate-600">Fantastic work! You've created a balanced, liveable city!</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-3">🏗️</div>
                    <h3 className="text-2xl font-bold mb-2 text-amber-600">Round Over</h3>
                    <p className="text-sm text-slate-600">Keep trying! Adjust your strategy to meet all targets.</p>
                  </>
                )}
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <div className="text-xs text-slate-500 mb-2">Final Score</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Accessibility:</span>
                    <span className={metrics.access >= TARGETS.access ? "text-emerald-600 font-semibold" : "text-rose-600"}>{metrics.access}/{TARGETS.access}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Green Space:</span>
                    <span className={metrics.green >= TARGETS.green ? "text-emerald-600 font-semibold" : "text-rose-600"}>{metrics.green}/{TARGETS.green}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Noise:</span>
                    <span className={metrics.noise <= TARGETS.noiseMax ? "text-emerald-600 font-semibold" : "text-rose-600"}>{metrics.noise}/{TARGETS.noiseMax}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jobs:</span>
                    <span className={metrics.jobs >= TARGETS.jobs ? "text-emerald-600 font-semibold" : "text-rose-600"}>{metrics.jobs}/{TARGETS.jobs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Housing:</span>
                    <span className={metrics.housing >= TARGETS.housing ? "text-emerald-600 font-semibold" : "text-rose-600"}>{metrics.housing}/{TARGETS.housing}</span>
                  </div>
                </div>
              </div>
              
              <button onClick={() => {setShowResult(false); start();}} className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
                <RefreshCcw size={16}/> Play Again
              </button>
              
              <div className="mt-3 text-xs text-slate-400">
                CityCraft designed by Godwin Tan
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export the component as default
export default CityCraft;
