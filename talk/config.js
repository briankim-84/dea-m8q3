// 실전 대화 서버 주소
window.TALK_API = "https://dewb-talk.khbk0901.workers.dev";

// 실전 대화(AI) 없이 상황 연습만 쓰는 학생 (2026-10-30 Olivia)
window.NO_LIVE = ["olivia-h4t2"];
(function(){
  var sid=(new URLSearchParams(location.search).get('s')||'').replace(/[^a-z0-9-]/gi,'');
  if(window.NO_LIVE.indexOf(sid)<0) return;
  window.TALK_API="";
  var st=document.createElement('style');
  st.textContent="#liveStart,#liveFromResult,#homeLeft,#live{display:none!important}.startrow #start{flex:1 1 100%}";
  (document.head||document.documentElement).appendChild(st);
  function clean(){
    var it=document.getElementById('introTx');
    if(it&&/실전 대화/.test(it.textContent)) it.textContent=it.textContent.replace(/,?\s*실전 대화로 자유롭게 말해 보세요\.?/,'.').replace(/익히고\./,'익혀 보세요.');
    var sub=document.querySelector('.sub');
    if(sub&&/실전 대화까지/.test(sub.textContent)) sub.textContent=sub.textContent.replace(/,\s*실전 대화까지/,'');
    var pc=document.getElementById('phrCount');
    if(pc&&/실전 대화와 /.test(pc.textContent)) pc.textContent=pc.textContent.replace('실전 대화와 ','');
  }
  document.addEventListener('DOMContentLoaded',function(){
    clean();
    var it=document.getElementById('introTx');
    if(it) new MutationObserver(clean).observe(it,{childList:true,characterData:true,subtree:true});
  });
})();
