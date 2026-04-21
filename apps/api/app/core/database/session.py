from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config.settings import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    settings = get_settings()
    return create_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )


def get_session() -> Session:
    return get_session_factory()()
