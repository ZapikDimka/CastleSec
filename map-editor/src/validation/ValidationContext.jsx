import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useMapState } from '../state/MapContext';
import { validate } from './validate';

export const ValidationContext = createContext(new Map());

export function ValidationProvider({ children }) {
    const state = useMapState();
    const [validationResults, setValidationResults] = useState(() => validate(state));
    const timerRef = useRef(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const results = validate(state);
            setValidationResults(results);
        }, 300);

        return () => clearTimeout(timerRef.current);
    }, [state]);

    return (
        <ValidationContext.Provider value={validationResults}>
            {children}
        </ValidationContext.Provider>
    );
}

export function useValidation() {
    return useContext(ValidationContext);
}
