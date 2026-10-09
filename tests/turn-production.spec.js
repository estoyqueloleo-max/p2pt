import { test, expect } from '@playwright/test';

test.describe('Producción Appliance End-to-End Validation', () => {
  const prodConfig = {
    version: 1,
    signaling: {
      host: 'pingo.appliances.klitosan.com',
      port: 443,
      path: '/',
      secure: true
    },
    turn: {
      urls: [
        'stun:pingo.appliances.klitosan.com:3478',
        'turn:pingo.appliances.klitosan.com:3478?transport=udp'
      ],
      username: 'pingo',
      credential: 'pingosecret'
    },
    capabilities: {
      broadcast_relay: true,
      turn_allowed_for_media: true
    }
  };

  test('Validar WebRTC Relay forzado (iceTransportPolicy: relay) contra TURN de producción', async ({ browser }) => {
    test.setTimeout(60000);

    const contextA = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextB = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageA.on('console', msg => console.log(`[Prod Alice] ${msg.text()}`));
    pageB.on('console', msg => console.log(`[Prod Bob] ${msg.text()}`));

    await Promise.all([pageA.goto('/'), pageB.goto('/')]);

    const turnConfig = {
      iceTransportPolicy: 'relay',
      iceServers: [{
        urls: prodConfig.turn.urls,
        username: prodConfig.turn.username,
        credential: prodConfig.turn.credential
      }]
    };

    // 1. Inicializar RTCPeerConnection en Alice forzando TURN Relay
    const offer = await pageA.evaluate(async (cfg) => {
      window.pc = new RTCPeerConnection(cfg);
      window.dc = window.pc.createDataChannel('prod-turn-test-channel');
      window.receivedMsg = null;
      window.candidates = [];

      window.pc.onicecandidate = (e) => {
        if (e.candidate) window.candidates.push(e.candidate.toJSON());
      };

      window.dcOpenPromise = new Promise((resolve) => {
        window.dc.onopen = () => {
          console.log('[Alice DC] DataChannel abierto a través de TURN de producción!');
          window.dc.send('PINGO_PROD_TURN_SUCCESS');
          resolve(true);
        };
      });

      const offer = await window.pc.createOffer();
      await window.pc.setLocalDescription(offer);
      return offer;
    }, turnConfig);

    // 2. Inicializar RTCPeerConnection en Bob con la oferta de Alice
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
            console.log('[Bob DC] Mensaje recibido vía TURN producción:', evt.data);
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

    // 3. Alice aplica la respuesta de Bob
    await pageA.evaluate(async (answer) => {
      await window.pc.setRemoteDescription(answer);
    }, answer);

    // 4. Intercambiar candidatos ICE entre Alice y Bob
    const pollAndExchangeCandidates = async () => {
      const maxRetries = 30;
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

    // 5. Esperar apertura y recepción del mensaje vía Relay
    const aliceDcOpen = pageA.evaluate(() => window.dcOpenPromise);
    const bobMsg = pageB.evaluate(() => window.dcMsgPromise);

    const [receivedMsg] = await Promise.all([bobMsg, aliceDcOpen, exchangePromise]);

    console.log('[Test Success] Mensaje recibido a través del TURN de producción:', receivedMsg);
    expect(receivedMsg).toBe('PINGO_PROD_TURN_SUCCESS');

    // 6. Verificar estadísticas de WebRTC: validar que se usó candidato relay
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

    await contextA.close();
    await contextB.close();
  });
});
