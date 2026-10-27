export const PALETTES = {
 slate: {name:'Сланец и бирюза',scheme:'dark',bg:'#11191f',surface:'#1a252d',raised:'#22313b',text:'#ecf2f4',muted:'#b0bec6',accent:'#86c8bd',ink:'#102620',line:'#51626d',warning:'#ffb38a',danger:'#ff8f9a',warningSurface:'#332b25'},
 sand: {name:'Песок и шалфей',scheme:'light',bg:'#f3f1ea',surface:'#fffefa',raised:'#e8ece6',text:'#24352f',muted:'#52665c',accent:'#35685b',ink:'#ffffff',line:'#99aaa0',warning:'#984221',danger:'#a52e43',warningSurface:'#f5e8d8'},
 iris: {name:'Индиго и лаванда',scheme:'dark',bg:'#171724',surface:'#222237',raised:'#2c2d46',text:'#f1effa',muted:'#bdb9d5',accent:'#b6aaf2',ink:'#24203d',line:'#62627d',warning:'#f3b8a0',danger:'#ff97aa',warningSurface:'#342c38'}
};
export function initTheme(select){
 const apply=id=>{const palette=PALETTES[id]||PALETTES.slate;document.documentElement.dataset.theme=id in PALETTES?id:'slate';for(const [key,value]of Object.entries(palette)){if(key!=='name')document.documentElement.style.setProperty('--theme-'+key,value)}try{localStorage.setItem('formlens-theme',id)}catch{}select.value=document.documentElement.dataset.theme};
 for(const [id,palette]of Object.entries(PALETTES)){const option=document.createElement('option');option.value=id;option.textContent=palette.name;select.append(option)}
 let saved='slate';try{saved=localStorage.getItem('formlens-theme')||saved}catch{}apply(saved);select.addEventListener('change',()=>apply(select.value));
}
