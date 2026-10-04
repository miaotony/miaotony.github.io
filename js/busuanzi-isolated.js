/* Optional statistics must never hold up the page load event. */
(function () {
    'use strict';
    var names = ['site_pv', 'site_uv', 'page_pv'];
    if (window.__busuanziIsolatedStarted) return;
    window.__busuanziIsolatedStarted = true;
    function fallback(message) {
        names.forEach(function (name) {
            var value = document.getElementById('busuanzi_value_' + name);
            if (value) { value.textContent = '—'; value.title = message; }
        });
    }
    fallback('访问统计稍后加载');
    function start() {
        var frame = document.createElement('iframe');
        frame.hidden = true;
        frame.title = '访问统计';
        frame.setAttribute('aria-hidden', 'true');
        // Separate browsing context for request cancellation; keep the inherited
        // page referrer so the provider attributes counts to the original site.
        // This is lifecycle isolation, not a security boundary for third-party code.
        var token = 'bsz-' + Math.random().toString(36).slice(2);
        var finished = false;
        function finish(data) {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            window.removeEventListener('message', receive);
            // Destroying the isolated browsing context also stops its pending requests.
            frame.remove();
            fallback('访问统计暂不可用');
            if (!data || typeof data !== 'object') return;
            names.forEach(function (name) {
                var value = document.getElementById('busuanzi_value_' + name);
                var number = data[name];
                if (value && (typeof number === 'number' || typeof number === 'string') && /^\d+$/.test(String(number))) {
                    value.textContent = String(number);
                    value.removeAttribute('title');
                }
            });
        }
        function receive(event) {
            if (event.source !== frame.contentWindow || !event.data || event.data.token !== token) return;
            finish(event.data.counts);
        }
        window.addEventListener('message', receive);
        var timeout = setTimeout(function () { finish(null); }, 5000);
        // Parent accepts results only from this exact frame and request token.
        // Frame-local callback/variables cannot accidentally overwrite page globals.
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><script>' +
            'var token=' + JSON.stringify(token) + ';' +
            'window.BusuanziCallback=function(data){parent.postMessage({token:token,counts:data},"*")};' +
            'var s=document.createElement("script");s.src="https://busuanzi.ibruce.info/busuanzi?jsonpCallback=BusuanziCallback&_="+encodeURIComponent(token);' +
            's.onerror=function(){parent.postMessage({token:token,counts:null},"*")};document.head.appendChild(s);' +
            '<\/script>';
        document.body.appendChild(frame);
        window.addEventListener('pagehide', function () { finish(null); }, { once: true });
    }
    // A new task after load: statistics cannot delay the original page's load event.
    if (document.readyState === 'complete') setTimeout(start, 0);
    else window.addEventListener('load', function () { setTimeout(start, 0); }, { once: true });
}());
