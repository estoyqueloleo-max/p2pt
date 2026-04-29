/**
 * Pingo - Global State Manager
 */

export const state = {
    myPeerId: null,
    peer: null,
    map: null,
    myMarker: null,
    otherMarkers: {}, // peerId -> Leaflet marker
    connections: {}, // peerId -> DataConnection
    myCoords: { lat: 0, lng: 0, accuracy: 0 },
    manualLocationMode: false,
    firstFix: true,
    autoFollow: true,
    autoCenterGeofence: false,
    isAppInBackground: false,
    lastBroadcastTime: 0,
    appStartTime: Date.now(),
    lastBroadcastCoords: { lat: 0, lng: 0 },

    // Trail states
    locationHistory: {}, // peerId -> array of {lat, lng}
    trailLayers: {}, // peerId -> L.layerGroup

    // Geofencing state
    geofenceEnabled: false,
    geofenceCenter: null,
    geofenceRadius: 100, // meters
    geofenceCircle: null,
    lastGeofenceStatus: 'inside', // 'inside' or 'outside'

    // Identity & Agenda state
    myIdentity: { phrase: '', salt: '', alias: '' },
    agenda: [], // Array of { alias, phrase, salt, derivedId }
    activeChatPeerId: null,
    seenMessages: new Set(), // Set of msgId strings

    // Route & Cartography state
    uiMode: 'standard', // 'standard' | 'cartography'
    routes: [], // Array of { id, name, creator, points, timestamp, version }
    isRecording: false,
    recordingPoints: [],
    workingFile: null, // { id, name, type, ... }
    activeRouteId: null,
    routeLayers: {}, // routeId -> L.layerGroup

    // Cloud/Relay state
    useCloudServices: localStorage.getItem('pingo_use_cloud') === 'true',

    // Runtime
    isPrimaryTab: true, // Default to true until checked
    persistenceMode: localStorage.getItem('pingo_persistence') === 'true',
    audioElement: null,
    deferredPrompt: null,
    wakeLock: null,
    lastGeoError: null,
    lastGeoErrorTime: 0,
    lastGeoPos: null
};

export const getEl = (id) => document.getElementById(id);

