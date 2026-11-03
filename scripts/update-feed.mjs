import {createPublicKey,verify} from 'node:crypto';
export function makeSparkleFeed({version,size,signature}){
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw Error('Invalid release version');
 if(!Number.isSafeInteger(size)||size<=0)throw Error('Invalid archive size');
 if(!/^[A-Za-z0-9+/]{86}==$/.test(signature))throw Error('Invalid Ed25519 signature');
 return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>FormLens</title><item><title>FormLens ${version}</title><sparkle:version>${version}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString><enclosure url="https://github.com/albret181-stack/FormLens/releases/download/v${version}/FormLens-${version}-arm64.zip" sparkle:edSignature="${signature}" length="${size}" type="application/octet-stream" /></item></channel></rss>\n`;
}
export function verifyArchive(bytes,signature,publicKey){
 try{if(!/^[A-Za-z0-9+/]{43}=$/.test(publicKey||''))return false;const key=createPublicKey({format:'der',type:'spki',key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKey,'base64')])});return verify(null,bytes,key,Buffer.from(signature,'base64'))}catch{return false}
}
