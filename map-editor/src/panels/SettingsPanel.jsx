import FolderPicker from '../shared/FolderPicker';

export default function SettingsPanel({
    filePath,
    assetFolderSummary,
    isApplyingAssetFolder,
    onPickAssetFolderHandle,
    onPickAssetFolderPath,
    onClearAssetFolder,
}) {
    return (
        <div className="panel">
            <div className="panel__header">
                <div className="panel__header-row">
                    <span className="panel__header-title">Settings</span>
                </div>
                <div className="panel__id-row">
                    <span className="panel__id-label">Map File: {filePath || '(unsaved map)'}</span>
                </div>
            </div>

            <div className="panel__body">
                <div className="panel__section">
                    <label className="panel__label">Asset Folder</label>
                    <FolderPicker
                        disabled={!filePath || isApplyingAssetFolder}
                        onPickHandle={onPickAssetFolderHandle}
                        onPickPath={onPickAssetFolderPath}
                    />
                    {!filePath && (
                        <div className="panel__hint" style={{ marginTop: '8px' }}>
                            Save or open a map file first to persist map-specific asset-folder settings.
                        </div>
                    )}
                    {assetFolderSummary && (
                        <div className="panel__hint" style={{ marginTop: '8px' }}>
                            {assetFolderSummary}
                        </div>
                    )}
                </div>

                <div className="panel__actions-row">
                    <button
                        className="panel__btn"
                        onClick={onClearAssetFolder}
                        disabled={!filePath || isApplyingAssetFolder}
                    >
                        Reset To Default Assets Folder
                    </button>
                </div>
            </div>
        </div>
    );
}
