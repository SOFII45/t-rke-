document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const queryEl = (selector) => document.querySelector(selector);
    
    const resultsWrap = getEl('resultsWrap');
    const loadingSpinner = getEl('loadingSpinner');
    const resultStatsDiv = getEl('resultStats');
    const errorMessageDiv = getEl('errorMessage');
    const spellingSuggestionDiv = getEl('spellingSuggestion');
    const container = getEl('app');
    const mainQueryInput = getEl('mainQuery');
    const suggestionsBox = getEl('suggestions-box');
    
    const initialTitle = document.title;
    let page = 0, currentQuery = '', loading = false, noMoreResults = false;
    let currentSearchType = '';
    let debounceTimer;

    const settings = {
        safeSearch: localStorage.getItem('safeSearch') === 'true' || false,
        theme: localStorage.getItem('theme') || 'dark'
    };
    
    function toggleLayout(isSearch) {
        container.classList.toggle('home-layout', !isSearch);
        container.classList.toggle('search-layout', isSearch);
    }

    function updateHistory(query, type) {
        let newPath = query ? `/?q=${encodeURIComponent(query)}` : '/';
        if (type && type !== 'web') newPath += `&type=${type}`; // "web" türünü URL'ye eklemeyelim
        const newTitle = query ? `${query} - ${initialTitle}` : initialTitle;
        document.title = newTitle;
        window.history.pushState({ q: query, type: type }, newTitle, newPath);
    }
    
    async function fetchResults(query, start, type, safe) {
        const params = new URLSearchParams({ q: query, start, type, safe: safe ? 'active' : 'off' });
        const url = `/api/search?${params.toString()}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Fetch error:", error);
            return { error: "Arama sonuçları alınamadı. Lütfen ağ bağlantınızı kontrol edin." };
        }
    }

    function renderResults(items) {
        // Görsel arama ise grid düzenini aktifleştir, değilse normal düzen
        resultsWrap.classList.toggle('image-grid-layout', currentSearchType === 'image');

        items.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card';
            
            if (currentSearchType === 'image' && r.thumbnail) {
                card.classList.add('image-card');
                card.innerHTML = `
                    <img src="${r.thumbnail}" alt="${r.title}" loading="lazy">
                    <div class="image-info">
                        <span class="title">${r.title}</span>
                    </div>`;
                card.addEventListener('click', () => openLightbox(r.thumbnail, r.title));
            } else if (currentSearchType !== 'image') {
                const favorites = getFromStorage('favorites');
                const isFavorited = favorites.some(fav => fav.url === r.url);
                card.innerHTML = `
                    <div class="info">
                        <a href="${r.url}" target="_blank">
                            <span class="meta"><span>${r.displayLink}</span></span>
                            <h3 class="title">${r.title}</h3>
                        </a>
                        <p class="snippet">${r.content || ''}</p>
                    </div>
                    <button class="fav-star ${isFavorited ? 'favorited' : ''}" title="Favorilere Ekle" data-url="${r.url}" data-title="${r.title}">⭐</button>`;
            } else {
                return; // Görsel aramada thumbnail yoksa veya web sonucuysa gösterme
            }
            resultsWrap.appendChild(card);
        });

        // Favori butonları için event listenerları bir kere ekleyelim
        document.querySelectorAll('.fav-star:not(.listener-added)').forEach(star => {
            star.classList.add('listener-added'); // Tekrar eklenmemesi için
            star.addEventListener('click', (e) => toggleFavorite(e.target));
        });
    }

    async function doSearch(isNewSearch = false) {
        if (!currentQuery || loading || (noMoreResults && !isNewSearch)) return;

        if (isNewSearch) {
            page = 0;
            noMoreResults = false;
            resultsWrap.innerHTML = '';
            errorMessageDiv.style.display = 'none';
            spellingSuggestionDiv.style.display = 'none';
            updateHistory(currentQuery, currentSearchType);
            toggleLayout(true);
            saveToStorage('searchHistory', [currentQuery, ...getFromStorage('searchHistory').filter(q => q !== currentQuery)].slice(0, 10));
        }
        
        loading = true;
        loadingSpinner.style.display = 'block';

        const start = page * 10 + 1;
        const data = await fetchResults(currentQuery, start, currentSearchType, settings.safeSearch);
        
        loading = false;
        loadingSpinner.style.display = 'none';

        if (data.error) {
            errorMessageDiv.innerText = data.error;
            errorMessageDiv.style.display = 'block';
            resultStatsDiv.style.display = 'none';
            return;
        }
        
        // Yazım düzeltmesi önerisi (Sadece yeni aramada ve web sonuçlarında)
        if (isNewSearch && currentSearchType !== 'image' && data.spelling) {
            spellingSuggestionDiv.innerHTML = `Bunu mu demek istediniz: <a data-value="${data.spelling}">${data.spelling}</a>`;
            spellingSuggestionDiv.style.display = 'block';
            spellingSuggestionDiv.querySelector('a').addEventListener('click', (e) => {
                mainQueryInput.value = e.target.dataset.value;
                startNewSearch();
            });
        } else {
            spellingSuggestionDiv.style.display = 'none';
        }

        if (isNewSearch) {
            resultStatsDiv.innerText = data.totalResults && data.totalResults !== "0" ? `Yaklaşık ${Number(data.totalResults).toLocaleString('tr-TR')} sonuç bulundu.` : 'Sonuç bulunamadı.';
        }
        
        if (!data.items || data.items.length === 0) {
            noMoreResults = true;
            if (isNewSearch) {
                resultsWrap.innerHTML = '<div style="color:var(--muted);text-align:center;">Sonuç yok</div>';
            }
            return;
        }

        renderResults(data.items);
        page++;
    }

    const startNewSearch = () => {
        const query = mainQueryInput.value.trim();
        if (query) {
            currentQuery = query;
            doSearch(true);
        }
    };
    
    const getFromStorage = (key, fallback = '[]') => JSON.parse(localStorage.getItem(key) || fallback);
    const saveToStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    async function showSuggestions(query) {
        if (!query) {
            const history = getFromStorage('searchHistory');
            suggestionsBox.innerHTML = history.map(item => `<div class="suggestion-item history" data-value="${item}">🕒 ${item}</div>`).join('');
            suggestionsBox.style.display = history.length > 0 ? 'block' : 'none';
            return;
        }
        
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.s && data.s.length > 0) {
            suggestionsBox.innerHTML = data.s.map(item => `<div class="suggestion-item" data-value="${item}">${item}</div>`).join('');
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    }

    function toggleFavorite(starElement) {
        const url = starElement.dataset.url;
        let favorites = getFromStorage('favorites');
        if (favorites.some(fav => fav.url === url)) {
            favorites = favorites.filter(fav => fav.url !== url);
            starElement.classList.remove('favorited');
        } else {
            favorites.unshift({ url, title: starElement.dataset.title });
            starElement.classList.add('favorited');
        }
        saveToStorage('favorites', favorites);
        displayFavorites(); // Favoriler modalı açıksa güncelle
    }
    
    const displayFavorites = () => {
        const favorites = getFromStorage('favorites');
        getEl('favoritesList').innerHTML = favorites.length === 0 ? 'Favori bulunamadı.' : favorites.map(fav => `<div class="fav-item"><a href="${fav.url}" target="_blank">${fav.title}</a></div>`).join('');
    };

    const applyTheme = (theme) => {
        document.body.classList.toggle('light-theme', theme === 'light');
        getEl('themeToggleBtn').innerHTML = theme === 'light' ? '🌙' : '☀️';
        settings.theme = theme;
        localStorage.setItem('theme', theme);
    };

    const updateSettings = () => {
        settings.safeSearch = getEl('safeSearchToggle').checked;
        localStorage.setItem('safeSearch', settings.safeSearch);
        if (currentQuery) startNewSearch(); // Ayar değiştiğinde aramayı yenile
    };

    function openLightbox(src, caption) {
        const lightbox = getEl('lightbox');
        if (lightbox) {
            getEl('lightboxImg').src = src;
            getEl('lightboxCaption').textContent = caption;
            lightbox.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Sayfanın kaydırılmasını engelle
        }
    }

    function closeLightbox() {
        getEl('lightbox').style.display = 'none';
        document.body.style.overflow = ''; // Sayfa kaydırmayı geri aç
    }

    function setupEventListeners() {
        getEl('searchBtn').addEventListener('click', startNewSearch);
        mainQueryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { suggestionsBox.style.display = 'none'; startNewSearch(); } });
        mainQueryInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => showSuggestions(e.target.value.trim()), 200);
        });
        // mainQueryInput.addEventListener('focus', () => showSuggestions(mainQueryInput.value.trim())); // Bu eklendi
        
        document.addEventListener('click', (e) => {
            if (queryEl('.search-wrap') && !queryEl('.search-wrap').contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });
        suggestionsBox.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                mainQueryInput.value = e.target.dataset.value;
                startNewSearch();
            }
        });
        
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', function() {
                queryEl('.tab-btn.active').classList.remove('active');
                this.classList.add('active');
                currentSearchType = this.getAttribute('data-type') || 'web'; // Boş ise 'web' yap
                if (currentQuery) startNewSearch();
            });
        });
        
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300 && !loading && !noMoreResults) {
                doSearch();
            }
        });
        
        // Top butonlar ve Modallar
        getEl('themeToggleBtn').addEventListener('click', () => applyTheme(settings.theme === 'dark' ? 'light' : 'dark'));
        getEl('settingsBtn').addEventListener('click', () => { getEl('settingsModal').style.display = 'block'; });
        getEl('favoritesBtn').addEventListener('click', () => { displayFavorites(); getEl('favoritesModal').style.display = 'block'; });
        
        // Ayar butonları
        getEl('safeSearchToggle').addEventListener('change', updateSettings);
        getEl('clearHistoryBtn').addEventListener('click', () => { 
            if (confirm('Arama geçmişini silmek istediğinizden emin misiniz?')) { 
                localStorage.removeItem('searchHistory'); 
                alert('Arama geçmişi temizlendi.');
                // Geçmiş temizlendiğinde suggestions box'ı da güncelle
                if (!mainQueryInput.value.trim()) showSuggestions('');
            } 
        });

        // Modal Kapatma
        document.querySelectorAll('.modal').forEach(modal => { 
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; }); 
        });
        document.querySelectorAll('.close-btn').forEach(btn => { 
            btn.addEventListener('click', () => { getEl(btn.dataset.modal).style.display = 'none'; }); 
        });
        
        // Lightbox kapatma
        const lightboxClose = getEl('lightbox-close');
        if (lightboxClose) {
            lightboxClose.addEventListener('click', closeLightbox);
            getEl('lightbox').addEventListener('click', (e) => { // Lightbox dışına tıklayınca kapat
                if (e.target === getEl('lightbox')) closeLightbox();
            });
        }
    }

    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const microBtn = getEl('microBtn');

        if (!SpeechRecognition) { 
            console.warn("Tarayıcı, Ses Tanıma API'sini desteklemiyor."); 
            microBtn.style.display = 'none'; 
            return; 
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = false; // Sadece kesin sonuçları al
        recognition.maxAlternatives = 1; // En iyi tahmini al

        microBtn.addEventListener('click', () => { 
            try { 
                recognition.start(); 
                microBtn.innerHTML = '🔴'; // Kayıt simgesi
                microBtn.style.color = settings.theme === 'dark' ? 'red' : 'red'; // Koyu temada kırmızı, açıkta da kırmızı
            } catch (e) { 
                console.error("Ses tanıma başlatılırken hata:", e);
                microBtn.innerHTML = '🎤';
                microBtn.style.color = 'var(--muted)';
            } 
        });

        recognition.onresult = (e) => { 
            const transcript = e.results[0][0].transcript;
            mainQueryInput.value = transcript; 
            startNewSearch(); 
        };

        recognition.onend = () => { 
            microBtn.innerHTML = '🎤'; // Mikrofon simgesi
            microBtn.style.color = 'var(--muted)';
        };

        recognition.onerror = (e) => { 
            console.error("Ses tanıma hatası:", e.error); 
            microBtn.innerHTML = '🎤';
            microBtn.style.color = 'var(--muted)';
        };
    }

    // Uygulama başlangıcı
    function init() {
        const loader = getEl('loader');
        if (loader) {
            // Animasyon süresi (typing animasyonu 1.5s + 2.5s gecikme = 4s)
            // Toplamda biraz daha uzun tutalım ki animasyon rahatça görülsün
            setTimeout(() => {
                loader.style.transition = 'opacity 0.7s ease';
                loader.style.opacity = 0;
                setTimeout(() => loader.remove(), 700); // Loader'ı kaldır
            }, 5000); // 5 saniye sonra loader kaybolmaya başlar
        }
        
        // Tema ve ayarları yükle
        applyTheme(localStorage.getItem('theme') || 'dark');
        getEl('safeSearchToggle').checked = settings.safeSearch;
        
        setupEventListeners();
        setupSpeechRecognition();

        // URL'den arama sorgusu varsa otomatik arama yap
        const params = new URLSearchParams(window.location.search);
        const urlQ = params.get('q');
        const urlType = params.get('type');
        
        if (urlQ) {
            mainQueryInput.value = urlQ;
            currentQuery = urlQ.trim();
            if (urlType) {
                currentSearchType = urlType;
                // İlgili sekme butonunu aktif yap
                const activeTab = queryEl(`.tab-btn[data-type="${urlType}"]`);
                if (activeTab) {
                    queryEl('.tab-btn.active').classList.remove('active');
                    activeTab.classList.add('active');
                }
            } else {
                currentSearchType = 'web'; // Varsayılan
            }
            // Animasyon süresini bekledikten sonra aramayı başlat
            setTimeout(() => doSearch(true), 5000); // Animasyon bitimine yakın başlat
        }
    }

    init();
});