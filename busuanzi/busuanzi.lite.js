!function(){let e=["site_pv","site_uv","page_pv","page_uv"],t="busuanzi",n="bsz-id";(()=>{let a=new XMLHttpRequest;a.open("POST","https://bsz.dusays.com:9001/api",!0);let s=localStorage.getItem(n);null!=s&&a.setRequestHeader("Authorization","Bearer "+s),a.setRequestHeader("x-bsz-referer",window.location.href),a.onreadystatechange=function(){if(4===a.readyState&&200===a.status){let s=JSON.parse(a.responseText);if(!0===s.success){e.map((e=>{let n=document.getElementById(`${t}_${e}`);null!=n&&(n.innerHTML=s.data[e]);let a=document.getElementById(`${t}_container_${e}`);null!=a&&(a.style.display="inline")}));let l=a.getResponseHeader("Set-Bsz-Identity");null!=l&&""!=l&&localStorage.setItem(n,l)}}},a.send()})()}();