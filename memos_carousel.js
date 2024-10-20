var bbCarouselMemo = {
    api: 'https://demo.usememos.com/api/memo?creatorId=1&tag=说说&limit=10',
    image_icon: '<i class="fa-solid fa-image"></i>',
    link_icon: '<i class="fa-solid fa-link"></i>',
}
if (typeof (bbCarouselMemos) !== 'undefined') {
    for (var key in bbCarouselMemos) {
        if (bbCarouselMemos[key]) {
            bbCarouselMemo[key] = bbCarouselMemos[key];
        }
    }
}
/// 存数据
function saveData(name, data) {
    localStorage.setItem(name, JSON.stringify({
        'time': Date.now(),
        'data': data
    }))
};
// 取数据
function loadData(name, time) {
    let d = JSON.parse(localStorage.getItem(name));
    // 过期或有错误返回 0 否则返回数据
    if (d) {
        let t = Date.now() - d.time
        if (-1 < t && t < (time * 60000)) return d.data;
    }
    return 0;
};

let talkTimer = null;

function indexTalk() {
    if (talkTimer) {
        clearInterval(talkTimer)
        talkTimer = null;
    }
    if (!document.getElementsByClassName('bber-talk')) return

    function toText(ls) {
        let text = []
        ls.forEach(item => {
            text.push(item.content.replace(/#(.*?)\s/g, '').replace(/\{(.*?)\}/g, '').replace(/\!\[(.*?)\]\((.*?)\)/g, bbCarouselMemo.image_icon).replace(/\[(.*?)\]\((.*?)\)/g, bbCarouselMemo.link_icon))
        });
        return text
    }

    function talk(ls) {
        let html = ''
        ls.forEach((item, i) => {
            html += `<li class="item item-${i + 1}">${item}</li>`
        });
        let box = document.querySelector(".bber-talk .talk-list")
        box.innerHTML = html;
        talkTimer = setInterval(() => {
            box.appendChild(box.children[0]);
        }, 3000);
    }

    let d = loadData('talk', 10);
    if (d) talk(d);
    else {
        fetch(bbCarouselMemo.api).then(res => res.json()).then(data => { // 更改地址
            data = toText(data['memos'])
            talk(data);
            saveData('talk', data);
        })
    }
}
indexTalk();