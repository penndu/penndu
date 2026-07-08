/*
* memos.top - Memos 0.29.1 (frontend)
*
* 通过 Memos 0.29.1 API 渲染静态时间线。纯原生 JS，无构建。
* 参考：https://usememos.com/docs/api/latest
*
* 必填配置：
*   host       Memos 实例 URL（末尾无 /）
*   username   Memos 用户名（用于 GetUser / GetUserStats / filter 中的 users/{username}）
* 可选配置：
*   limit      每页条数（默认 10）
*   domId      容器选择器（默认 #memos）
*   name       自定义显示名（默认与 username 相同）
*   language   相对时间语言（en / zh-CN）
*   accessToken  Bearer token，仅在需要拉非公开 memo 时填
*   doubanAPI  豆瓣条目渲染 API（同原项目）
*/

// ===== 配置 =====
var memo = {
    host: 'https://demo.usememos.com/',
    limit: '10',
    username: 'demo',
    domId: '#memos',
    username_display: '',
    name: '',
    APIVersion: 'new',
    language: 'en',
    accessToken: '',
    total: true,
    doubanAPI: '',
};

// 兼容旧版 index.html 里的 memos 全局变量
if (typeof memos !== 'undefined') {
    for (var key in memos) {
        if (memos[key]) memo[key] = memos[key];
    }
}

// 旧字段兼容：creatorId → username
if (memo.creatorId && !memo.username) {
    console.warn('[memos.top] 字段 creatorId 已被移除，请改用 username（Memos 登录用户名）。已尝试回退：');
    console.warn('  旧值 creatorId=' + memo.creatorId + ' 不再适用于 0.29.1，请到 Memos 用户资料页查看 username 并写入 username 配置。');
}

// 规范化
var limit = parseInt(memo.limit, 10) || 10;
var HOST = memo.host.replace(/\/+$/, '');
var USERNAME = memo.username;
// 兼容老字段 username (id 显示名) → name
if (!memo.name) memo.name = memo.username_display || USERNAME;

var apiHeaders = { 'Accept': 'application/json' };
if (memo.accessToken) apiHeaders['Authorization'] = 'Bearer ' + memo.accessToken;

function apiUrl(path, query) {
    var q = query ? '?' + query : '';
    return HOST + path + q;
}

function apiFetch(url) {
    return fetch(url, { headers: apiHeaders }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.json();
    });
}

// ===== 全局状态 =====
var page = 1;
var nextLength = 0;
var nextDom = '';
var tag = '';
var nextPageToken = '';
var btnRemove = 0;
var memoDom = document.querySelector(memo.domId);
var totalEl = document.getElementById('total');
var LOAD_BTN_HTML = '<button class="load-btn button-load">努力加载中……</button>';

// ===== 用户信息（头像 / total） =====
function loadUserInfo() {
    if (!USERNAME) return;
    // GetUser：拿 displayName + avatarUrl
    apiFetch(apiUrl('/api/v1/users/' + encodeURIComponent(USERNAME)))
        .then(function (user) {
            if (user && user.displayName) memo.name = user.displayName;
            if (user && user.avatarUrl) {
                document.documentElement.style.setProperty('--avatar-url', 'url("' + user.avatarUrl + '")');
            }
        })
        .catch(function (err) { console.warn('[memos.top] GetUser failed:', err); });

    // GetUserStats：拿 totalMemoCount
    if (memo.total && totalEl) {
        apiFetch(apiUrl('/api/v1/' + encodeURIComponent('users/' + USERNAME) + ':getStats'))
            .then(function (stats) {
                if (stats && typeof stats.totalMemoCount === 'number') {
                    totalEl.textContent = stats.totalMemoCount;
                }
            })
            .catch(function (err) {
                console.warn('[memos.top] GetUserStats failed (need token?):', err);
            });
    }
}

