import urllib.request
import json
import ssl

url = "https://vmpay.vertitecnologia.com.br/api/v1/cashless_facts?access_token=HHPFt0X4OLf17xKZmhHBFER58lTIpQvauYPbjL63&start_date=2026-04-17&end_date=2026-04-17&per_page=5&page=1"
try:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, context=ctx) as response:
        print("Status Code:", response.getcode())
        data = response.read()
        print(data[:100])
except Exception as e:
    print("Error:", e)
