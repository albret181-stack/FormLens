/** One inference request at a time; every terminal path releases its timer. */
export class PoseClient {
 constructor(worker,{timeoutMs=90000}={}){this.worker=worker;this.timeoutMs=timeoutMs;this.pending=null;this.closed=false;
  worker.onmessage=({data})=>{if(!this.pending)return;const pending=this.pending;this.pending=null;clearTimeout(pending.timer);if(data.type==='error')pending.reject(new Error(data.message));else pending.resolve(data)};
  worker.onerror=error=>this.close(new Error(error.message||'Ошибка распознавания'));
 }
 request(data,transfer=[]){
  if(this.closed)return Promise.reject(new Error('Распознавание остановлено'));
  if(this.pending)return Promise.reject(new Error('Предыдущий кадр ещё обрабатывается'));
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.close(new Error('Распознавание не ответило вовремя. Повторите анализ.')),this.timeoutMs);this.pending={resolve,reject,timer};try{this.worker.postMessage(data,transfer)}catch(error){this.close(error)}});
 }
 close(error=new Error('Анализ отменён')){if(this.closed)return;this.closed=true;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null}this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate()}
}
