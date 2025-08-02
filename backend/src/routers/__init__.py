from . import (
    external,
    settings,
    tournaments,
    brackets,
    matches,
    match_state,
)

routers = [
    external.router,
    settings.router,
    tournaments.router,
    brackets.router,
    matches.router,
    match_state.router,
]
