"use client";

import { useEffect } from "react";
import { BUS_STOPS } from "../lib/bus-stops.js";
import CampusPlan2D from "./CampusPlan2D";
import CampusMissions from "./CampusMissions";
import CampusMinimap from "./CampusMinimap";
import CampusJoystick from "./CampusJoystick";

function CampusIcon({ name, className = "", ...props }) {
  const paths = {
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/></>,
    walk: <><circle cx="13" cy="4" r="2"/><path d="m7 12 3-4 4 1 3 4h3M10 8l-1 8-4 5M10 13l5 3 1 5"/></>,
    rotate: <><path d="M20 8a8 8 0 1 0 0 8"/><path d="M20 3v5h-5"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.7 2.7 0 0 1 5.2 1c0 2-2.7 2.1-2.7 4M12 17h.01"/></>,
  };
  return <svg className={`campus-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export default function CampusExplorer() {
  useEffect(() => {
    const app = document.getElementById("app");
    const dock = app?.querySelector(".adventure-dock");
    if (!app || !dock) return;
    const measure = () => app.style.setProperty("--adventure-dock-height", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(dock);
    return () => { observer?.disconnect(); app.style.removeProperty("--adventure-dock-height"); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let dispose;
    import("../lib/campus.js")
      .then(({ initCampus }) => {
        if (!cancelled) dispose = initCampus();
      })
      .catch((error) => {
        console.error("Campus initialization failed", error);
        const loading = document.getElementById("loading");
        if (loading && !cancelled)
          loading.innerHTML =
            '<strong>The campus could not load.</strong><a href="https://io.uthm.edu.my/more-info/uthm-virtual-tour?catid=17&id=112&view=article" target="_blank" rel="noopener noreferrer">Open UTHM’s official 360° tour ↗</a>';
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return (
    <main id="app">
      <div
        id="world"
        tabIndex="0"
        role="application"
        aria-label="Interactive 3D campus. Drag to rotate. Use W A S D in walk mode."
      ></div>
      <div id="world-labels" aria-label="Campus landmarks"></div>
      <div id="loading">
        <span className="loader"></span>
        <strong>A little closer to campus.</strong>
        <span>Preparing Parit Raja…</span>
      </div>
      <header className="topbar">
        <button
          className="brand"
          id="home"
          aria-label="Return to campus overview"
        >
          <span className="brand-symbol">
            u<span>°</span>
          </span>
          <span className="brand-type">
            <b>husseinverse</b>
            <small>UTHM · PARIT RAJA, JOHOR</small>
          </span>
        </button>
        <div className="top-actions">
          <span className="project-tag"><i /> A LITTLE ADVENTURE, EVERY DAY</span>
          <button
            className="icon-button"
            id="light-toggle"
            aria-label="Switch to evening light"
            title="Change lighting"
          >
            ☀
          </button>
          <button
            className="icon-button"
            id="help"
            aria-label="About this tour"
          >
            <CampusIcon name="help" />
          </button>
        </div>
      </header>
      <aside className="places-panel" id="places-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">YOUR CAMPUS ADVENTURE</span>
            <h1>Explore Parit Raja<span className="heading-dot">.</span></h1>
          </div>
          <button
            id="collapse-places"
            className="icon-button"
            aria-label="Collapse places"
          >
            −
          </button>
        </div>
        <p className="panel-intro">
          A new place. A familiar face.
          <br /> Find your own way around UTHM.
        </p>
        <div className="places-heading">
          <h2>Places to discover</h2>
          <span id="visit-count">{`0 / ${12 + BUS_STOPS.length}`}</span>
        </div>
        <div className="place-filters" role="group" aria-label="Filter campus places">
          <button data-place-filter="all" aria-pressed="true">All</button>
          <button data-place-filter="faculties" aria-pressed="false">Faculties</button>
          <button data-place-filter="landmarks" aria-pressed="false">Landmarks</button>
          <button data-place-filter="bus-stops" aria-pressed="false">Bus stops</button>
        </div>
        <label className="search-field" htmlFor="place-search">
          <CampusIcon name="search" />
          <input id="place-search" className="place-search" type="search" placeholder="Find your next stop…" aria-label="Find a faculty or place" />
        </label>
        <nav id="places" aria-label="Choose a campus landmark"></nav>
        <p id="places-empty" hidden>No matching places. Try another name.</p>
        <button className="tour-start" id="tour-start">
          <span>Take the campus tour <small>Real places, in 360°</small></span>
          <CampusIcon name="arrow" />
        </button>
        <div className="panel-foot">
          <span className="status-dot"></span>
          <span id="place-total">6 faculties · {BUS_STOPS.length} shuttle stops</span>
        </div>
      </aside>
      <div id="place-toast" role="status" aria-live="polite"></div>
      <section
        className="place-card"
        id="place-card"
        aria-label="Selected landmark"
        hidden
      >
        <div className="card-top">
          <span className="eyebrow" id="place-category"></span>
          <button
            id="close-card"
            className="icon-button"
            aria-label="Close landmark details"
          >
            <CampusIcon name="close" />
          </button>
        </div>
        <h2 id="place-name"></h2>
        <p id="place-description"></p>
        <div className="card-actions">
          <button id="view-360" className="primary-button">
            Step inside · 360° <span>↗</span>
          </button>
          <button id="walk-here" className="text-button">
            Walk here
          </button>
        </div>
        <a
          id="place-source"
          className="source-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          About this place ↗
        </a>
      </section>
      <div className="view-tools" aria-label="Camera controls">
        <button id="zoom-in" className="icon-button" aria-label="Zoom in">
          <CampusIcon name="plus" />
        </button>
        <button id="zoom-out" className="icon-button" aria-label="Zoom out">
          <CampusIcon name="minus" />
        </button>
        <span></span>
        <button
          id="rotate-view"
          className="icon-button"
          aria-label="Rotate camera"
        >
          <CampusIcon name="rotate" />
        </button>
        <button
          id="plan-view"
          className="icon-button"
          aria-label="View building footprints from above"
          title="View from above"
        >
          <CampusIcon name="layers" />
        </button>
        <button
          id="reset-view"
          className="icon-button"
          aria-label="Campus overview"
        >
          <CampusIcon name="home" />
        </button>
      </div>
      <div className="compass" aria-hidden="true">
        <span>VIEW</span>
        <i id="compass-needle"></i>
      </div>
      <div className="bottom-bar">
        <div className="mode-switch" role="group" aria-label="Exploration mode">
          <button id="overview-mode" className="active" aria-pressed="true">
            <CampusIcon name="map" /> <span>Campus view</span>
          </button>
          <button id="walk-mode" aria-pressed="false">
            <CampusIcon name="walk" /> <span>Go for a walk</span>
          </button>
        </div>
        <span className="controls-hint" id="controls-hint">
          Drag to look around <span>·</span> Scroll to zoom <span>·</span>{" "}
          Select a place
        </span>
      </div>
      <div className="world-caption">
        <span>PARIT RAJA</span>
        <span>A little closer to campus.</span>
      </div>
      <div id="walk-controls" hidden aria-label="Walking controls">
        <button data-dir="w" aria-label="Walk forward">
          ↑
        </button>
        <div>
          <button data-dir="a" aria-label="Walk left">
            ←
          </button>
          <button data-dir="s" aria-label="Walk backward">
            ↓
          </button>
          <button data-dir="d" aria-label="Walk right">
            →
          </button>
        </div>
      </div>
      <section id="panorama" hidden aria-label="Real campus panorama">
        <iframe
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          id="pano-frame"
          title="Official UTHM 360-degree panorama"
          allow="fullscreen; gyroscope; accelerometer"
          allowFullScreen
        ></iframe>
        <div className="pano-top">
          <button id="back-3d" className="pano-button">
            ← Back to campus
          </button>
          <span>REAL CAMPUS · 360°</span>
          <a
            id="open-pano"
            className="pano-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full view ↗
          </a>
        </div>
        <div className="pano-card">
          <div>
            <span className="eyebrow" id="tour-progress">
              YOUR CAMPUS TOUR
            </span>
            <h2 id="pano-title"></h2>
            <p id="pano-description"></p>
            <a
              className="source-link"
              href="https://io.uthm.edu.my/more-info/uthm-virtual-tour?catid=17&amp;id=112&amp;view=article"
              target="_blank"
              rel="noopener noreferrer"
            >
              360° imagery via UTHM International Office · Momento360 ↗
            </a>
          </div>
          <div className="tour-navigation">
            <button
              id="prev-stop"
              className="icon-button"
              aria-label="Previous tour stop"
            >
              ←
            </button>
            <button id="next-stop" className="primary-button">
              Next place →
            </button>
          </div>
        </div>
        <div className="pano-loading" id="pano-loading">
          Opening the real campus view…
          <br />
          <small>If the view doesn’t appear, choose “Open full view”.</small>
        </div>
      </section>
      <CampusJoystick />
      <CampusMissions />
      <CampusMinimap />
      <CampusPlan2D busStops={BUS_STOPS} />
      <dialog id="about-dialog">
        <button
          id="close-about"
          className="icon-button"
          aria-label="Close about"
        >
          <CampusIcon name="close" />
        </button>
        <span className="eyebrow">SELAMAT DATANG</span>
        <h2>
          Make yourself
          <br />
          at home.
        </h2>
        <p>
          Explore the Parit Raja main campus of Universiti Tun Hussein Onn
          Malaysia.
        </p>
        <div className="help-grid">
          <b>Look around</b>
          <span>Drag the campus. Scroll or use + / − to zoom.</span>
          <b>Take a walk</b>
          <span>
            Choose Go for a walk. Use the thumbstick on mobile or iPad, or
            WASD / arrow keys on a keyboard. Hold Shift to move faster.
          </span>
          <b>See the real place</b>
          <span>
            Select a landmark and open its 360° view. Drag inside the photo to
            look around.
          </span>
          <b>Find your way back</b>
          <span>
            Press V to switch view. Press Esc to close a place or return from
            360°.
          </span>
          <b>Missions & badges</b>
          <span>Open Quests or your adventure journal. Track a mission, find its destinations and collect badges as you explore.</span>
        </div>
        <div className="about-note">
          <b>A campus, still growing.</b>
          <p>
            The 3D buildings and distances are simplified interpretations, not a
            surveyed digital twin. The 360° scenes are real campus photography
            embedded from UTHM’s published tour. This is an independent project,
            not an official UTHM service.
          </p>
        </div>
        <a
          className="source-link"
          href="https://io.uthm.edu.my/images/Guideline%20Book/091122-a-guide-book-for-international-student-io.pdf#page=4"
          target="_blank"
          rel="noopener noreferrer"
        >
          Official campus map · 2023 guide ↗
        </a>
      </dialog>
    </main>
  );
}
