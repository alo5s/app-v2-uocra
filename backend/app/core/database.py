from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine_args = {}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_args = {"connect_args": {"check_same_thread": False}}
elif settings.DATABASE_URL.startswith("postgresql"):
    engine_args = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,
        "pool_recycle": 3600
    }

engine = create_engine(settings.DATABASE_URL, **engine_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    import os
    from alembic.config import Config
    from alembic import command
    import sqlalchemy

    alembic_ini = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "alembic.ini")
    alembic_cfg = Config(alembic_ini)

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    has_alembic = "alembic_version" in tables

    if not has_alembic and len(tables) > 0:
        command.stamp(alembic_cfg, "head")
        print(f"Database already has {len(tables)} tables. Stamped as up-to-date.")
        return

    try:
        command.upgrade(alembic_cfg, "head")
        print("Database migrations up to date.")
    except sqlalchemy.exc.OperationalError as e:
        if "already exists" in str(e):
            command.stamp(alembic_cfg, "head")
            print(f"Tables already exist. Stamped as up-to-date.")
        else:
            raise
