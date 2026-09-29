"use client";

import { useEffect } from "react";

export default function CampusExplorer() {
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
          <span className="project-tag">CAMPUS EXPLORER</span>
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
            ?
          </button>
        </div>
      </header>
      <aside className="places-panel" id="places-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">UNIVERSITI TUN HUSSEIN ONN MALAYSIA</span>
            <h1>Explore Parit Raja.</h1>
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
          Wander around Parit Raja, or step into a real 360° view.
        </p>
        <div className="places-heading">
          <h2>Explore the campus</h2>
          <span id="visit-count">0 / 7</span>
        </div>
        <nav id="places" aria-label="Choose a campus landmark"></nav>
        <button className="tour-start" id="tour-start">
          <span>Take the campus tour</span>
          <span aria-hidden="true">↗</span>
        </button>
        <div className="panel-foot">
          <span className="status-dot"></span>
          <span id="place-total">7 places. At your own pace.</span>
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
            ×
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
          +
        </button>
        <button id="zoom-out" className="icon-button" aria-label="Zoom out">
          −
        </button>
        <span></span>
        <button
          id="rotate-view"
          className="icon-button"
          aria-label="Rotate camera"
        >
          ⟳
        </button>
        <button
          id="plan-view"
          className="icon-button"
          aria-label="View building footprints from above"
          title="View from above"
        >
          ▱
        </button>
        <button
          id="reset-view"
          className="icon-button"
          aria-label="Campus overview"
        >
          ⌂
        </button>
      </div>
      <div className="compass" aria-hidden="true">
        <span>VIEW</span>
        <i id="compass-needle"></i>
      </div>
      <div className="bottom-bar">
        <div className="mode-switch" role="group" aria-label="Exploration mode">
          <button id="overview-mode" className="active" aria-pressed="true">
            ◈ <span>Campus view</span>
          </button>
          <button id="walk-mode" aria-pressed="false">
            ♙ <span>Go for a walk</span>
          </button>
        </div>
        <span className="controls-hint" id="controls-hint">
          Drag to look around <span>·</span> Scroll to zoom <span>·</span>{" "}
          Select a place
        </span>
      </div>
      <div className="world-caption">
        <span>PARIT RAJA</span>
        <span>Concept 3D · real 360° views</span>
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
      <dialog id="about-dialog">
        <button
          id="close-about"
          className="icon-button"
          aria-label="Close about"
        >
          ×
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
            Choose Go for a walk. Use WASD / arrow keys, or the on-screen
            arrows. Hold Shift to move faster.
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
        </div>
        <div className="about-note">
          <b>A first campus prototype</b>
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
