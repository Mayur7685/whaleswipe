# Shared event queue for SSE rug rejection alerts.
# Kept in its own module to avoid circular imports between main.py and routers/.

rug_event_queues: dict[int, list[dict]] = {}

def push_rug_event(user_id: int, event: dict) -> None:
    rug_event_queues.setdefault(user_id, []).append(event)
