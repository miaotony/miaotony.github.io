/* Search index is fetched only when the search UI is opened. */
(function () {
    'use strict';
    var modal = document.getElementById('searchModal');
    var input = document.getElementById('searchInput');
    var result = document.getElementById('searchResult');
    if (!modal || !input || !result) return;
    var entries = null, pending = null, timer = null;

    function status(text, retry, kind) {
        kind = kind || (retry ? 'error' : 'loading');
        result.textContent = '';
        var card = document.createElement('div');
        card.className = 'search-state search-state--' + kind;
        var icon = document.createElement('span');
        icon.className = 'search-state-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = kind === 'loading' ? '' : (kind === 'error' ? '!' : '✓');
        var copy = document.createElement('div');
        copy.className = 'search-state-copy';
        var title = document.createElement('strong');
        title.textContent = text;
        var detail = document.createElement('p');
        detail.textContent = kind === 'loading' ? '首次搜索需要下载索引，可以先输入关键词。' :
            (kind === 'error' ? '可能是网络暂时不稳定，关键词已保留。' : '输入关键词，查找文章标题和正文。');
        copy.appendChild(title);
        copy.appendChild(detail);
        card.appendChild(icon);
        card.appendChild(copy);
        if (retry) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-state-retry';
            button.textContent = '重新加载';
            button.addEventListener('click', loadIndex);
            card.appendChild(button);
        }
        result.appendChild(card);
    }
    function highlight(text, keywords) {
        var span = document.createElement('span');
        var pattern = keywords.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
        var re = new RegExp(pattern, 'gi'), match, last = 0;
        while ((match = re.exec(text))) {
            span.appendChild(document.createTextNode(text.slice(last, match.index)));
            var em = document.createElement('em');
            em.className = 'search-keyword';
            em.textContent = match[0];
            span.appendChild(em);
            last = re.lastIndex;
        }
        span.appendChild(document.createTextNode(text.slice(last)));
        return span;
    }
    function render() {
        if (!entries) return;
        var query = input.value.trim().toLowerCase();
        result.textContent = '';
        if (!query) { status('搜索已就绪', false, 'ready'); return; }
        var keywords = query.split(/[\s\-]+/).filter(Boolean);
        if (!keywords.length) return;
        var list = document.createElement('ul');
        list.className = 'search-result-list';
        var count = 0;
        entries.forEach(function (entry) {
            if (!keywords.every(function (k) { return entry.titleLower.indexOf(k) >= 0 || entry.lower.indexOf(k) >= 0; })) return;
            var li = document.createElement('li'), a = document.createElement('a');
            a.className = 'search-result-title';
            a.href = entry.url;
            a.textContent = (++count) + '. ' + entry.title;
            li.appendChild(a);
            var first = entry.lower.indexOf(keywords[0]);
            var start = Math.max(0, first - 30);
            var p = document.createElement('p');
            p.className = 'search-result';
            p.appendChild(highlight(entry.content.slice(start, start + 300), keywords));
            p.appendChild(document.createTextNode('…'));
            li.appendChild(p);
            list.appendChild(li);
        });
        var summary = document.createElement('p');
        summary.className = 'search-result-summary';
        summary.textContent = '共找到 ' + count + ' 条结果';
        result.appendChild(summary);
        result.appendChild(list);
    }
    function loadIndex() {
        if (entries) { render(); return Promise.resolve(entries); }
        if (pending) return pending;
        status('正在加载搜索索引…');
        result.setAttribute('aria-busy', 'true');
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 30000);
        pending = fetch(modal.getAttribute('data-index-url'), { signal: controller.signal })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function (text) {
                var xml = new DOMParser().parseFromString(text, 'application/xml');
                if (xml.querySelector('parsererror')) throw new Error('Invalid search XML');
                entries = Array.from(xml.querySelectorAll('entry')).map(function (node) {
                    function value(tag) { var n = node.querySelector(tag); return n ? n.textContent.trim() : ''; }
                    var title = value('title');
                    var content = value('content').replace(/<[^>]+>/g, '');
                    var url = value('url');
                    // Preserve absolute HTTP links; resolve relative paths from the site root.
                    if (!/^(https?:\/\/|\/)/i.test(url)) url = '/' + url;
                    if (!/^(https?:\/\/|\/)/i.test(url)) url = '#';
                    return { title: title, titleLower: title.toLowerCase(), content: content, lower: content.toLowerCase(), url: url };
                });
                render(); // Includes text entered while the request was pending.
                return entries;
            })
            .catch(function () { status('搜索索引加载失败，请重试。', true); })
            .finally(function () {
                clearTimeout(timeout);
                pending = null;
                result.setAttribute('aria-busy', 'false');
            });
        return pending;
    }
    document.addEventListener('click', function (event) {
        if (event.target.closest('a[href="#searchModal"], [data-target="searchModal"]')) loadIndex();
    }, true);
    input.addEventListener('focus', loadIndex);
    input.addEventListener('input', function () {
        clearTimeout(timer);
        if (!entries) { loadIndex(); return; }
        timer = setTimeout(render, 150);
    });
    new MutationObserver(function () {
        if (modal.classList.contains('open')) loadIndex();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
}());
