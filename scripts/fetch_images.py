import json
import os
import random
import re
import time
import urllib.parse
import urllib.request

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IMAGES_DIR = os.path.join(BASE_DIR, 'images')
DATA_DIR = os.path.join(BASE_DIR, 'data')

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

UA = 'tinyping-game/1.0 (local)'

HANGUL_PATTERN = r'[\uAC00-\uD7A3]'
PING_PATTERN = r'[\uAC00-\uD7A3]{2,6}\uD551'


def api_json(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': UA, 'Accept-Language': 'ko,en;q=0.8'},
    )
    with urllib.request.urlopen(req) as f:
        return json.load(f)


def http_get(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': UA, 'Accept-Language': 'ko,en;q=0.8'},
    )
    with urllib.request.urlopen(req) as f:
        return f.read().decode('utf-8', errors='ignore')


def fetch_wikitext(base, page):
    url = (
        f'{base}/api.php?action=parse&page='
        f'{urllib.parse.quote(page)}&prop=wikitext&format=json'
    )
    data = api_json(url)
    return data.get('parse', {}).get('wikitext', {}).get('*', '')


def fetch_season_name_map():
    base = 'https://catchteenieping.fandom.com'
    search_url = (
        f'{base}/api.php?action=query&list=search&srsearch='
        f'{urllib.parse.quote("List of Teeniepings/Season")}'
        f'&srlimit=50&format=json'
    )
    data = api_json(search_url)
    titles = [s['title'] for s in data.get('query', {}).get('search', [])]
    season_pages = []
    for title in titles:
        match = re.search(r'Season\\s*(\\d+)', title)
        if match:
            season_pages.append((title, int(match.group(1))))

    season_map = {}
    for title, season in season_pages:
        text = fetch_wikitext(base, title)
        links = re.findall(r'\[\[([^\]|#]+)', text)
        for link in links:
            name = link.split('|', 1)[0].split('#', 1)[0].strip()
            if not name:
                continue
            lower = name.lower()
            if not lower.endswith('ping'):
                continue
            if lower in {'teeneeping', 'teenieping'}:
                continue
            season_map[name] = season
    return season_map


def fetch_fallback_names():
    url = (
        'https://catchteenieping.fandom.com/api.php'
        '?action=query&list=categorymembers&cmtitle=Category:Teeniepings'
        '&cmlimit=500&format=json'
    )
    data = api_json(url)
    members = data.get('query', {}).get('categorymembers', [])
    names = []
    seen = set()
    for m in members:
        title = m.get('title', '').strip()
        if not title:
            continue
        if title.lower().startswith('list of'):
            continue
        if title not in seen:
            seen.add(title)
            names.append(title)
    return names


def find_korean_title(name_en):
    url = (
        'https://catchteenieping.fandom.com/ko/api.php'
        f'?action=query&list=search&srsearch={urllib.parse.quote(name_en)}'
        '&srlimit=5&format=json'
    )
    data = api_json(url)
    for item in data.get('query', {}).get('search', []):
        title = item.get('title', '').strip()
        if not title:
            continue
        if re.search(HANGUL_PATTERN, title) and title.endswith('\uD551'):
            return title
    return None


def extract_korean_from_english(name_en):
    text = fetch_wikitext('https://catchteenieping.fandom.com', name_en)
    matches = re.findall(PING_PATTERN, text)
    if matches:
        return matches[0]
    return None


def google_image_urls(query, limit=5):
    q = urllib.parse.quote(query)
    url = f'https://www.google.com/search?tbm=isch&q={q}&hl=ko'
    html = http_get(url)
    urls = re.findall(r'(https://encrypted-tbn0\.gstatic\.com/images\?[^"\\]+)', html)
    if not urls:
        urls = re.findall(r'(https?://[^\s"\']+\.(?:jpg|jpeg|png))', html)
    urls = [u.replace('&amp;', '&') for u in urls]
    out = []
    seen = set()
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= limit:
            break
    return out


def download(url, path):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': UA, 'Referer': 'https://www.google.com/'},
    )
    with urllib.request.urlopen(req) as f:
        data = f.read()
    with open(path, 'wb') as wf:
        wf.write(data)


def safe_filename(text):
    cleaned = re.sub(r'[^0-9A-Za-z_-]+', '', text)
    return cleaned or 'tinyping'


def main():
    season_map = fetch_season_name_map()
    names = list(season_map.keys())
    if not names:
        names = fetch_fallback_names()
    if not names:
        print('No names found from fandom.')
        return
    random.shuffle(names)
    names = names[:50]

    mapping = []
    target = 100
    per_name = max(2, target // max(1, len(names)) + 1)

    ko_cache = {}
    for name in names:
        if len(mapping) >= target:
            break
        name_ko = ko_cache.get(name)
        if not name_ko:
            name_ko = find_korean_title(name)
            ko_cache[name] = name_ko

        display_name = name_ko or name
        urls = google_image_urls(f'{display_name} \\uD2F0\\uB2C8\\uD551', limit=per_name)
        time.sleep(0.2)
        for u in urls:
            if len(mapping) >= target:
                break
            filename = f'{safe_filename(name)}_{len(mapping) + 1}.jpg'
            filepath = os.path.join(IMAGES_DIR, filename)
            try:
                download(u, filepath)
            except Exception:
                continue
            mapping.append(
                {
                    'name': display_name,
                    'name_ko': name_ko,
                    'name_en': name,
                    'season': season_map.get(name),
                    'file': f'images/{filename}',
                    'source': 'google',
                }
            )

    with open(os.path.join(DATA_DIR, 'mapping.json'), 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    unique_names = {m['name'] for m in mapping}
    print(f'Downloaded {len(mapping)} images for {len(unique_names)} names.')


if __name__ == '__main__':
    main()
