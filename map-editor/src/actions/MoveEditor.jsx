import NodePicker from '../shared/NodePicker';

export default function MoveEditor({ action, onChange }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Target Node</label>
            <NodePicker
                value={action.to || ''}
                onChange={(to) => onChange({ ...action, to })}
            />
        </div>
    );
}
