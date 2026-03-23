export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
    return (
        <div className="dialog-overlay" onClick={onCancel}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
                <div className="dialog__header">
                    <h3 className="dialog__title">{title}</h3>
                </div>
                <div className="dialog__body">
                    <p className="dialog__message">{message}</p>
                </div>
                <div className="dialog__footer">
                    <button className="dialog__btn dialog__btn--secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className={`dialog__btn ${danger ? 'dialog__btn--danger' : 'dialog__btn--primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
