const {start}=require('../server.cjs');
start(4174).then(()=>console.log('Open http://127.0.0.1:4174/app/selftest.html — expected RESULT with ok:true in page title. Ctrl+C to stop.'));
