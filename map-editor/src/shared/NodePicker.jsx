import { useMapState } from '../state/MapContext';

export default function NodePicker({ value, onChange, excludeId }) {
    const { nodes } = useMapState();

    const nodeIds = Object.keys(nodes).filter(id => id !== excludeId);

    return (
        <select
            className="panel__select"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">— select node —</option>
            {nodeIds.map(id => (
                <option key={id} value={id}>
                    {id} — {nodes[id].name}
                </option>
            ))}
        </select>
    );
}
