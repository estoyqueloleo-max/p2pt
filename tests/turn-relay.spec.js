import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

let serverProcess;
const HTTP_PORT = 9005;
const TURN_PORT = 3479;

test.beforeAll(async () => {
  console.log('[Test Setup] Spawning pingo-server...');
  const serverBinary = path.resolve('server/pingo-server');

  serverProcess = spawn(serverBinary, [
    '-no-upnp',
    `-port=${HTTP_PORT}`,
    `-turn-port=${TURN_PORT}`,
    '-public-ip=127.0.0.1',
    '-user=pingo',
    '-password=pingosecret',
    '-realm=pingo'
  ], { stdio: 'inherit' });

  await new Promise((resolve) => setTimeout(resolve, 1500));
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

test('Fase 2: Conexión WebRTC obligatoria a través de Pion TURN en Go (iceTransportPolicy: relay)', async ({ browser }) => {
  test.setTimeout(45000);

  const contextA = await browser.newContext({ ignoreHTTPSErrors: true });
  const contextB = await browser.newContext({ ignoreHTTPSErrors: true });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  pageA.on('console', msg => console.log(`[Alice] ${msg.text()}`));
  pageB.on('console', msg => console.log(`[Bob] ${msg.text()}`));

  await Promise.all([pageA.goto('/'), pageB.goto('/')]);

  const turnConfig = {
    iceTransportPolicy: 'relay',
    iceServers: [{
      urls: [`turn:127.0.0.1:${TURN_PORT}?transport=udp`],
      username: 'pingo',
      credential: 'pingosecret'
    }]
  };

  // 1. Initialize Alice's RTCPeerConnection and create offer
  const offer = await pageA.evaluate(async (cfg) => {
    window.pc = new RTCPeerConnection(cfg);
    window.dc = window.pc.createDataChannel('pingo-relay-channel');
    window.receivedMsg = null;
    window.candidates = [];

    window.pc.onicecandidate = (e) => {
      if (e.candidate) window.candidates.push(e.candidate.toJSON());
    };

    window.dcOpenPromise = new Promise((resolve) => {
      window.dc.onopen = () => {
        console.log('[Alice DC] Opened via TURN Relay!');
        window.dc.send('PINGO_STREAMING_TEST_OVER_GO_TURN');
        resolve(true);
      };
    });

    const offer = await window.pc.createOffer();
    await window.pc.setLocalDescription(offer);
    return offer;
  }, turnConfig);

  // 2. Initialize Bob's RTCPeerConnection with Alice's offer and create answer
  const answer = await pageB.evaluate(async ({ cfg, offer }) => {
    window.pc = new RTCPeerConnection(cfg);
    window.candidates = [];

    window.pc.onicecandidate = (e) => {
      if (e.candidate) window.candidates.push(e.candidate.toJSON());
    };

    window.dcMsgPromise = new Promise((resolve) => {
      window.pc.ondatachannel = (e) => {
        const dc = e.channel;
        dc.onmessage = (evt) => {
          console.log('[Bob DC] Received:', evt.data);
          window.receivedMsg = evt.data;
          resolve(evt.data);
        };
      };
    });

    await window.pc.setRemoteDescription(offer);
    const answer = await window.pc.createAnswer();
    await window.pc.setLocalDescription(answer);
    return answer;
  }, { cfg: turnConfig, offer });

  // 3. Set Bob's answer on Alice
  await pageA.evaluate(async (answer) => {
    await window.pc.setRemoteDescription(answer);
  }, answer);

  // 4. Exchange gathered ICE candidates between Alice and Bob
  const pollAndExchangeCandidates = async () => {
    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      const candsA = await pageA.evaluate(() => {
        const c = window.candidates || [];
        window.candidates = [];
        return c;
      });

      const candsB = await pageB.evaluate(() => {
        const c = window.candidates || [];
        window.candidates = [];
        return c;
      });

      if (candsA.length > 0) {
        await pageB.evaluate(async (cands) => {
          for (const c of cands) await window.pc.addIceCandidate(c);
        }, candsA);
      }

      if (candsB.length > 0) {
        await pageA.evaluate(async (cands) => {
          for (const c of cands) await window.pc.addIceCandidate(c);
        }, candsB);
      }

      await new Promise(r => setTimeout(r, 200));
    }
  };

  const exchangePromise = pollAndExchangeCandidates();

  // 5. Wait for Alice DC open and Bob received message
  const aliceDcOpen = pageA.evaluate(() => window.dcOpenPromise);
  const bobMsg = pageB.evaluate(() => window.dcMsgPromise);

  const [receivedMsg] = await Promise.all([bobMsg, aliceDcOpen, exchangePromise]);

  console.log('[Test Success] Received message over relay:', receivedMsg);
  expect(receivedMsg).toBe('PINGO_STREAMING_TEST_OVER_GO_TURN');

  // 6. Verify stats
  const stats = await pageA.evaluate(async () => {
    const report = await window.pc.getStats();
    let isRelayed = false;
    let localCandidateType = null;
    report.forEach(r => {
      if (r.type === 'local-candidate') {
        localCandidateType = r.candidateType;
        if (r.candidateType === 'relay') isRelayed = true;
      }
    });
    return { isRelayed, localCandidateType };
  });

  console.log('[Test Stats Result]', JSON.stringify(stats));
  expect(stats.isRelayed).toBe(true);
  expect(stats.localCandidateType).toBe('relay');
  console.log('🎉 Fase 2 completada con éxito: Conexión WebRTC Relay verificada entre 2 contextos!');

  await contextA.close();
  await contextB.close();
});
