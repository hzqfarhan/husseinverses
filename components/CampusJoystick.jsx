"use client";

import { useCallback, useEffect, useRef } from "react";

function normalizeJoystick(dx, dy, radius, deadzone = .1) {
  if (![dx, dy, radius].every(Number.isFinite) || radius <= 0) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy) / radius;
  if (distance <= deadzone) return { x: 0, y: 0 };
  const magnitude = (Math.min(1, distance) - deadzone) / (1 - deadzone);
  return { x: dx === 0 ? 0 : dx / (distance * radius) * magnitude, y: dy === 0 ? 0 : -dy / (distance * radius) * magnitude };
}

export default function CampusJoystick() {
  const controlRef = useRef(null);
  const pointerRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0, radius: 1 });
  const outputRef = useRef({ x: 0, y: 0, active: false });
  const emit = useCallback((vector) => {
    outputRef.current = vector;
    window.dispatchEvent(new CustomEvent("husseinverse:joystick", { detail: vector }));
  }, []);
  const reset = useCallback((force = false) => {
    const control = controlRef.current, pointer = pointerRef.current;
    const wasActive = pointer !== null || outputRef.current.active;
    pointerRef.current = null;
    if (control) {
      control.style.setProperty("--stick-x", "0px");
      control.style.setProperty("--stick-y", "0px");
      control.dataset.active = "false";
      control.setAttribute("aria-pressed", "false");
      if (pointer !== null && control.hasPointerCapture(pointer)) control.releasePointerCapture(pointer);
    }
    if (wasActive || force) emit({ x: 0, y: 0, active: false });
  }, [emit]);
  const available = useCallback(() => {
    return document.body.classList.contains("walking") && !document.hidden &&
      !document.querySelector("#panorama:not([hidden]), #campus-plan-overlay, .adventure-overlay, #about-dialog[open]") &&
      !controlRef.current?.closest("[inert]");
  }, []);

  useEffect(() => {
    const abort = new AbortController(), options = { signal: abort.signal };
    const clear = () => reset();
    const modal = (event) => { if (event.detail === true) reset(); };
    window.addEventListener("blur", clear, options);
    window.addEventListener("resize", clear, options);
    document.addEventListener("visibilitychange", clear, options);
    window.addEventListener("husseinverse:missions-visibility", modal, options);
    window.addEventListener("husseinverse:plan-visibility", modal, options);
    window.addEventListener("husseinverse:mode-change", (event) => { if (event.detail !== "walk") reset(); }, options);
    // Panorama, native dialogs and exploration mode also change outside React.
    const observer = new MutationObserver(() => { if (!available()) reset(); });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "open", "inert"] });
    const touchLayout = window.matchMedia("(any-pointer: coarse), (max-width: 1100px)");
    const layoutChange = () => { if (!touchLayout.matches) reset(); };
    touchLayout.addEventListener("change", layoutChange, options);
    return () => { abort.abort(); observer.disconnect(); reset(true); };
  }, [available, reset]);

  function move(event) {
    if (event.pointerId !== pointerRef.current) return;
    event.preventDefault(); event.stopPropagation();
    if (!available()) { reset(); return; }
    const { x, y, radius } = originRef.current;
    const vector = normalizeJoystick(event.clientX - x, event.clientY - y, radius);
    const control = controlRef.current;
    control.style.setProperty("--stick-x", `${vector.x * radius}px`);
    control.style.setProperty("--stick-y", `${-vector.y * radius}px`);
    emit({ ...vector, active: true });
  }
  function start(event) {
    if (pointerRef.current !== null || (event.pointerType === "mouse" && event.button !== 0) || !available()) return;
    event.preventDefault(); event.stopPropagation();
    const control = event.currentTarget, rect = control.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: Math.max(1, Math.min(rect.width, rect.height) / 2 - 25) };
    pointerRef.current = event.pointerId;
    control.setPointerCapture(event.pointerId);
    control.dataset.active = "true"; control.setAttribute("aria-pressed", "true");
    move(event);
  }
  function finish(event) {
    if (event.pointerId !== pointerRef.current) return;
    event.preventDefault(); event.stopPropagation(); reset();
  }

  return <div className="campus-joystick" role="group" aria-label="Walking controls">
    <button ref={controlRef} id="campus-joystick" type="button" className="campus-joystick-pad"
      aria-label="Movement joystick. Drag to walk in any direction. You can also use the arrow keys."
      aria-roledescription="movement joystick" aria-pressed="false" data-active="false"
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={finish} onLostPointerCapture={finish}
      onContextMenu={(event) => event.preventDefault()}>
      <span className="joystick-cross joystick-cross-horizontal" aria-hidden="true" />
      <span className="joystick-cross joystick-cross-vertical" aria-hidden="true" />
      <span className="joystick-tick joystick-tick-north" aria-hidden="true" />
      <span className="joystick-tick joystick-tick-east" aria-hidden="true" />
      <span className="joystick-tick joystick-tick-south" aria-hidden="true" />
      <span className="joystick-tick joystick-tick-west" aria-hidden="true" />
      <span className="campus-joystick-thumb" aria-hidden="true"><i /><i /><i /></span>
    </button>
    <span className="campus-joystick-caption" aria-hidden="true">MOVE</span>
  </div>;
}
