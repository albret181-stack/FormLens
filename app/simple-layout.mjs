import {EXERCISES} from './exercises.mjs';
import {LAYOUTS} from './video-regions.mjs';
// Progressive disclosure: one upload screen, then the video and findings.
const $=id=>document.getElementById(id);
const makeDetails=(label,className)=>{const el=document.createElement('details');el.className=className;const summary=document.createElement('summary');summary.textContent=label;el.append(summary);return el};
document.body.classList.add('simple-ui');
const settings=makeDetails('Ещё','app-options');
for(const el of [document.querySelector('.theme-picker'),$('library-open'),$('updates-open')])settings.append(el);
document.querySelector('.appbar').append(settings);
const title=document.querySelector('.title-row');title.querySelector('h1').textContent='Проверьте технику по видео';title.querySelector('p').textContent='Ключевые кадры, фазы движения и моменты для проверки корпуса.';
const setup=document.querySelector('.setup');
setup.querySelector('label[for="machine"]').textContent='Упражнение';
$('upload').textContent='Загрузить видео';$('analyze').textContent='Повторить разбор';document.querySelector('.setup .check').hidden=true;
const guide=document.createElement('p');guide.className='simple-guide';guide.textContent='Для руки нужны плечо, локоть и кисть; для корпуса — ещё таз. Снимайте сбоку, держите камеру неподвижно. До 60 секунд. Разбор кадров начнётся автоматически.';setup.insertBefore(guide,setup.querySelector('.check'));
const options=makeDetails('Сохранить или экспортировать разбор','result-options');
options.append(document.querySelector('.project-bar'));
// Keep legacy note fields for opening saved projects, outside the visible review flow.
document.querySelector('.notes-panel').hidden=true;
document.querySelector('.comparison').hidden=true;
const actions=document.createElement('div');actions.className='extra-actions';
for(const id of ['html-report','export','save-frame'])actions.append($(id));options.append(actions);document.querySelector('.work-area').append(options);$('pin').hidden=true;
document.querySelector('.findings .panel-top').after(document.querySelector('.work-footer'));
setup.after($('banner'));
document.querySelector('.findings h2').textContent='Разбор видео';document.querySelector('.viewer h2').textContent='Ваше видео';document.querySelector('.comparison h2').textContent='Посмотрите на разницу';
$('new-session').textContent='Другое видео';
// Upload remains the only primary action before a file is selected.
for(const name of ['dragover','drop'])setup.addEventListener(name,event=>{event.preventDefault();if(name==='drop')$('stage').dispatchEvent(new DragEvent('drop',{dataTransfer:event.dataTransfer}))});



// A single optional exercise choice, then a slide review.
const exerciseField=$('machine').closest('.field');exerciseField.classList.add('exercise-field');
$('machine').replaceChildren();
for(const e of EXERCISES){const option=document.createElement('option');option.value=e.id;option.textContent=e.name;$('machine').append(option)}
const source=document.createElement('button');source.id='source-toggle';source.textContent='Открыть исходное видео';source.className='secondary';setup.append(source);
const recording=makeDetails('Как снять видео','shoot-guide');recording.id='shoot-guide';const recordingBody=document.createElement('div');recordingBody.id='shoot-guide-body';const guideSelect=document.createElement('select');guideSelect.id='guide-exercise';guideSelect.setAttribute('aria-label','Упражнение для подсказки по съёмке');for(const e of EXERCISES){const option=document.createElement('option');option.value=e.id;option.textContent=e.name;guideSelect.append(option)}recording.append(guideSelect,recordingBody);setup.append(recording);
const layoutDetails=makeDetails('Если видео разделено на части','layout-options');const layoutLabel=document.createElement('label');layoutLabel.textContent='Расположение вариантов';layoutLabel.htmlFor='video-layout';const layoutSelect=document.createElement('select');layoutSelect.id='video-layout';
for(const [id,name]of LAYOUTS){const option=document.createElement('option');option.value=id;option.textContent=name;layoutSelect.append(option)}
const layoutNote=document.createElement('p');layoutNote.textContent='Одно видео — одно упражнение. Варианты могут отличаться постановкой ног, амплитудой или акцентом. Если автоматическое разделение не подошло, выберите расположение вручную.';layoutDetails.append(layoutLabel,layoutSelect,layoutNote);setup.append(layoutDetails);
const picker=document.createElement('dialog');picker.id='exercise-dialog';const pickerTitle=document.createElement('h2');pickerTitle.textContent='Какое упражнение на видео?';const pickerText=document.createElement('p');pickerText.textContent='Выберите один тип для всего видео, даже если показаны разные варианты. Автоматическое определение упражнения пока не подключено.';const search=document.createElement('input');search.id='exercise-search';search.type='search';search.placeholder='Найти упражнение';search.setAttribute('aria-label','Поиск упражнения');const grid=document.createElement('div');grid.id='exercise-choices';const skip=document.createElement('button');skip.id='exercise-skip';skip.textContent='Не знаю — показать доступные наблюдения';const back=document.createElement('button');back.id='exercise-back';back.textContent='Назад';picker.append(pickerTitle,pickerText,search,grid,skip,back);document.body.append(picker);
title.querySelector('h1').textContent='Разбор упражнения по видео';title.querySelector('p').textContent='Загрузите видео, выберите упражнение и посмотрите разбор в слайдах.';
