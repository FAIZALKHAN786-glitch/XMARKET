/* Inline empty states — centered icon, title, sub, single ghost action. */
export default function EmptyState({ icon: Icon, title, sub, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} strokeWidth={1.5} />}
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-sub">{sub}</div>
      {actionLabel && (
        <button type="button" className="btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
