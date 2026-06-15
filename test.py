
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://vmpay.vertitecnologia.com.br/api/v1/cashless_facts?access_token=HHPFt0X4OLf17xKZmhHBFER58lTIpQvauYPbjL63&start_date=2026-06-14T00:00:00Z&end_date=2026-06-15T23:59:59Z&per_page=5&page=1'
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        print(response.getcode())
except Exception as e:
    print(e)

