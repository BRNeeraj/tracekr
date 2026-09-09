(() => {
  const result = document.getElementById('scan-result');
  const startButton = document.getElementById('start-camera');
  const imageInput = document.getElementById('qr-image');
  let scanner;
  let busy = false;
  let cameraStarted = false;
  let cameraAttempted = false;

  function show(kind, title, detail) {
    result.className = `scan-result ${kind}`;
    result.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  }

  async function processCode(code) {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch('/api/scan', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({participant_id: code.trim(), service_id: document.getElementById('service').value})});
      const data = await response.json();
      if (data.status === 'success') show('success', '✓ SERVICE GIVEN', `${data.participant} · ${data.team}<br>${data.service} · ${data.time}`);
      else if (data.status === 'duplicate') show('duplicate', '⚠ ALREADY TAKEN', `${data.participant} · ${data.team}<br>${data.service} was given at ${data.time}`);
      else show('invalid', '✕ INVALID PARTICIPANT', data.message || 'Participant ID not found.');
    } catch (error) {
      show('invalid', 'SCAN ERROR', 'Could not reach the server. Check the Wi-Fi connection.');
    }
    setTimeout(() => { busy = false; show('idle', 'Ready for next scan', 'Show the next participant QR code.'); }, 2200);
  }

  function startLiveCamera() {
    if (cameraStarted || cameraAttempted) return;
    cameraAttempted = true;
    startButton.disabled = true;
    if (!window.Html5Qrcode) { show('invalid', 'SCANNER UNAVAILABLE', 'Reload the page to try again.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      show('invalid', 'HTTPS REQUIRED FOR LIVE CAMERA', 'Open the HTTPS phone URL, accept the certificate warning, then try again.');
      return;
    }
    scanner = new Html5Qrcode('reader');
    scanner.start({facingMode: 'environment'}, {fps: 10, qrbox: {width: 240, height: 240}}, processCode, () => {}).then(() => {
      cameraStarted = true;
      startButton.style.display = 'none';
      show('idle', 'Ready to scan', 'Live camera is active.');
    }).catch(() => show('invalid', 'CAMERA ACCESS NEEDED', 'Allow camera access in the browser, or use the phone camera button below.'));
  }

  async function scanImage(file) {
    if (!window.Html5Qrcode || !file) return;
    const imageScanner = new Html5Qrcode('reader');
    show('idle', 'Reading QR image', 'Hold on a moment...');
    try {
      const code = await imageScanner.scanFile(file, true);
      await processCode(code);
    } catch (error) {
      show('invalid', 'QR NOT FOUND', 'Take a clear photo of the participant QR code and try again.');
      setTimeout(() => show('idle', 'Ready to scan', 'Choose the phone camera button for the next participant.'), 2200);
    } finally {
      imageScanner.clear().catch(() => {});
      imageInput.value = '';
    }
  }

  startButton.addEventListener('click', startLiveCamera);
  imageInput.addEventListener('change', () => scanImage(imageInput.files[0]));
})();
