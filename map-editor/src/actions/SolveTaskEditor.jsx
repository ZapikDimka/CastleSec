export default function SolveTaskEditor({ action, onChange }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Task Name</label>
            <input
                className="panel__input"
                type="text"
                value={action.name || ''}
                onChange={(e) => onChange({ ...action, name: e.target.value })}
                placeholder="Task name"
                spellCheck={false}
            />
        </div>
    );
}
