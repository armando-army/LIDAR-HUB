import {mountProjectHub} from './project-hub.mjs?v=6';
mountProjectHub(document.getElementById('catalog'),project=>{
 const url=new URL(project.url,location.href);
 const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.click();
},{online:true});
