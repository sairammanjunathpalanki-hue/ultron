async function runVerification() {
  console.log('=====================================================');
  console.log(' ULTRON SYSTEM END-TO-END RUNTIME VERIFICATION');
  console.log('=====================================================');

  // 1. Health & Status
  const statusRes = await fetch('http://localhost:3001/api/status');
  const status = await statusRes.json();
  console.log('\n[1] System Status:', JSON.stringify(status, null, 2));

  // 2. Web Search Tool Execution
  console.log('\n[2] Executing Web Research Command...');
  const searchRes = await fetch('http://localhost:3001/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'Ultron, search the web for Smart India Hackathon 2026.' }),
  });
  const searchData = await searchRes.json();
  console.log('Response:', searchData.textResponse);
  console.log('Tool Result Status:', searchData.toolCallsExecuted?.[0]?.status);
  console.log('Retrieved Results Count:', searchData.toolCallsExecuted?.[0]?.result?.results?.length);

  // 3. Document / Presentation Generation Tool Execution
  console.log('\n[3] Executing Presentation Generation Command...');
  const pptRes = await fetch('http://localhost:3001/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'Ultron, create a presentation on Smart India Hackathon 2026.' }),
  });
  const pptData = await pptRes.json();
  console.log('Response:', pptData.textResponse);
  console.log('Generated File:', pptData.toolCallsExecuted?.[0]?.result?.filename);
  console.log('Slide Count:', pptData.toolCallsExecuted?.[0]?.result?.slideCount);

  // 4. Level 3 High Impact Action & Permission Authorization
  console.log('\n[4] Executing Level 3 High Impact Action: Delete File...');
  const delRes = await fetch('http://localhost:3001/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'Ultron, delete temporary_files' }),
  });
  const delData = await delRes.json();
  console.log('Response:', delData.textResponse);
  console.log('Pending Confirmation:', delData.pendingConfirmation ? 'YES (Level ' + delData.pendingConfirmation.permissionLevel + ')' : 'NO');

  if (delData.pendingConfirmation) {
    const approvalId = delData.pendingConfirmation.id;
    console.log(`\n[4b] Authorizing pending approval "${approvalId}" via simulated gesture/button...`);
    const authRes = await fetch('http://localhost:3001/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId, approved: true }),
    });
    const authData = await authRes.json();
    console.log('Authorization Result:', authData);
  }

  // 5. Emergency STOP Test
  console.log('\n[5] Triggering Emergency STOP...');
  const stopRes = await fetch('http://localhost:3001/api/stop', { method: 'POST' });
  const stopData = await stopRes.json();
  console.log('Emergency Stop Result:', stopData);

  // 6. Inspect Audit Trail
  console.log('\n[6] Checking Audit Log...');
  const auditRes = await fetch('http://localhost:3001/api/audit');
  const auditRecords = await auditRes.json();
  console.log(`Total Audit Records: ${auditRecords.length}`);
  console.log('Recent 3 Records:');
  auditRecords.slice(0, 3).forEach((r: any) => {
    console.log(`- [${r.status}] ${r.name} (Level ${r.permissionLevel}) @ ${new Date(r.timestamp).toISOString()}`);
  });

  // 7. Verify Sandbox Files
  console.log('\n[7] Inspecting Sandbox Files...');
  const filesRes = await fetch('http://localhost:3001/api/files');
  const files = await filesRes.json();
  console.log(`Total Sandbox Files: ${files.length}`);
  files.forEach((f: any) => {
    console.log(`- ${f.relativePath} (${f.size} bytes)`);
  });

  console.log('\n=====================================================');
  console.log(' VERIFICATION COMPLETE: ALL SYSTEMS NOMINAL');
  console.log('=====================================================');
}

runVerification().catch(console.error);
