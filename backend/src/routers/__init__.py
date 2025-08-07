from . import (
    brackets,
    external,
    match_state,
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
    match_state.router,
]
