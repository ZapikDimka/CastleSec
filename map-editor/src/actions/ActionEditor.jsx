import ReturnEditor from './ReturnEditor';
import MoveEditor from './MoveEditor';
import PickupEditor from './PickupEditor';
import SolveTaskEditor from './SolveTaskEditor';
import IfEditor from './IfEditor';
import UnknownEditor from './UnknownEditor';

export default function ActionEditor({ action, nodeId, index, onChange }) {
    switch (action.type) {
        case 'return':
            return <ReturnEditor />;
        case 'move':
            return <MoveEditor action={action} onChange={onChange} />;
        case 'pickup':
            return <PickupEditor action={action} onChange={onChange} />;
        case 'solve_task':
            return <SolveTaskEditor action={action} onChange={onChange} />;
        case 'if':
            return (
                <IfEditor
                    action={action}
                    nodeId={nodeId}
                    index={index}
                    onChange={onChange}
                />
            );
        default:
            return <UnknownEditor action={action} onChange={onChange} />;
    }
}
