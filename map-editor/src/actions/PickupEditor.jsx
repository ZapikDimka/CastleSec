import ItemPicker from '../shared/ItemPicker';

export default function PickupEditor({ action, onChange }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Item</label>
            <ItemPicker
                value={action.item || ''}
                onChange={(item) => onChange({ ...action, item })}
            />
        </div>
    );
}
