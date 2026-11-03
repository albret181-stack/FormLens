export async function prepareUpdate({isBusy,pause,lock,persist,unlock}) {
 if(isBusy())throw Error('Дождитесь окончания анализа или переноса проекта, затем повторите установку.');
 pause();lock();
 try{await persist()}
 catch{throw Error('Не удалось сохранить разбор. Установка не начата — освободите место и повторите попытку.')}
 finally{unlock()}
}
