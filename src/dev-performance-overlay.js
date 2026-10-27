/* Development-only diagnostics; activated by index.dev.html?perf=1.
 * Never included in release pages and never reads or changes save data.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const root = document.createElement('aside');
  root.id = 'dcDevPerf';
  root.setAttribute('aria-label', '개발용 성능 측정');
  root.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483000;background:#081826ee;color:#eafff5;border:1px solid #59aabd;border-radius:10px;padding:10px 12px;min-width:172px;font:12px/1.55 monospace;box-shadow:0 5px 22px #0008;pointer-events:auto';
  const head = document.createElement('div');
  head.textContent = '성능 측정 · 개발용';
  head.style.cssText = 'font-weight:bold;margin-bottom:4px;color:#a5ffe3';
  const stats = document.createElement('pre');
  stats.id = 'dcDevPerfStats';
  stats.style.cssText = 'margin:0;white-space:pre-line;font:inherit';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기';
  close.style.cssText = 'margin-top:7px;font:inherit;cursor:pointer;background:#2b4b5c;color:white;border:1px solid #678c9a;border-radius:5px;padding:2px 10px';
  root.append(head, stats, close);
  document.body.appendChild(root);

  let frames = 0, last = performance.now(), fps = 0, maxGap = 0, lastFrame = 0, rafId = 0, longTasks = 0, stopped = false;
  let observer = null;
  try {
    observer = new PerformanceObserver(list => { longTasks += list.getEntries().length; });
    observer.observe({ entryTypes: ['longtask'] });
  } catch { /* Long Task API unsupported */ }

  function countImages() {
    let count = 0, bytes = 0;
    for (const item of performance.getEntriesByType('resource')) {
      if (!/\.(?:gif|png|jpe?g|webp)(?:$|[?#])/i.test(item.name) && item.initiatorType !== 'img') continue;
      count++;
      bytes += item.transferSize || 0;
    }
    return { count, bytes };
  }
  function tick(now) {
    if (stopped) return;
    frames++;
    if (lastFrame) maxGap = Math.max(maxGap, now - lastFrame);
    lastFrame = now;
    if (now - last >= 2000) {
      fps = Math.round(frames * 1000 / (now - last));
      const resources = countImages();
      const heap = performance.memory?.usedJSHeapSize;
      stats.textContent = [
        '화면 FPS: ' + fps,
        '최대 프레임 간격: ' + Math.round(maxGap) + 'ms',
        'Long tasks: ' + longTasks,
        '이미지 요청: ' + resources.count,
        '전송량(확인 가능): ' + (resources.bytes / 1024 / 1024).toFixed(1) + 'MB',
        'JS 힙: ' + (typeof heap === 'number' ? (heap / 1024 / 1024).toFixed(1) + 'MB' : '지원 안 됨')
      ].join('\n');
      last = now; frames = 0; maxGap = 0;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  close.addEventListener('click', () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    observer?.disconnect();
    root.remove();
  });
})();
