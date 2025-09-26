import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

logging.getLogger("uvicorn.access").handlers = []
logging.getLogger("uvicorn.access").propagate = False

logging.getLogger("uvicorn.error").setLevel(logging.ERROR)

logger = logging.getLogger("champion_tatami")
