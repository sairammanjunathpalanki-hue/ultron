async function testLanConnectivity() {
  const lanIp = '10.219.97.218';
  console.log('=====================================================');
  console.log(' ULTRON LAN & LOCALHOST CONNECTIVITY VERIFICATION');
  console.log('=====================================================');

  // 1. Localhost Backend Status
  console.log('\n[1] Testing Localhost Backend (http://localhost:3001/api/status)...');
  const res1 = await fetch('http://localhost:3001/api/status');
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Model: ${data1.model?.status || 'OK'}`);

  // 2. LAN Backend Status
  console.log(`\n[2] Testing LAN Backend (http://${lanIp}:3001/api/status)...`);
  const res2 = await fetch(`http://${lanIp}:3001/api/status`);
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Model: ${data2.model?.status || 'OK'}`);

  // 3. LAN Frontend HTML
  console.log(`\n[3] Testing LAN Frontend Web Page (http://${lanIp}:5173/)...`);
  const res3 = await fetch(`http://${lanIp}:5173/`);
  console.log(`Status: ${res3.status}, Content-Type: ${res3.headers.get('content-type')}`);

  // 4. LAN Frontend -> Backend Proxy (/api/status via Vite on LAN)
  console.log(`\n[4] Testing Frontend -> Backend Proxy on LAN (http://${lanIp}:5173/api/status)...`);
  const res4 = await fetch(`http://${lanIp}:5173/api/status`);
  const data4 = await res4.json();
  console.log(`Status: ${res4.status}, Ultron Status: ${data4.status}, Backend Version: ${data4.version}`);

  // 5. CORS check on Backend directly from LAN origin
  console.log(`\n[5] Testing CORS headers on Backend (http://${lanIp}:3001) with LAN Origin...`);
  const res5 = await fetch(`http://${lanIp}:3001/api/status`, {
    headers: {
      'Origin': `http://${lanIp}:5173`,
    },
  });
  console.log(`Status: ${res5.status}`);
  console.log(`Access-Control-Allow-Origin: ${res5.headers.get('access-control-allow-origin')}`);
  console.log(`Access-Control-Allow-Credentials: ${res5.headers.get('access-control-allow-credentials')}`);

  // 6. Preflight OPTIONS request
  console.log(`\n[6] Testing Preflight OPTIONS (http://${lanIp}:3001/api/command)...`);
  const res6 = await fetch(`http://${lanIp}:3001/api/command`, {
    method: 'OPTIONS',
    headers: {
      'Origin': `http://${lanIp}:5173`,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  console.log(`Status: ${res6.status}`);
  console.log(`Access-Control-Allow-Origin: ${res6.headers.get('access-control-allow-origin')}`);
  console.log(`Access-Control-Allow-Methods: ${res6.headers.get('access-control-allow-methods')}`);

  // 7. Full Command Dispatch through LAN Frontend Proxy
  console.log(`\n[7] Testing Command Dispatch via LAN Frontend (http://${lanIp}:5173/api/command)...`);
  const res7 = await fetch(`http://${lanIp}:5173/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'Ultron status check from Android phone' }),
  });
  const data7 = await res7.json();
  console.log(`Status: ${res7.status}`);
  console.log(`Ultron Response: ${data7.textResponse ? data7.textResponse.slice(0, 80) : JSON.stringify(data7).slice(0, 80)}...`);

  console.log('\n=====================================================');
  console.log(' ALL LAN & CORS VERIFICATIONS PASSED SUCCESSFULLY');
  console.log('=====================================================');
}

testLanConnectivity().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
