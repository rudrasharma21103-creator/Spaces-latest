from dotenv import load_dotenv
import os, json
from pymongo import MongoClient

load_dotenv('../.env')
uri = os.getenv('MONGO_URI')
print('MONGO_URI set:', bool(uri))
if not uri:
    print('No MONGO_URI in .env; exiting')
    raise SystemExit(1)

try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
except Exception as e:
    print('Mongo connect error:', str(e))
    raise SystemExit(1)

db = client['spacesdb']
print('Recent files:')
for d in db.files.find().sort('createdAt', -1).limit(10):
    d['_id'] = str(d.get('_id'))
    print(json.dumps(d, default=str))
