from . import (
    brackets,
    external,
    matches,
    settings,
    tournaments,
)

routers = [
    external.router,
    settings.router,
    tournaments.router,
    brackets.router,
    matches.router,
]
