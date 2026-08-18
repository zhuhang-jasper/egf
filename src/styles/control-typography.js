/**
 * Shared text ramp for the interactive chrome — buttons, inputs, dropdown rows. The same three-tier
 * 12/13/14 ramp the docs tab and the pillar clusters use (see DOC_TEXT, PillarCluster), so a control
 * sitting next to a pillar row reads at the same size at every width rather than staying flat.
 *
 * SIZE ONLY. Weight, colour and layout stay with the component, because these tokens land on surfaces
 * that disagree about all three (a menu row is muted and left-aligned, a primary button is neither).
 *
 * `CONTROL_TEXT` is the default for anything carrying a real label. `CONTROL_TEXT_SM` is one rung down,
 * for text that is deliberately secondary WITHIN a control — a dropdown's own search box against the
 * field that opened it. Two rungs, no more: a third would put two adjacent controls a single px apart.
 */
export const CONTROL_TEXT = "text-[12px] sm:text-[13px] md:text-[14px]";

export const CONTROL_TEXT_SM = "text-[11px] sm:text-[12px] md:text-[13px]";
