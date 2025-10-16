# app.py — TÜRKEŞ ARAMA MOTORU (tam paket)
from flask import Flask, request, jsonify, render_template_string
import requests

app = Flask(__name__)

# --- SENİN API BİLGİLERİN ---
API_KEY = "AIzaSyBViI5Hg11_OnBy2vG3qvMecweJYKkcbIg"
CX = "f61209cd30d184ef3"
# ------------------------------------------------

def search_online(query, search_type='', start=1, num=10):
    if not query:
        return []
    url = "https://www.googleapis.com/customsearch/v1"
    params = {"q": query + " site:tr", "key": API_KEY, "cx": CX, "start": start, "num": num}
    if search_type in ['image', 'news', 'video']:
        params["searchType"] = search_type
    try:
        r = requests.get(url, params=params, timeout=8)
        if r.status_code != 200:
            return []
        data = r.json()
        items = data.get("items", [])
        results = []
        for item in items:
            results.append({
                "title": item.get("title"),
                "url": item.get("link"),
                "content": item.get("snippet", ""),
                "favicon": f"https://www.google.com/s2/favicons?domain={item.get('displayLink','')}",
                "thumbnail": item.get("pagemap", {}).get("cse_image", [{}])[0].get("src", ""),
                "displayLink": item.get("displayLink","")
            })
        return results
    except:
        return []

def fetch_suggestions(q):
    try:
        url = "https://suggestqueries.google.com/complete/search"
        params = {"client": "firefox", "q": q}
        r = requests.get(url, params=params, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return data[1][:10]
    except:
        pass
    return []

@app.route('/api/search')
def api_search():
    q = request.args.get('q','').strip()
    typ = request.args.get('type','')
    try: start = int(request.args.get('start', '1'))
    except: start = 1
    results = search_online(q, typ, start=start, num=10)
    return jsonify({"results": results})

@app.route('/api/suggest')
def api_suggest():
    q = request.args.get('q','').strip()
    s = fetch_suggestions(q) if q else []
    return jsonify({"s": s})

html_page = r"""
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TÜRKEŞ ARAMA MOTORU</title>
<style>
:root{
  --bg:#0f1220; --card:#161827; --muted:#9aa0b4; --accent:#4ea1f3; --neon:#7b6bff;
}
*{box-sizing:border-box}
body{margin:0;font-family:Inter, "Segoe UI", Roboto, Arial; background:var(--bg); color:#e6eef8; -webkit-font-smoothing:antialiased;}
.loader-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#05060a,#0b0d14);z-index:9999;}
#logoAnim{opacity:0; transform:translateY(-20px); text-align:center;}
#logoAnim div:first-child{font-size:64px;font-weight:bold;color:#7b6bff;}
#logoAnim div:last-child{color:#fff;font-size:24px;margin-top:8px;}
.container{max-width:1100px;margin:40px auto;padding:20px; display:flex; flex-direction:column; align-items:center;}
.search-wrap{position:relative; display:flex; align-items:center; max-width:600px; width:100%;}
.search-input{flex:1;padding:12px 48px 12px 12px;border-radius:999px;border:none;font-size:16px;}
.search-btn, #microBtn{position:absolute;right:8px; background:none;border:none;color:var(--muted); font-size:18px; cursor:pointer;}
#microBtn{right:40px;}
.results-wrap{width:100%; margin-top:20px; display:flex; flex-direction:column; gap:12px; align-items:center;}
.card{width:100%;background:var(--card);border-radius:12px;padding:12px;display:flex;gap:12px;align-items:flex-start;}
.card img{width:130px;height:84px;object-fit:cover;border-radius:8px;}
.info{flex:1;}
.title{color:var(--accent);text-decoration:none;}
.snippet{color:var(--muted);margin-top:6px;font-size:14px;}
.meta{margin-top:6px;color:#9aa0b4;font-size:12px;display:flex;gap:10px;align-items:center;}
.star{cursor:pointer;border:none;background:none;color:var(--muted);font-size:18px;}
</style>
</head>
<body>
<div class="loader-wrap" id="loader">
  <div id="logoAnim">
    <div>T</div>
    <div>TÜRKEŞ ARAMA MOTORU</div>
  </div>
</div>

<div class="container" id="app">
  <div class="search-wrap">
    <input id="mainQuery" class="search-input" placeholder="Bir şeyler ara..."/>
    <button id="microBtn">🎤</button>
    <button id="searchBtn">🔍</button>
  </div>
  <div class="results-wrap" id="resultsWrap">
    <div style="color:var(--muted);text-align:center;">Arama yaparak sonuçları gör.</div>
  </div>
</div>

<script>
const resultsWrap = document.getElementById('resultsWrap');
let page=0, q='', loading=false, noMore=false;

// Loader anim
window.addEventListener('load', ()=>{
  const loader = document.getElementById('loader');
  const logo = document.getElementById('logoAnim');
  logo.style.transition='all 1s ease';
  logo.style.opacity='1';
  logo.style.transform='translateY(0)';
  setTimeout(()=>{loader.style.transition='opacity 0.7s ease'; loader.style.opacity=0; setTimeout(()=>loader.remove(),700);},1500);
});

// Arama
async function fetchResults(q, start){
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&start=${start}`);
  const data = await res.json();
  return data.results || [];
}
function renderResults(items){
  for(const r of items){
    const c = document.createElement('div'); c.className='card';
    const img = document.createElement('img'); img.src=r.thumbnail||r.favicon||'';
    const info = document.createElement('div'); info.className='info';
    const a = document.createElement('a'); a.href=r.url; a.target='_blank'; a.className='title'; a.innerText=r.title||r.url;
    const s = document.createElement('div'); s.className='snippet'; s.innerText=r.content||'';
    info.appendChild(a); info.appendChild(s);
    c.appendChild(img); c.appendChild(info);
    resultsWrap.appendChild(c);
  }
}
async function doSearch(reset=false){
  if(!q || loading || noMore) return;
  loading=true;
  const start=page*10+1;
  const res=await fetchResults(q,start);
  loading=false;
  if(res.length<1){ noMore=true; if(reset){ resultsWrap.innerHTML='<div style="color:var(--muted);text-align:center;">Sonuç yok</div>'; } return;}
  if(reset){ resultsWrap.innerHTML=''; page=0; noMore=false;}
  // Yeni sonuçları aşağıya ekle
  renderResults(res);
  page++;
}

document.getElementById('searchBtn').addEventListener('click', ()=>{
  q=document.getElementById('mainQuery').value.trim();
  page=0; noMore=false;
  doSearch(true);
});
document.getElementById('mainQuery').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); q=document.getElementById('mainQuery').value.trim(); page=0; noMore=false; doSearch(true); }});

// Infinite scroll
window.addEventListener('scroll', ()=>{
  if((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 140){
    doSearch();
  }
});

// Sesli arama
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Rec();
  recognition.lang='tr-TR'; recognition.interimResults=false; recognition.maxAlternatives=1;
  const btn=document.getElementById('microBtn');
  btn.addEventListener('click', ()=>{ recognition.start(); btn.innerText='🎙️'; });
  recognition.onresult=(ev)=>{ document.getElementById('mainQuery').value=ev.results[0][0].transcript; btn.innerText='🎤'; q=document.getElementById('mainQuery').value.trim(); page=0; noMore=false; doSearch(true);}
  recognition.onerror=()=>{btn.innerText='🎤';};
}
</script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(html_page)

if __name__=="__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)
