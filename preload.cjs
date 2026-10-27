const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('formlensUpdates',Object.freeze({
 state:()=>ipcRenderer.invoke('updates:state'),
 check:()=>ipcRenderer.invoke('updates:check'),
 download:()=>ipcRenderer.invoke('updates:download'),
 onState:callback=>{const handler=(_event,state)=>callback(state);ipcRenderer.on('updates:state',handler);return ()=>ipcRenderer.removeListener('updates:state',handler)}
}));
