import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000/api/v1/extraction/extract"


def post(body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE_URL, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


# Test 1: empty documentId (422 validation)
code, body = post({"documentId": "", "filePath": "test.pdf"})
print(f"Test 1 (empty docId): {code} {body.get('message')}")

# Test 2: unsupported extension (400)
code, body = post({"documentId": "test-123", "filePath": "e:/AI CRM/test.xyz"})
print(f"Test 2 (unsupported ext): {code} {body.get('message')}")

# Test 3: file not found (500 extraction failure)
code, body = post({"documentId": "test-123", "filePath": "e:/AI CRM/nonexistent.pdf"})
print(f"Test 3 (file not found): {code} {body.get('message')}")

# Test 4: successful extraction (200)
code, body = post({"documentId": "test-456", "filePath": "e:/AI CRM/upload-test.pdf"})
data = body.get("data", {})
print(f"Test 4 (success): {code} success={body.get('success')} type={data.get('fileType')} pages={data.get('pages')} chars={data.get('characters')}")