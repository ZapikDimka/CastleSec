import { useMapState, useMapDispatch } from '../state/MapContext';
import ItemEditor from './ItemEditor';

export default function ItemPanel() {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const { items, selectedItemId, nodes } = state;

    const itemIds = Object.keys(items);

    // Count references per item across all node actions
    const refCounts = {};
    for (const id of itemIds) refCounts[id] = 0;

    for (const node of Object.values(nodes)) {
        countItemRefs(node.actions, refCounts);
    }

    const handleAddItem = () => {
        dispatch({ type: 'ADD_ITEM', payload: { name: 'New Item' } });
    };

    const handleSelectItem = (id) => {
        dispatch({ type: 'SELECT_ITEM', payload: { id } });
    };

    return (
        <div className="panel">
            <div className="panel__body">
                {/* Item List */}
                <div className="item-list">
                    {itemIds.length === 0 && (
                        <div className="item-list__empty">No items yet. Add one to get started.</div>
                    )}
                    {itemIds.map(id => {
                        const item = items[id];
                        const isSelected = id === selectedItemId;
                        return (
                            <div
                                key={id}
                                className={`item-row ${isSelected ? 'item-row--selected' : ''}`}
                                onClick={() => handleSelectItem(id)}
                            >
                                {item.image && (
                                    <div className="item-row__thumb">
                                        <img src={item.image} alt="" />
                                    </div>
                                )}
                                <div className="item-row__info">
                                    <span className="item-row__name">{item.name}</span>
                                    <span className="item-row__id">{id}</span>
                                </div>
                                {refCounts[id] > 0 && (
                                    <span className="item-row__refs" title={`Referenced by ${refCounts[id]} action(s)`}>
                                        {refCounts[id]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add Item */}
                <button className="action-list__add-btn" onClick={handleAddItem}>
                    ＋ Add Item
                </button>

                {/* Inline Item Editor */}
                {selectedItemId && items[selectedItemId] && (
                    <ItemEditor itemId={selectedItemId} />
                )}
            </div>
        </div>
    );
}

// Recursively count pickup/has_item references
function countItemRefs(actions, counts) {
    for (const action of actions) {
        if (action.type === 'pickup' && action.item && counts[action.item] !== undefined) {
            counts[action.item]++;
        }
        if (action.type === 'if') {
            if (action.condition?.type === 'has_item' && action.condition.item && counts[action.condition.item] !== undefined) {
                counts[action.condition.item]++;
            }
            if (action.action) {
                countItemRefs([action.action], counts);
            }
        }
    }
}
