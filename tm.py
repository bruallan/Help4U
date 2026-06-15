
import urllib.request
import urllib.parse
import ssl
from datetime import datetime, timedelta, timezone

BASE_URL = 'https://vmpay.vertitecnologia.com.br'
TOKEN = 'mfSwgwqzyJVdhNiPf3fDYOWSoYpdi5pOLN7fiinS'

agora = datetime.now(timezone.utc)
sete_dias_atras = agora - timedelta(days=7)

start_date_iso = sete_dias_atras.strftime('%Y-%m-%dT%H:%M:%SZ')
end_date_iso = agora.strftime('%Y-%m-%dT%H:%M:%SZ')

params = {
    'access_token': TOKEN,
    'start_date': start_date_iso,
    'end_date': end_date_iso,
    'page': 1,
    'per_page': 5
}
qs = urllib.parse.urlencode(params)
url = f'{BASE_URL}/api/v1/cashless_facts?{qs}'

req = urllib.request.Request(url)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    with urllib.request.urlopen(req, context=ctx) as r:
        print('py urllib mfSw', r.getcode())
except Exception as e:
    print('py urllib mfSw', e)

