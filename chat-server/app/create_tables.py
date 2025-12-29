# create_tables.py
from app.db import engine
from app.models import Base  # noqa: F401 (import side-effect)

def main():
    Base.metadata.create_all(bind=engine)
    print("✅ tables created")

if __name__ == "__main__":
    main()