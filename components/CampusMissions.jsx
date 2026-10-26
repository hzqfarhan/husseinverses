"use client";

import { useEffect, useRef, useState } from "react";
import { ADVENTURE_STORAGE_KEY, GAME_EVENT, MISSIONS, createProgress, parseProgress, serializeProgress, applyGameEvent, getAdventureSummary, trackMission } from "../lib/game-progress.js";

function BadgeIcon({ kind, locked = false }) {
  const paths = {
    footsteps: <><path d="m12 8 3 1-2 6-3-1zM18 19l3 1-2 5-3-1z"/><path d="M14 5h.01M17 6h.01M20 16h.01M23 17h.01"/></>,
    faculty: <><path d="m6 12 10-5 10 5-10 5zM10 15v7c4 3 8 3 12 0v-7M26 12v9"/></>,
    landmark: <><path d="m7 12 9-6 9 6zM7 25h18M9 22V14M16 22V14M23 22V14"/></>,
    bus: <><rect x="7" y="7" width="18" height="17" rx="4"/><path d="M7 16h18M11 24v3M21 24v3M12 20h.01M20 20h.01M12 10h8"/></>,
    panorama: <><rect x="5" y="9" width="22" height="15" rx="3"/><circle cx="16" cy="16.5" r="4"/><path d="m11 9 2-3h6l2 3"/></>,
    sun: <><path d="M5 24h22M8 20a8 8 0 0 1 16 0M16 5v4M6 9l3 3M26 9l-3 3M3 18h4M25 18h4"/></>,
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true" className={locked ? "adventure-badge-icon is-locked" : "adventure-badge-icon"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind] || paths.landmark}</svg>;
}

function ObjectiveMark({ done }) {
  return <span className={`adventure-objective-mark${done ? " is-done" : ""}`} aria-hidden="true">{done && <svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>;
}

export default function CampusMissions() {
  const [progress, setProgress] = useState(createProgress);
  const [open, setOpen] = useState(false), [tab, setTab] = useState("missions");
  const [ready, setReady] = useState(false), [toast, setToast] = useState(null), [resetConfirm, setResetConfirm] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const progressRef = useRef(progress), dialogRef = useRef(null), openerRef = useRef(null), toastTimer = useRef(null);
  const summary = getAdventureSummary(progress), active = summary.active;
  const nextObjective = active.objectives.find((objective) => !objective.complete);
  const allDone = summary.completedCount === MISSIONS.length;

  useEffect(() => {
    let initial = createProgress();
    try { initial = parseProgress(localStorage.getItem(ADVENTURE_STORAGE_KEY)); } catch { setStorageUnavailable(true); }
    progressRef.current = initial; setProgress(initial); setReady(true);
    const receive = (event) => {
      const previous = progressRef.current, next = applyGameEvent(previous, event.detail);
      const old = getAdventureSummary(previous), current = getAdventureSummary(next);
      progressRef.current = next; setProgress(next);
      const earned = current.completed.filter((mission) => !old.completed.some((item) => item.id === mission.id));
      if (earned.length) {
        clearTimeout(toastTimer.current);
        setToast({ badge: earned[0].badge, icon: earned[0].icon, color: earned[0].color, xp: earned.reduce((sum, mission) => sum + mission.xp, 0), count: earned.length });
        toastTimer.current = setTimeout(() => setToast(null), 5500);
      }
      try { localStorage.setItem(ADVENTURE_STORAGE_KEY, serializeProgress(next)); } catch { setStorageUnavailable(true); }
    };
    window.addEventListener(GAME_EVENT, receive);
    return () => { window.removeEventListener(GAME_EVENT, receive); clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const overlay = dialogRef.current?.closest(".adventure-overlay"), app = document.getElementById("app");
    const previousInert = new Map();
    const reserveDialog = () => {
      for (const sibling of app?.children || []) {
        if (sibling === overlay || sibling.contains(overlay)) continue;
        if (!previousInert.has(sibling)) previousInert.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    };
    reserveDialog();
    const observer = new MutationObserver(reserveDialog);
    if (app) observer.observe(app, { childList: true });
    window.dispatchEvent(new CustomEvent("husseinverse:missions-visibility", { detail: true }));
    const first = dialogRef.current?.querySelector("button"); first?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); setResetConfirm(false); }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]') || [])].filter((element) => element.getClientRects().length);
      const firstControl = controls[0], lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl?.focus(); }
      else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl?.focus(); }
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      observer.disconnect();
      for (const [element, inert] of previousInert) element.inert = inert;
      window.removeEventListener("keydown", keydown, true);
      window.dispatchEvent(new CustomEvent("husseinverse:missions-visibility", { detail: false }));
      if (previousFocus?.isConnected) previousFocus.focus(); else openerRef.current?.focus();
    };
  }, [open]);

  function save(next) {
    progressRef.current = next; setProgress(next);
    try { localStorage.setItem(ADVENTURE_STORAGE_KEY, serializeProgress(next)); } catch { setStorageUnavailable(true); }
  }
  function navigate(placeId) {
    setOpen(false); setResetConfirm(false);
    window.dispatchEvent(new CustomEvent("husseinverse:mission-navigate", { detail: { placeId } }));
  }
  function openJournal() { setOpen(true); setResetConfirm(false); }
  function startWalking() {
    setOpen(false); setResetConfirm(false);
    // Activate the same visible control as a normal player. The scene remains
    // responsible for movement events and rewards, so this cannot earn a visit.
    requestAnimationFrame(() => {
      document.getElementById("walk-mode")?.click();
      document.getElementById("world")?.focus();
    });
  }
  const objectiveHelp = (objective) => objective.kind === "walkMode" || objective.kind === "walkSeconds"
    ? "Choose Go for a walk. Use the thumbstick on touch screens or W A S D / arrow keys on a keyboard. Hold Shift to run. Only time spent moving counts."
    : objective.kind === "evening" ? "Use the sun button at the top of the campus view to switch the light."
    : objective.kind === "panorama" ? "Find the place, then choose its 360° view. This task records opening the view."
    : objective.kind === "distinctArrivals" ? "Use Find to choose your first shelter. Walk here or reach its entrance, then find two other stops."
    : "Find the place, then choose Walk here or walk to its entrance to check in.";
  const countLabel = (objective) => objective.kind === "walkSeconds"
    ? `${Math.floor(objective.value)} / ${objective.target} sec`
    : objective.target > 1 ? `${objective.value} / ${objective.target}` : null;

  return <>
    <aside className="adventure-dock" aria-label="Campus adventure progress">
      <button className="adventure-mobile-open" onClick={openJournal} aria-label={`Open adventure journal. Level ${summary.level}, ${summary.completedCount} of 6 badges.`}>
        <BadgeIcon kind={allDone ? "faculty" : active.icon}/><span>Quests <b>{summary.completedCount}/6</b></span>
      </button>
      <div className="adventure-dock-body">
        <button ref={openerRef} className="adventure-dock-heading" onClick={openJournal} aria-label="Open missions and badges">
          <span className="adventure-level-chip">{summary.level}</span><span><small>YOUR CAMPUS ADVENTURE</small><strong>{summary.title}</strong></span><span className="adventure-journal-arrow" aria-hidden="true">↗</span>
        </button>
        <div className="adventure-xp-row"><span>{summary.xp} XP</span><span>{summary.completedCount} / 6 badges</span></div>
        <div className="adventure-xp-track" role="progressbar" aria-label="Experience toward next level" aria-valuemin={0} aria-valuemax={250} aria-valuenow={summary.levelXP}><i style={{ width: `${summary.levelXP / 250 * 100}%` }}/></div>
        <div className="adventure-active"><span className="adventure-overline">{allDone ? "PASSPORT COMPLETE" : "TRACKED MISSION"}</span><h2>{allDone ? "You know your way around." : active.title}</h2>
          {allDone ? <p>Six adventures. Six badges. Keep exploring.</p> : <p><ObjectiveMark done={false}/><span>{nextObjective?.label || "Mission complete"}{nextObjective && countLabel(nextObjective) && <small>{countLabel(nextObjective)}</small>}</span></p>}
        </div>
        <div className="adventure-dock-actions">
          <button onClick={openJournal}>View journal <span aria-hidden="true">→</span></button>
          {nextObjective?.placeId && <button className="adventure-next" onClick={() => navigate(nextObjective.placeId)} aria-label={`Find destination for ${nextObjective.label}`}>Find place</button>}
          {nextObjective && ["walkMode", "walkSeconds"].includes(nextObjective.kind) && <button className="adventure-next" onClick={startWalking}>Start walking</button>}
        </div>
      </div>
    </aside>

    {toast && <div className="adventure-reward" role="status" aria-live="polite"><span className="adventure-reward-medal" style={{ color: toast.color }}><BadgeIcon kind={toast.icon}/></span><span><small>{toast.count > 1 ? `${toast.count} BADGES UNLOCKED` : "BADGE UNLOCKED"}</small><strong>{toast.badge}</strong><em>+{toast.xp} XP · Added to your collection</em></span><button onClick={() => setToast(null)} aria-label="Dismiss badge notification">×</button></div>}

    {open && <div className="adventure-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); setResetConfirm(false); } }}>
      <section className="adventure-journal" role="dialog" aria-modal="true" aria-labelledby="adventure-title" ref={dialogRef}>
        <header className="adventure-journal-header"><div><span className="adventure-overline">UTHM · PARIT RAJA</span><h2 id="adventure-title">Your campus adventure.</h2><p>A little exploring. A collection of stories.</p></div><button className="adventure-close" onClick={() => { setOpen(false); setResetConfirm(false); }} aria-label="Close adventure journal">×</button></header>
        <div className="adventure-player"><span className="adventure-player-level">{summary.level}<small>LEVEL</small></span><div><strong>{summary.title}</strong><span>{summary.xp} XP earned <i>·</i> {summary.completedCount} of 6 badges collected</span><div className="adventure-xp-track"><i style={{ width: `${summary.levelXP / 250 * 100}%` }}/></div></div><BadgeIcon kind="faculty"/></div>
        <div className="adventure-tabs" role="tablist" aria-label="Adventure journal sections">
          <button id="adventure-missions-tab" role="tab" aria-selected={tab === "missions"} aria-controls="adventure-missions-panel" tabIndex={tab === "missions" ? 0 : -1} onClick={() => setTab("missions")} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { setTab("badges"); document.getElementById("adventure-badges-tab")?.focus(); } }}>Missions <span>{summary.completedCount}/6</span></button>
          <button id="adventure-badges-tab" role="tab" aria-selected={tab === "badges"} aria-controls="adventure-badges-panel" tabIndex={tab === "badges" ? 0 : -1} onClick={() => setTab("badges")} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { setTab("missions"); document.getElementById("adventure-missions-tab")?.focus(); } }}>Badge collection <span>{summary.badges.length}</span></button>
        </div>
        <div className="adventure-journal-scroll">
          {tab === "missions" ? <div id="adventure-missions-panel" role="tabpanel" aria-labelledby="adventure-missions-tab" className="adventure-mission-list">
            <p className="adventure-section-hint">Walk to entrances to check in. Your progress counts across every mission.</p>
            {summary.missions.map((mission, index) => <article key={mission.id} className={`adventure-mission${mission.complete ? " is-complete" : ""}${progress.activeMissionId === mission.id ? " is-tracked" : ""}`}>
              <div className="adventure-mission-top"><span className="adventure-mission-icon" style={{ color: mission.color }}><BadgeIcon kind={mission.icon}/></span><div><span className="adventure-overline">MISSION {String(index + 1).padStart(2, "0")} {mission.complete ? "· COMPLETE" : progress.activeMissionId === mission.id ? "· TRACKED" : ""}</span><h3>{mission.title}</h3></div><span className="adventure-xp-pill">{mission.xp} XP</span></div>
              <p className="adventure-mission-description">{mission.subtitle}</p>
              <ul>{mission.objectives.map((objective) => <li key={objective.label} className={objective.complete ? "is-done" : ""}><ObjectiveMark done={objective.complete}/><span>{objective.label}</span>{countLabel(objective) && <small>{countLabel(objective)}</small>}{!objective.complete && objective.placeId && <button onClick={() => navigate(objective.placeId)} aria-label={`Find place: ${objective.label}`}>Find <span aria-hidden="true">↗</span></button>}{!objective.complete && ["walkMode", "walkSeconds"].includes(objective.kind) && <button onClick={startWalking}>Walk <span aria-hidden="true">↗</span></button>}</li>)}</ul>
              {!mission.complete && <p className="adventure-task-help">{objectiveHelp(mission.objectives.find((objective) => !objective.complete))}</p>}
              <footer><span>{mission.complete ? `“${mission.badge}” badge earned` : `${mission.done} of ${mission.total} tasks complete`}</span>{!mission.complete && <button className={progress.activeMissionId === mission.id ? "is-tracked" : ""} onClick={() => save(trackMission(progressRef.current, mission.id))}>{progress.activeMissionId === mission.id ? "✓ Tracking" : "Track mission"}</button>}</footer>
            </article>)}
          </div> : <div id="adventure-badges-panel" role="tabpanel" aria-labelledby="adventure-badges-tab" className="adventure-badges-panel"><p className="adventure-section-hint">Each badge marks a small adventure. Finish its mission to make it yours.</p><div className="adventure-badge-grid">{summary.missions.map((mission) => <article key={mission.id} className={`adventure-collection-badge${mission.complete ? " is-earned" : ""}`}><span className="adventure-collection-medal" style={{ "--badge-color": mission.color }}><BadgeIcon kind={mission.icon} locked={!mission.complete}/>{mission.complete && <b aria-label="Earned">✓</b>}</span><h3>{mission.badge}</h3><p>{mission.complete ? "Collected" : mission.title}</p><span>{mission.complete ? `+${mission.xp} XP` : "Awaiting your adventure"}</span></article>)}</div></div>}
        </div>
        <footer className="adventure-journal-footer"><span>{!ready ? "Loading your adventure…" : storageUnavailable ? "Progress stays in this session; browser saving is unavailable." : "Progress saved on this browser."}</span>{resetConfirm ? <div className="adventure-reset-confirm"><span>Clear your missions, badges and XP?</span><button onClick={() => { save(createProgress()); setResetConfirm(false); setToast(null); }}>Yes, reset</button><button onClick={() => setResetConfirm(false)}>Keep progress</button></div> : <button onClick={() => setResetConfirm(true)}>Reset adventure</button>}</footer>
      </section>
    </div>}
  </>;
}
