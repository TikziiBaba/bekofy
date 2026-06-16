import re
from collections import Counter

with open('src/pages/app.html', 'r', encoding='utf-8') as f:
    text = f.read()
ids = re.findall(r'id=["\']([^"\']+)["\']', text)
c = Counter(ids)
dupes = [k for k,v in c.items() if v > 1]
print("Duplicate IDs:", dupes)

# Also check for empty src
empty_src = text.count('src=""')
print("Empty src count:", empty_src)
