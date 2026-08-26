const { PeerServer } = require('peer');

const server = PeerServer({ port: 9005, path: '/' });
console.log('[PeerJS Process] Signaling server started on port 9005');
