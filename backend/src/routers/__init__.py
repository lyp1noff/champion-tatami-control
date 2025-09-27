from . import brackets, external, matches, outbox, settings, tournaments

routers = [
    external.router,
    settings.router,
    tournaments.router,
    brackets.router,
    matches.router,
    outbox.router,
]
