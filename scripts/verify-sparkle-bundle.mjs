import {spawnSync} from 'node:child_process';
import path from 'node:path';
const bundle=path.resolve('../build/FormLens-darwin-arm64/FormLens.app');
const result=spawnSync(path.join(bundle,'Contents/Resources/updater/sparkle.app/Contents/MacOS/sparkle'),['--help'],{encoding:'utf8'});
if(!String(result.stderr).includes('Usage:')||result.signal)throw Error('Sparkle CLI/framework failed to launch from the packaged app');
console.log('Packaged Sparkle CLI and framework load successfully');
