from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

# Google Custom Search API Anahtarınız ve Arama Motoru Kimliğiniz
# Lütfen KENDİ anahtar ve kimliğinizle değiştirin!
# https://developers.google.com/custom-search/v1/overview adresinden alabilirsiniz.
API_KEY = os.getenv("AIzaSyBViI5Hg11_OnBy2vG3qvMecweJYKkcbIg", "AIzaSyBViI5Hg11_OnBy2vG3qvMecweJYKkcbIg") 
CX_ID = os.getenv("f61209cd30d184ef3", "f61209cd30d184ef3")

# Eğer API anahtar ve CX_ID ayarlanmamışsa uyarı ver
if API_KEY == "AIzaSyBViI5Hg11_OnBy2vG3qvMecweJYKkcbIg" or CX_ID == "f61209cd30d184ef3":
    print("UYARI: Google Custom Search API Anahtarı veya Arama Motoru Kimliği ayarlanmadı!")
    print("Lütfen GOOGLE_API_KEY ve GOOGLE_CX_ID ortam değişkenlerini ayarlayın veya app2.py dosyasında ilgili yerleri kendi anahtarlarınızla değiştirin.")
    print("Görsel arama dahil tüm arama fonksiyonları çalışmayabilir.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search')
def search():
    query = request.args.get('q')
    start = request.args.get('start', 1)
    search_type = request.args.get('type', 'web') # 'web' veya 'image'
    safe_search = request.args.get('safe', 'off') # 'active' veya 'off'

    if not query:
        return jsonify({"error": "Arama sorgusu boş olamaz."}), 400

    search_url = "https://www.googleapis.com/customsearch/v1"
    
    params = {
        "key": API_KEY,
        "cx": CX_ID,
        "q": query,
        "start": start,
        "safe": safe_search # Güvenli arama parametresi eklendi
    }

    if search_type == 'image':
        params['searchType'] = 'image'
    
    try:
        response = requests.get(search_url, params=params)
        response.raise_for_status() # HTTP hatalarını yakala
        data = response.json()

        results = []
        if 'items' in data:
            for item in data['items']:
                result = {
                    "title": item.get('title'),
                    "url": item.get('link'),
                    "displayLink": item.get('displayLink'),
                    "content": item.get('snippet'),
                }
                if search_type == 'image' and 'pagemap' in item and 'cse_image' in item['pagemap']:
                    result['thumbnail'] = item['pagemap']['cse_image'][0]['src']
                results.append(result)
        
        return jsonify({
            "items": results,
            "totalResults": data.get('searchInformation', {}).get('totalResults'),
            "spelling": data.get('spelling', {}).get('correctedQuery'),
        })

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Google Search API'ye bağlanırken hata oluştu: {e}")
        return jsonify({"error": "Arama servisine bağlanırken bir hata oluştu."}), 500
    except Exception as e:
        app.logger.error(f"Beklenmedik bir hata oluştu: {e}")
        return jsonify({"error": "Beklenmedik bir hata oluştu."}), 500


@app.route('/api/suggest')
def suggest():
    query = request.args.get('q')
    if not query:
        return jsonify({"s": []})

    # Google Suggest API URL'si
    suggest_url = f"https://suggestqueries.google.com/complete/search?client=firefox&q={query}"

    try:
        response = requests.get(suggest_url)
        response.raise_for_status()
        data = response.json()
        
        # Google Suggest API yanıtı genellikle [sorgu, [öneriler], ...] formatındadır
        suggestions = data[1] if len(data) > 1 else []
        return jsonify({"s": suggestions})
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Google Suggest API'ye bağlanırken hata oluştu: {e}")
        return jsonify({"s": []})
    except Exception as e:
        app.logger.error(f"Beklenmedik bir hata oluştu: {e}")
        return jsonify({"s": []})


if __name__ == '__main__':
    # Geliştirme ortamında debug modunu açabiliriz
    # app.run(debug=True)
    # Ancak canlıda debug=False olmalı
    app.run(debug=True, host='0.0.0.0', port=5000)