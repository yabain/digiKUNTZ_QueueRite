const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('queuePrinter',{printTicket:(payload)=>ipcRenderer.invoke('queue:print-ticket',payload)});
