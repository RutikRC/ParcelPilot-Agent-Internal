import logging
from logging import StreamHandler, basicConfig, getLogger

LOG_FORMAT = "%(asctime)s - %(levelname)s - %(filename)s:%(funcName)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logger = getLogger("ai_service")


def configure_logger(level: str | int = "INFO") -> None:
    if logger.handlers:
        return

    basicConfig(
        level=level,
        format=LOG_FORMAT,
        datefmt=DATE_FORMAT,
        handlers=[StreamHandler()],
    )
    logger.setLevel(level)
