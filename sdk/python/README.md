# PintDown Discovery SDK (Python)

```bash
pip install -e sdk/python
```

```python
from pintdown_discovery import PintDownClient

client = PintDownClient(base_url="http://localhost:8000", api_token="pda_...")
page = client.backlinks.list(page=1, page_size=25)
print(page["items"])
```
