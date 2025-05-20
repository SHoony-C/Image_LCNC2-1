from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "lcnc"

# Sync client for synchronous operations
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client[DB_NAME]

# Async client for asynchronous operations
async_mongo_client = AsyncIOMotorClient(MONGO_URI)
async_mongo_db = async_mongo_client[DB_NAME]

# Collections
lcnc_results = mongo_db["lcnc_result"]
async_lcnc_results = async_mongo_db["lcnc_result"] 