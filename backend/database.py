from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import os
from dotenv import load_dotenv
from models import Base

load_dotenv()

DATABASE_URL = os.getenv("SUPABASE_URL")
if not DATABASE_URL or not DATABASE_URL.startswith("postgresql://"):
    raise ValueError("Invalid SUPABASE_URL: Must start with postgresql://. Check your .env file.")

# Sync engine for migrations/setup
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=15,
    echo=True
)
print(f"[DB] Connected to: {DATABASE_URL.split('@')[-1]}")  # Mask credentials

# Async engine for FastAPI
async_engine = create_async_engine(
    DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def create_tables():
    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Tables created successfully.")
    except Exception as e:
        print(f"[DB] Error creating tables: {e}")
