from datetime import datetime, timezone


def parse_datetime_utc(val: str | None) -> datetime | None:
    if not val:
        return None
    dt = datetime.fromisoformat(val)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
