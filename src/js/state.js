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
    mediaConnections: {}, // peerId -> MediaConnection
    localStream: null, // MediaStream for camera or screen
    relayedStreams: {}, // originId -> MediaStream (remote stream we are relaying)
    streamTypes: {}, // originId -> 'camera' | 'screen'
    activeVideoConnectionsCount: 0, // Number of peers we are streaming to
    MAX_DIRECT_VIDEO_CONNECTIONS: 2, // Limit before redirecting
    streamRegistry: {}, // originId -> { relayedBy: peerId, timestamp: number } (track who has which stream)
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
    uiMode: 'network', // 'network' | 'workspace' | 'comm' | 'location'
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
    
    // Search & Privacy
    allowExactSearchP2P: localStorage.getItem('pingo_allow_exact_search') === 'true',
    allowSemanticSearchP2P: localStorage.getItem('pingo_allow_semantic_search') === 'true',
    searchHistory: [], // Array of { queryId, query, type, origin, timestamp }
    queryRoutingTable: new Map(), // Map of queryId -> receivedFromPeerId for reverse-path routing

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
    get shareAudioBtn() { return getEl('share-audio-btn'); },
    get shareCameraBtn() { return getEl('share-camera-btn'); },
    get shareScreenBtn() { return getEl('share-screen-btn'); },
    get videoContainer() { return getEl('video-container'); },
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
    get chatTitle() { return getEl('chat-title'); },
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
    get navNetworkBtn() { return getEl('nav-network-btn'); },
    get navWorkspaceBtn() { return getEl('nav-workspace-btn'); },
    get navCommBtn() { return getEl('nav-comm-btn'); },
    get navLocationBtn() { return getEl('nav-location-btn'); },
    get workspaceNetwork() { return getEl('workspace-network'); },
    get workspaceEditor() { return getEl('workspace-editor'); },
    get workspaceComm() { return getEl('workspace-comm'); },
    get workspaceLocation() { return getEl('workspace-location'); },
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
    get searchTypeExact() { return getEl('search-type-exact'); },
    get searchTypeSemantic() { return getEl('search-type-semantic'); },
    get allowExactSearchToggle() { return getEl('allow-exact-search-toggle'); },
    get allowSemanticSearchToggle() { return getEl('allow-semantic-search-toggle'); },
    get searchHistoryContainer() { return getEl('search-history-container'); },
    
    // Connection Stats
    get connStatsModal() { return getEl('conn-stats-modal'); },
    get connStatsTitle() { return getEl('conn-stats-title'); },
    get connStatsViz() { return getEl('conn-stats-viz'); },
    get connStatsDetails() { return getEl('conn-stats-details'); },
    get connStatsClose() { return getEl('conn-stats-close'); },

    // Gitgraph
    get viewGitgraphBtn() { return getEl('view-gitgraph-btn'); },
    get gitgraphModal() { return getEl('gitgraph-modal'); },
    get gitgraphContainer() { return getEl('gitgraph-container'); },
    get gitgraphClose() { return getEl('gitgraph-close'); },

    // Server Configuration
    get openServerConfigBtn() { return getEl('open-server-config-btn'); },
    get serverConfigModal() { return getEl('server-config-modal'); },
    get serverConfigCloseBtn() { return getEl('server-config-close'); },
    get serverConfigCancelBtn() { return getEl('server-config-cancel'); },
    get serverConfigSaveBtn() { return getEl('server-config-save'); },
    get serverConfigResetBtn() { return getEl('server-config-reset'); },
    get serverConfigTestBtn() { return getEl('server-config-test'); },
    get serverConfigImportBtn() { return getEl('server-config-import-btn'); },
    get serverConfigImportModal() { return getEl('server-config-import-modal'); },
    get serverConfigImportModalClose() { return getEl('server-config-import-modal-close'); },
    get serverConfigImportModalApply() { return getEl('server-config-import-modal-apply'); },
    get serverConfigImportJsonTextarea() { return getEl('server-config-import-json'); },
    get serverCommunityTopicInput() { return getEl('server-community-topic'); },
    get serverCommunityDiscoverBtn() { return getEl('server-community-discover-btn'); },
    get serverCommunityStatus() { return getEl('server-community-status'); },
    get serverConfigScanQrBtn() { return getEl('server-config-scan-qr-btn'); },
    get serverImportScanCameraBtn() { return getEl('server-import-scan-camera-btn'); },
    get qrCameraScannerModal() { return getEl('qr-camera-scanner-modal'); },
    get qrVideo() { return getEl('qr-video'); },
    get qrCanvas() { return getEl('qr-canvas'); },
    get qrScannerFeedback() { return getEl('qr-scanner-feedback'); },
    get qrFileInput() { return getEl('qr-file-input'); },
    get qrCameraCloseBtn() { return getEl('qr-camera-close-btn'); },
    get serverSignalingHost() { return getEl('server-signaling-host'); },
    get serverSignalingPort() { return getEl('server-signaling-port'); },
    get serverSignalingPath() { return getEl('server-signaling-path'); },
    get serverSignalingSecure() { return getEl('server-signaling-secure'); },
    get serverTurnUrls() { return getEl('server-turn-urls'); },
    get serverTurnUser() { return getEl('server-turn-user'); },
    get serverTurnPass() { return getEl('server-turn-pass'); },
    get serverCloudApi() { return getEl('server-cloud-api'); },
    get serverTestStatus() { return getEl('server-test-status'); }
};
