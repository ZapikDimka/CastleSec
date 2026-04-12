import { useMapState } from '../state/MapContext';

export default function ItemPicker({ value, onChange }) {
    const { items } = useMapState();

    const itemIds = Object.keys(items);

    if (itemIds.length === 0) {
        return <span className="panel__hint">(no items defined)</span>;
    }

    return (
        <select
            className="panel__select"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">— select item —</option>
            {itemIds.map(id => (
                <option key={id} value={id}>
                    {id} — {items[id].name}
                </option>
            ))}
        </select>
    );
}
