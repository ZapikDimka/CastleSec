import { createContext, useContext, useReducer, useCallback } from 'react';
import { mapReducer, createInitialState } from './mapReducer';

const MapContext = createContext(null);
const MapDispatchContext = createContext(null);

export function MapProvider({ children }) {
    const [state, dispatch] = useReducer(mapReducer, null, createInitialState);

    return (
        <MapContext.Provider value={state}>
            <MapDispatchContext.Provider value={dispatch}>
                {children}
            </MapDispatchContext.Provider>
        </MapContext.Provider>
    );
}

export function useMapState() {
    const ctx = useContext(MapContext);
    if (ctx === null) throw new Error('useMapState must be used within MapProvider');
    return ctx;
}

export function useMapDispatch() {
    const ctx = useContext(MapDispatchContext);
    if (ctx === null) throw new Error('useMapDispatch must be used within MapProvider');
    return ctx;
}

// Convenience hook that returns both state and dispatch
export function useMap() {
    return [useMapState(), useMapDispatch()];
}
