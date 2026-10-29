// Progressive disclosure: one upload screen, then the video and findings.
const $=id=>document.getElementById(id);
const makeDetails=(label,className)=>{const el=document.createElement('details');el.className=className;const summary=document.createElement('summary');summary.textContent=label;el.append(summary);return el};
document.body.classList.add('simple-ui');
const settings=makeDetails('Ещё','app-options');
for(const el of [document.querySelector('.theme-picker'),$('library-open'),$('updates-open')])settings.append(el);
document.querySelector('.appbar').append(settings);
const title=document.querySelector('.title-row');title.querySelector('h1').textContent='Проверьте технику по видео';title.querySelector('p').textContent='Загрузите подход — получите замечания с объяснением и отметками на ваших кадрах.';
const setup=document.querySelector('.setup');
setup.querySelector('label[for="machine"]').textContent='Упражнение';
$('upload').textContent='Загрузить видео';$('analyze').textContent='Разобрать видео';
const guide=document.createElement('p');guide.className='simple-guide';guide.textContent='Снимайте сбоку: один человек, неподвижная камера, суставы видны. До 60 секунд.';setup.insertBefore(guide,setup.querySelector('.check'));
const options=makeDetails('Сохранить или экспортировать разбор','result-options');
options.append(document.querySelector('.project-bar'));
// Keep legacy note fields for opening saved projects, outside the visible review flow.
document.querySelector('.notes-panel').hidden=true;
document.querySelector('.comparison').hidden=true;
const actions=document.createElement('div');actions.className='extra-actions';
for(const id of ['html-report','export','save-frame'])actions.append($(id));options.append(actions);document.querySelector('.work-area').append(options);$('pin').hidden=true;
document.querySelector('.work-area').prepend(document.querySelector('.work-footer'));
setup.after($('banner'));
document.querySelector('.findings h2').textContent='Моменты для проверки';document.querySelector('.viewer h2').textContent='Ваше видео';document.querySelector('.comparison h2').textContent='Посмотрите на разницу';
$('new-session').textContent='Другое видео';
// Upload remains the only primary action before a file is selected.
for(const name of ['dragover','drop'])setup.addEventListener(name,event=>{event.preventDefault();if(name==='drop')$('stage').dispatchEvent(new DragEvent('drop',{dataTransfer:event.dataTransfer}))});

