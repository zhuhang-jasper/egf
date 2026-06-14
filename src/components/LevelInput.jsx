import { useState } from "react";

import { LEVEL_STEP } from "@/lib/constants";
import { useTouchPrimary } from "@/hooks/useTouchPrimary";
import { clampLevel, formatLevelForInput } from "@/lib/levels";

import { useAppStore } from "@/store/useAppStore";

function normalizeTypingValue(raw) {
  let s = String(raw).replace(",", ".").trim();
  if (s.startsWith(".")) {
    s = `0${s}`;
  }
  return s;
}

function isPartialLevelInput(s) {
  return s === "" || /^\d*\.?\d*$/.test(s);
}

function shouldCommitWhileTyping(s) {
  return s !== "" && !s.endsWith(".");
}

export function LevelInput({ value, onChange, ariaLabel, ariaLabelUp, ariaLabelDown }) {
  const touchPrimary = useTouchPrimary();
  const keyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const keyboardLocked = touchPrimary && !keyboardInputEnabled;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const bump = (dir) => {
    setEditing(false);
    const next = clampLevel(clampLevel(value) + dir * LEVEL_STEP);
    onChange(next);
  };

  const commit = (raw) => {
    onChange(clampLevel(raw === "" ? value : raw));
  };

  return (
    <span className="level-value-stepper group/level">
      <input
        type="text"
        inputMode={keyboardInputEnabled ? "decimal" : "none"}
        readOnly={keyboardLocked}
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        value={editing ? draft : formatLevelForInput(value)}
        onFocus={() => {
          if (keyboardLocked) {
            return;
          }
          setEditing(true);
          setDraft(formatLevelForInput(value));
        }}
        onChange={(e) => {
          const s = normalizeTypingValue(e.target.value);
          if (!isPartialLevelInput(s)) {
            return;
          }
          setDraft(s);
          if (shouldCommitWhileTyping(s)) {
            const n = parseFloat(s);
            if (Number.isFinite(n)) {
              onChange(clampLevel(n));
            }
          }
        }}
        onBlur={() => {
          setEditing(false);
          commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="level-value"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={ariaLabelDown}
        onClick={() => bump(-1)}
        className="level-value-step__btn level-value-step__btn--dec"
      >
        −
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={ariaLabelUp}
        onClick={() => bump(1)}
        className="level-value-step__btn level-value-step__btn--inc"
      >
        +
      </button>
    </span>
  );
}
