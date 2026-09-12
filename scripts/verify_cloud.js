async function run() {
  const statusRes = await fetch('https://ultron-command-center.onrender.com/api/status');
  const statusData = await statusRes.json();
  console.log('--- CLOUD STATUS ---');
  console.log(JSON.stringify(statusData, null, 2));

  const cmdRes = await fetch('https://ultron-command-center.onrender.com/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'Ultron, report status for mobile 5G field deployment.'
    })
  });
  const cmdData = await cmdRes.json();
  console.log('--- CLOUD AI COMMAND RESPONSE ---');
  console.log(JSON.stringify(cmdData, null, 2));
}

run().catch(console.error);