// ===== Memo 列表 =====
function buildListUrl(tagFilter) {
    // CEL filter：creator + visibility + 可选 tag
    var parts = [
        "creator=='users/" + USERNAME + "'",
        "visibility=='PUBLIC'"
    ];
    if (tagFilter) {
        // 转义单引号
        var t = tagFilter.replace(/'/g, "\\'");
        parts.push("tags.exists(t, t == '" + t + "')");
    }
    var filter = parts.join(' && ');
    var qs = [
        'pageSize=' + limit,
        'filter=' + encodeURIComponent(filter)
    ].join('&');
    return apiUrl('/api/v1/memos', qs);
}

// ===== 首次加载 =====
function getFirstList() {
    apiFetch(buildListUrl(tag)).then(function (res) {
        var list = res.memos || [];
        updateHTMl(list);
        nextPageToken = res.nextPageToken || '';
        if (list.length < limit) {
            removeLoadBtn();
            return;
        }
        page++;
        getNextList();
    }).catch(function (err) {
        console.error('[memos.top] ListMemos failed:', err);
    });
}

// ===== 预加载下一页 =====
function getNextList() {
    if (!nextPageToken) {
        removeLoadBtn();
        return;
    }
    var parts = [
        "creator=='users/" + USERNAME + "'",
        "visibility=='PUBLIC'"
    ];
    if (tag) {
        var t = tag.replace(/'/g, "\\'");
        parts.push("tags.exists(t, t == '" + t + "')");
    }
    var filter = parts.join(' && ');
    var qs = [
        'pageSize=' + limit,
        'pageToken=' + encodeURIComponent(nextPageToken),
        'filter=' + encodeURIComponent(filter)
    ].join('&');
    apiFetch(apiUrl('/api/v1/memos', qs)).then(function (res) {
        nextDom = res.memos || [];
        nextLength = nextDom.length;
        nextPageToken = res.nextPageToken || '';
        page++;
        if (nextLength < 1) removeLoadBtn();
    }).catch(function (err) {
        console.error('[memos.top] ListMemos (next) failed:', err);
    });
}

// ===== 标签切换 =====
function reloadByTag(newTag) {
    tag = newTag || '';
    if (!btnRemove) {
        // load btn 已被移除，需重建
        memoDom.insertAdjacentHTML('afterend', LOAD_BTN_HTML);
        var btn = document.querySelector('button.button-load');
        btn.addEventListener('click', function () {
            btn.textContent = '努力加载中……';
            updateHTMl(nextDom);
            if (nextLength < limit) { removeLoadBtn(); return; }
            getNextList();
        });
        btnRemove = 0;
    }
    // 清空现有 memo 列表
    memoDom.innerHTML = '';
    // 重置分页
    page = 1;
    nextPageToken = '';
    getFirstList();
}

// 标签点击监听（沿用原项目的设计：click 标签 a[href^="#"]）
document.addEventListener('click', function (event) {
    var target = event.target;
    if (target.tagName.toLowerCase() === 'a' && target.getAttribute('href') && target.getAttribute('href').startsWith('#')) {
        event.preventDefault();
        var newTag = target.getAttribute('href').substring(1);
        if (newTag === tag) return; // 没变就不重载
        reloadByTag(newTag);
        var filterElem = document.getElementById('tag-filter');
        if (filterElem) filterElem.classList.add('active');
    }
});

function removeLoadBtn() {
    var b = document.querySelector('button.button-load');
    if (b) b.remove();
    btnRemove = 1;
}

// ===== 渲染 =====
function updateHTMl(data) {
    var memoResult = '';
    for (var i = 0; i < data.length; i++) {
        var memoContREG = '';

        // 内容（Markdown）
        var content = data[i].content || '';

        // 保护围栏代码块（先做！避免后面行内代码匹配破坏它）
        var savedFences = [];
        content = content.replace(/```([\s\S]*?)```/g, function (m, c) {
            savedFences.push(c);
            return '\u0091FENCE' + (savedFences.length - 1) + '\u0091';
        });

        // 保护行内代码
        var savedInlineCode = [];
        content = content.replace(/`([^`\n]+)`/g, function (m, c) {
            savedInlineCode.push(c);
            return '\u0091IC' + (savedInlineCode.length - 1) + '\u0091';
        });

        // 保护块级数学公式
        var savedBlockMath = [];
        content = content.replace(/\$\$([\s\S]+?)\$\$/g, function (m, c) {
            savedBlockMath.push(c);
            return '\u0091BM' + (savedBlockMath.length - 1) + '\u0091';
        });

        // 保护行内数学公式
        var savedInlineMath = [];
        content = content.replace(/\$([^$\n]+?)\$/g, function (m, c) {
            savedInlineMath.push(c);
            return '\u0091IM' + (savedInlineMath.length - 1) + '\u0091';
        });

        // 处理附件
        var attachments = data[i].attachments || [];
        var imgUrl = '';
        var resUrl = '';
        for (var j = 0; j < attachments.length; j++) {
            var att = attachments[j];
            var attType = att.type || '';
            var attFilename = att.filename || att.name || 'file';
            var attLink = '';

            if (att.externalLink) {
                attLink = att.externalLink;
            } else if (att.content) {
                // 0.29.1: attachment.content 是 base64（不含 data: 前缀）
                if (attType.startsWith('image/')) {
                    attLink = 'data:' + attType + ';base64,' + att.content;
                } else {
                    // 其它文件：可走下载 endpoint
                    attLink = apiUrl('/api/v1/' + (att.name || ''));
                }
            }

            if (attType.startsWith('image/') && attLink) {
                imgUrl += '<div class="resimg"><img loading="lazy" src="' + attLink + '" alt="' + escapeHtml(attFilename) + '"/></div>';
            } else if (attLink) {
                resUrl += '<a target="_blank" rel="noreferrer" href="' + attLink + '">' + escapeHtml(attFilename) + '</a>';
            }
        }
        if (imgUrl) memoContREG += '<div class="resource-wrapper "><div class="images-wrapper">' + imgUrl + '</div></div>';
        if (resUrl) memoContREG += '<div class="resource-wrapper "><p class="datasource">' + resUrl + '</p></div>';

        // marked 渲染
        if (typeof marked !== 'undefined') {
            memoContREG += marked.parse(content);
        } else {
            memoContREG += '<p>' + escapeHtml(content) + '</p>';
        }

        // 还原围栏代码块
        memoContREG = memoContREG.replace(/\u0091FENCE(\d+)\u0091/g, function (m, idx) {
            return '<pre><code>' + escapeHtml(savedFences[+idx]) + '</code></pre>';
        });
        // 还原行内代码
        memoContREG = memoContREG.replace(/\u0091IC(\d+)\u0091/g, function (m, idx) {
            return '<code>' + escapeHtml(savedInlineCode[+idx]) + '</code>';
        });
        // 还原块级数学公式
        memoContREG = memoContREG.replace(/\u0091BM(\d+)\u0091/g, function (m, idx) {
            return '<p class="math-block">' + escapeHtml(savedBlockMath[+idx]) + '</p>';
        });
        // 还原行内数学公式
        memoContREG = memoContREG.replace(/\u0091IM(\d+)\u0091/g, function (m, idx) {
            return '<span class="math-inline">' + escapeHtml(savedInlineMath[+idx]) + '</span>';
        });

        // 时间 + 头像（用 --avatar-url CSS 变量）
        var relativeTime = getRelativeTime(new Date(data[i].createTime));
        memoResult += ''
            + '<li class="timeline">'
            +   '<div class="memos__content">'
            +     '<div class="memos__text">'
            +       '<div class="memos__userinfo">'
            +         '<div>' + escapeHtml(memo.name) + '</div>'
            +         '<div>'
            +           '<svg viewBox="0 0 24 24" aria-label="认证账号" class="memos__verify">'
            +             '<g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></g>'
            +           '</svg>'
            +         '</div>'
            +         '<div class="memos__info"><div class="memos__time">' + relativeTime + '</div></div>'
            +       '</div>'
            +       '<div class="memos__content-inner">' + memoContREG + '</div>'
            +     '</div>'
            +   '</div>'
            + '</li>';
    }
    memoDom.insertAdjacentHTML('beforeend', memoResult);
    if (typeof ViewImages !== 'undefined') ViewImages();
}

// ===== 工具函数 =====
function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRelativeTime(date) {
    var diffMs = Date.now() - date.getTime();
    var diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return memo.language === 'zh-CN' ? '刚刚' : 'just now';
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return memo.language === 'zh-CN' ? diffMin + ' 分钟前' : diffMin + ' minutes ago';
    var diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return memo.language === 'zh-CN' ? diffHour + ' 小时前' : diffHour + ' hours ago';
    var diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return memo.language === 'zh-CN' ? diffDay + ' 天前' : diffDay + ' days ago';
    var diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return memo.language === 'zh-CN' ? diffMonth + ' 个月前' : diffMonth + ' months ago';
    var diffYear = Math.floor(diffMonth / 12);
    return memo.language === 'zh-CN' ? diffYear + ' 年前' : diffYear + ' years ago';
}

// ===== 启动 =====
if (memoDom) {
    memoDom.insertAdjacentHTML('afterend', LOAD_BTN_HTML);
    getFirstList();
    loadUserInfo();

    var btn = document.querySelector('button.button-load');
    btn.addEventListener('click', function () {
        btn.textContent = '努力加载中……';
        updateHTMl(nextDom);
        if (nextLength < limit) { removeLoadBtn(); return; }
        getNextList();
    });
}

// 暴露给 custom.js（tag 渲染、主题等扩展）
window.MemoApp = {
    reload: function () { reloadByTag(tag); },
    config: memo,
};