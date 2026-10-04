/* The Xmarket mark: four squares in a 2×2 grid.
   Top-left + bottom-right filled white; the other two outlined. */
export default function LogoMark({ size = 40 }) {
  const gap = Math.max(2, Math.round(size * 0.08));
  return (
    <span
      className="logo-mark"
      aria-hidden="true"
      style={{ width: size, height: size, gap }}
    >
      <i className="lm-fill" />
      <i className="lm-line" />
      <i className="lm-line" />
      <i className="lm-fill" />
    </span>
  );
}

export function LogoLockup({ size = 40, wordSize = 22 }) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: wordSize }}>
        Xmarket
      </span>
    </span>
  );
}