// DOM Elements cache
export const elements = {
    get myPeerId() { return getEl('my-peer-id'); },
    get appVersionHeader() { return getEl('app-version-header'); },
    get statusIndicator() { return getEl('status-indicator'); },
    get locationStatus() { return getEl('location-status'); },
    get shareBtn() { return getEl('share-btn'); },
    get copyIdBtn() { return getEl('copy-id-btn'); },
    get geofenceToggle() { return getEl('geofence-toggle'); },
    get geofenceRadius() { return getEl('geofence-radius'); },
    get geofenceRadiusVal() { return getEl('geofence-radius-val'); },
    get setGeofenceCenter() { return getEl('set-geofence-center'); },
    get forceResetBtn() { return getEl('force-reset-btn'); },
    get remoteBadge() { return getEl('remote-geofence-badge'); },
    get toggleIdentityBtn() { return getEl('toggle-identity-btn'); },
    get identityForm() { return getEl('identity-form'); },
    get cancelIdentityBtn() { return getEl('cancel-identity-btn'); },
    get identityAlias() { return getEl('identity-alias'); },
    get identityPhrase() { return getEl('identity-phrase'); },
    get identitySalt() { return getEl('identity-salt'); },
    get saveIdentityBtn() { return getEl('save-identity-btn'); },
    get agendaContainer() { return getEl('agenda-container'); },
    get addContactBtn() { return getEl('add-contact-btn'); },
    get emptyAgendaHint() { return getEl('empty-agenda-hint'); },
    get chatBtn() { return getEl('chat-btn'); },
    get chatBadge() { return getEl('chat-badge'); },
    get chatPanel() { return getEl('chat-panel'); },
    get closeChatBtn() { return getEl('close-chat-btn'); },
    get chatMessages() { return getEl('chat-messages'); },
    get chatInput() { return getEl('chat-input'); },
    get sendChatBtn() { return getEl('send-chat-btn'); },
    get exitChatBtn() { return getEl('exit-chat-btn'); },
    get footerStatusMode() { return getEl('footer-status-mode'); },
    get footerChatMode() { return getEl('footer-chat-mode'); },
    get addContactForm() { return getEl('add-contact-form'); },
    get contactName() { return getEl('contact-name'); },
    get contactPhrase() { return getEl('contact-phrase'); },
    get contactSalt() { return getEl('contact-salt'); },
    get contactId() { return getEl('contact-id'); },
    get saveContactBtn() { return getEl('save-contact-btn'); },
    get cancelContactBtn() { return getEl('cancel-contact-btn'); },
    get panelToggle() { return getEl('panel-toggle'); },
    get mainPanel() { return getEl('settings-panel'); },
    get stopSharingBtn() { return getEl('stop-sharing-btn'); },
    get manualLocationBtn() { return getEl('manual-location-btn'); },
    get installBtn() { return getEl('install-pwa-btn'); },
    get cloudServicesToggle() { return getEl('cloud-services-toggle'); },
    get persistenceToggle() { return getEl('persistence-toggle'); },
    get multiTabWarning() { return getEl('multi-tab-warning'); },
    get exportBackupBtn() { return getEl('export-backup-btn'); },
    get importBackupBtn() { return getEl('import-backup-btn'); },
    get importFileInput() { return getEl('import-file-input'); },

    // Routes UI
    get modeStandardBtn() { return getEl('mode-standard-btn'); },
    get modeCartographyBtn() { return getEl('mode-cartography-btn'); },
    get routesPanel() { return getEl('routes-panel'); },
    get connectionPanel() { return getEl('connection-panel'); },
    get agendaPanel() { return getEl('agenda-container'); }, 
    get routesContainer() { return getEl('routes-container'); },
    get startRecordingBtn() { return getEl('start-recording-btn'); },
    get stopRecordingBtn() { return getEl('stop-recording-btn'); },
    get recordingHud() { return getEl('recording-hud'); },
    get recordingTimer() { return getEl('recording-timer'); },
    get recordingPointsCount() { return getEl('recording-points-count'); },
    get saveRouteForm() { return getEl('save-route-form'); },
    get routeNameInput() { return getEl('route-name-input'); },
    get saveRouteConfirmBtn() { return getEl('save-route-confirm-btn'); },
    get cancelRouteBtn() { return getEl('cancel-route-btn'); },
    get shareActiveRouteBtn() { return getEl('share-active-route-btn'); },
    get gitRemoteUrl() { return getEl('git-remote-url'); },
    get gitUsername() { return getEl('git-username'); },
    get gitToken() { return getEl('git-token'); },
    get gitPushBtn() { return getEl('git-push-btn'); },
    get gitPullBtn() { return getEl('git-pull-btn'); },
    get gitClearBtn() { return getEl('git-clear-btn'); },

    cloudServicesToggle: getEl('cloud-services-toggle'),
    workingCopyBanner: getEl('working-copy-banner'),
    workingCopyName: getEl('working-copy-name'),
    unloadWorkingCopyBtn: getEl('unload-working-copy-btn'),
    confirmModal: getEl('confirm-modal'),
    confirmModalTitle: getEl('confirm-modal-title'),
    confirmModalMessage: getEl('confirm-modal-message'),
    confirmModalOk: getEl('confirm-modal-ok'),
    confirmModalCancel: getEl('confirm-modal-cancel'),

    get editWorkingCopyBtn() { return getEl('edit-working-copy-btn'); },
    get textEditorContainer() { return getEl('text-editor-container'); },
    get textEditorTextarea() { return getEl('text-editor-textarea'); },
    get saveEditorBtn() { return getEl('save-editor-btn'); },
    get closeEditorBtn() { return getEl('close-editor-btn'); },
    get editorTitle() { return getEl('editor-title'); },

    // Semantic / Vector UI
    get indexVectorsBtn() { return getEl('index-vectors-btn'); },
    get vectorIndexProgress() { return getEl('vector-index-progress'); },
    get vectorIndexBar() { return getEl('vector-index-bar'); },
    get vectorIndexStatus() { return getEl('vector-index-status'); },
    get semanticSearchInput() { return getEl('semantic-search-input'); },
    
    // Connection Stats
    get connStatsModal() { return getEl('conn-stats-modal'); },
    get connStatsTitle() { return getEl('conn-stats-title'); },
    get connStatsViz() { return getEl('conn-stats-viz'); },
    get connStatsDetails() { return getEl('conn-stats-details'); },
    get connStatsClose() { return getEl('conn-stats-close'); }
};
