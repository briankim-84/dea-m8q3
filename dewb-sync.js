/*! DEWB 진도 백업 — dewb-sync.js v1 (2026-11)
 *  브라우저(localStorage)에만 있던 학습 기록(dewb:*)을 서버(dewb-talk /sync)에 백업하고,
 *  기기 저장소가 지워졌을 때 서버에서 다시 불러온다.
 *  - 학생 구분: ?s=폴더 / 허브 경로 / 마지막으로 본 폴더(dewb:sid)
 *  - 병합 규칙은 서버와 동일(DEWB_MERGE) — 항상 "더 많이 진행한 쪽"을 남긴다.
 */
(function(){
  'use strict';
  if (window.DEWBSync) return;
  var API = 'https://dewb-talk.khbk0901.workers.dev/sync';
  var SKIP = /^dewb:(sid|seen:)/;          /* 백업하지 않는 키 */
  var PUSH_GAP = 15000;                     /* 활동 중 최소 업로드 간격(ms) */
  var LS = window.localStorage;
  var rawSet = LS ? Storage.prototype.setItem : null;

  /* ───── 병합 규칙 (서버 worker와 같은 코드) ───── */
  function wRank(s){ if(!s) return -1; return s.known ? 1000 : (s.st||0)*10 + (s.box||0); }
  function mergeVal(k, a, b){
    if (a == null) return b; if (b == null) return a;
    try{
      if (/^dewb:words:/.test(k)){            /* 단어별로 더 진행한 쪽 */
        var o = {}, x;
        for (x in a) o[x] = a[x];
        for (x in b) if (wRank(b[x]) > wRank(o[x])) o[x] = b[x];
        return o;
      }
      if (/^dewb:quiz:/.test(k) || /^dewb:talk:[^:]+:[^:]+$/.test(k)){   /* 레벨·에피소드별 최고점 */
        var q = {}, y;
        for (y in a) q[y] = a[y];
        for (y in b) q[y] = (q[y] == null) ? b[y] : Math.max(+q[y], +b[y]);
        return q;
      }
      if (/^dewb:qprog:/.test(k)){            /* 퀴즈 이어 하기: 레벨별 최신 */
        var p = {}, z;
        for (z in a) p[z] = a[z];
        for (z in b) if (!p[z] || (b[z] && (b[z].t||0) > (p[z].t||0))) p[z] = b[z];
        return p;
      }
      if (k === 'dewb:quizdone') return (String(a) >= String(b)) ? a : b;
      if (k === 'dewb:live'){
        if ((a.week||'') !== (b.week||'')) return (a.week||'') > (b.week||'') ? a : b;
        return ((a.n||0) >= (b.n||0)) ? a : b;
      }
      if (k === 'dewb:days'){
        var d = {}; a.concat(b).forEach(function(t){ d[t]=1; });
        return Object.keys(d).sort().slice(-120);
      }
      if (/^dewb:phrases:/.test(k)){
        var seen = {}, out = [];
        a.concat(b).forEach(function(p){ var key = p && p.en; if (key && !seen[key]){ seen[key]=1; out.push(p); } });
        return out.slice(0, 300);
      }
    }catch(e){}
    return a;                                  /* 그 밖: 이 기기 값 우선 */
  }
  window.DEWB_MERGE = mergeVal;

  /* ───── 학생 폴더 찾기 ───── */
  var NOT_SID = /^(words|weekly|talk|level|let's go.*)$/i;
  function findSid(){
    var s = '';
    try{ s = (new URLSearchParams(location.search).get('s') || ''); }catch(e){}
    if (!s){
      var m = location.pathname.match(/\/dea-m8q3\/([a-z]+-[a-z0-9]{4})\//);
      if (m && !NOT_SID.test(m[1])) s = m[1];
    }
    if (!s && document.referrer){
      try{ var r = new URL(document.referrer);
        if (r.origin === location.origin){
          var m2 = r.pathname.match(/\/dea-m8q3\/([a-z]+-[a-z0-9]{4})\//);
          if (m2) s = m2[1];
          if (!s) s = new URLSearchParams(r.search).get('s') || '';
        } }catch(e){}
    }
    s = String(s).replace(/[^a-z0-9-]/g, '');
    if (s){ try{ rawSet.call(LS, 'dewb:sid', s); }catch(e){} }
    else { try{ s = LS.getItem('dewb:sid') || ''; }catch(e){} }
    return s;
  }
  var SID = LS ? findSid() : '';

  function parse(v){ if (v == null) return null; try{ return JSON.parse(v); }catch(e){ return v; } }
  function str(v){ return typeof v === 'string' ? v : JSON.stringify(v); }
  function localAll(){
    var o = {};
    for (var i = 0; i < LS.length; i++){
      var k = LS.key(i);
      if (k && k.indexOf('dewb:') === 0 && !SKIP.test(k)) o[k] = LS.getItem(k);
    }
    return o;
  }
  function post(body, keep){
    return fetch(API, { method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify(body), keepalive: !!keep })
      .then(function(r){ return r.ok ? r.json() : null; });
  }

  /* ───── 업로드 ───── */
  var dirty = false, lastPush = 0, timer = null, pulled = false;
  function push(keep){
    if (!SID) return;
    if (!pulled){ dirty = true; return; }
    dirty = false; lastPush = Date.now();
    post({ op:'put', sid:SID, data: localAll() }, keep).catch(function(){ dirty = true; });
  }
  function schedule(){
    dirty = true;
    if (timer) return;
    var wait = Math.max(2000, PUSH_GAP - (Date.now() - lastPush));
    timer = setTimeout(function(){ timer = null; if (dirty) push(false); }, wait);
  }
  if (LS){
    Storage.prototype.setItem = function(k, v){
      rawSet.call(this, k, v);
      try{ if (this === LS && typeof k === 'string' && k.indexOf('dewb:') === 0 && !SKIP.test(k)) schedule(); }catch(e){}
    };
  }
  function flush(){ if (dirty){ if (timer){ clearTimeout(timer); timer = null; } push(true); } }
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  /* ───── 내려받기(복원) ───── */
  var t0 = Date.now();
  var ready = new Promise(function(resolve){
    if (!SID || !LS || !window.fetch){ pulled = true; return resolve(false); }
    var done = false;
    var guard = setTimeout(function(){ if (!done){ done = true; resolve(false); } }, 3500);
    post({ op:'get', sid:SID }).then(function(res){
      var server = (res && res.data) || {}, changed = false, needPush = false;
      var keys = {}, k;
      for (k in server) keys[k] = 1;
      var local = localAll();
      for (k in local) keys[k] = 1;
      for (k in keys){
        if (SKIP.test(k)) continue;
        var lv = parse(local[k]), sv = parse(server[k]);
        var mv = mergeVal(k, lv, sv), ms = str(mv);
        if (ms !== local[k]){ try{ rawSet.call(LS, k, ms); changed = true; }catch(e){} }
        if (ms !== server[k]) needPush = true;
      }
      pulled = true;
      if (needPush || dirty) schedule();
      if (!done){ done = true; clearTimeout(guard); resolve(changed); }
      /* 서버에서 기록을 되살렸으면, 막 연 화면은 한 번 새로 고쳐서 반영 */
      if (changed && Date.now() - t0 < 6000){
        try{
          var flag = 'dewb:sync-reloaded:' + location.pathname + location.search;
          if (!sessionStorage.getItem(flag)){ sessionStorage.setItem(flag, '1'); location.reload(); }
        }catch(e){}
      }
    }).catch(function(){ pulled = true; if (!done){ done = true; clearTimeout(guard); resolve(false); } });
  });

  window.DEWBSync = { sid: SID, ready: ready, push: function(){ push(false); } };
})();
