import { useMapState, useMapDispatch } from '../state/MapContext';
import { useValidation } from '../validation/ValidationContext';
import { getAssetUrl } from '../shared/assetHelper';
import { useOptimizedImage } from '../shared/useOptimizedImage';
import ItemEditor from './ItemEditor';

export default function ItemPanel() {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const validation = useValidation();
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
                    {itemIds.map(id => (
                        <ItemRow
                            key={id}
                            id={id}
                            item={items[id]}
                            isSelected={id === selectedItemId}
                            refCount={refCounts[id]}
                            hasMissingImage={Boolean((validation.get(id) || []).find(i => i.id === 'V-26'))}
                            onSelect={() => handleSelectItem(id)}
                        />
                    ))}
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
    for (const action of actions || []) {
        if (Array.isArray(action?.functions)) {
            for (const condition of action.conditions || []) {
                countItemRefsInCondition(condition, counts);
            }
            countItemRefsInFunctions(action.functions, counts);
            continue;
        }
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

function countItemRefsInFunctions(functions, counts) {
    for (const fn of functions || []) {
        if (!fn) continue;
        if ((fn.type === 'PickUpItemFunction' || fn.type === 'RemoveItemFunction') && fn.item && counts[fn.item] !== undefined) {
            counts[fn.item]++;
        }
        if (fn.type === 'ConditionalFunction') {
            countItemRefsInCondition(fn.condition, counts);
            countItemRefsInFunctions(fn.on_success || [], counts);
            countItemRefsInFunctions(fn.on_failure || [], counts);
        }
        if (fn.type === 'SolveTaskFunction') {
            countItemRefsInFunctions(fn.on_success || [], counts);
            countItemRefsInFunctions(fn.on_failure || [], counts);
        }
        if (fn.type === 'RandomFunction') {
            for (const branch of fn.branches || []) {
                countItemRefsInFunctions(branch.functions || [], counts);
            }
        }
    }
}

function countItemRefsInCondition(condition, counts) {
    if (!condition || typeof condition !== 'object') return;
    if (condition.type === 'HasItemCondition' && condition.item && counts[condition.item] !== undefined) {
        counts[condition.item]++;
    }
    if (Array.isArray(condition.conditions)) {
        for (const nested of condition.conditions) {
            countItemRefsInCondition(nested, counts);
        }
    }
}

function ItemRow({ id, item, isSelected, refCount, hasMissingImage, onSelect }) {
    const absoluteImagePath = getAssetUrl(item?.image);
    const optimizedImageSrc = useOptimizedImage(absoluteImagePath, 256, 256);

    const handleImageClick = (e) => {
        if (!absoluteImagePath) return;
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('openFullscreenImage', { detail: absoluteImagePath }));
    };

    return (
        <div
            className={`item-row ${isSelected ? 'item-row--selected' : ''} ${hasMissingImage ? 'item-row--error' : ''}`}
            onClick={onSelect}
        >
            {optimizedImageSrc && (
                <div className="item-row__thumb" onClick={handleImageClick}>
                    <img src={optimizedImageSrc} alt="" />
                </div>
            )}
            <div className="item-row__info">
                <span className="item-row__name">{item.name}</span>
                <span className="item-row__id">{id}</span>
            </div>
            {refCount > 0 && (
                <span className="item-row__refs" title={`Referenced by ${refCount} action(s)`}>
                    {refCount}
                </span>
            )}
        </div>
    );
}
