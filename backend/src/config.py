import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
ENV_FILE = os.path.join(BASE_DIR, "../.env")

load_dotenv(ENV_FILE)

POSTGRES_USER = os.getenv("POSTGRES_USER", "user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "champ")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
SQLALCHEMY_DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("+asyncpg", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
EXTERNAL_API_URL = os.getenv("EXTERNAL_API_URL", "http://localhost:8000")
EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN", "")
DEV_MODE = os.getenv("DEV_MODE", False)
EDGE_ID = os.getenv("EDGE_ID", "tatami-node-01")
