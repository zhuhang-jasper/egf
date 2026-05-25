import { LEVEL_STEP } from "@/lib/constants";
import { clampLevel, formatLevelForInput } from "@/lib/levels";

export function LevelInput({ value, onChange, isAi = false, ariaLabel, ariaLabelUp, ariaLabelDown }) {
  const bump = (dir) => {
    const next = clampLevel(clampLevel(value) + dir * LEVEL_STEP);
    onChange(next);
  };

  return (
    <span className="level-value-with-spin group/level">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        data-ai={isAi ? "true" : undefined}
        value={formatLevelForInput(value)}
        onChange={(e) => onChange(clampLevel(e.target.value))}
        onBlur={(e) => onChange(clampLevel(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          }
        }}
        className="level-value"
      />
      <span className="level-value-spin__col">
        <button type="button" tabIndex={-1} aria-label={ariaLabelUp} onClick={() => bump(1)} className="level-value-spin__btn">
          ▲
        </button>
        <button type="button" tabIndex={-1} aria-label={ariaLabelDown} onClick={() => bump(-1)} className="level-value-spin__btn">
          ▼
        </button>
      </span>
    </span>
  );
}
