import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
ENV_FILE = os.path.join(BASE_DIR, "../.env")

load_dotenv(ENV_FILE)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/champ_local")
DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("+asyncpg", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
EXTERNAL_API_URL = os.getenv("EXTERNAL_API_URL", "http://localhost:8000")
EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN", "")
DEV_MODE = os.getenv("DEV_MODE", False)
