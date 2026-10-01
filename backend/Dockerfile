FROM python:3.13-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY requirements.txt ./
COPY requirements-dev.txt ./
RUN python -m pip wheel --wheel-dir /wheels -r requirements.txt -r requirements-dev.txt

FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN python -m venv /opt/venv \
    && addgroup --system app \
    && adduser --system --ingroup app --home /app app

COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt /requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /requirements.txt \
    && rm -rf /wheels

WORKDIR /app
COPY --chown=app:app app ./app
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app alembic.ini ./alembic.ini
COPY --chown=app:app requirements.txt ./requirements.txt
COPY --chown=app:app docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 0555 ./docker-entrypoint.sh

USER app
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["api"]

FROM runtime AS test
USER root
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements-dev.txt /requirements-dev.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /requirements-dev.txt \
    && rm -rf /wheels
COPY --chown=app:app tests ./tests
USER app
ENTRYPOINT []
CMD ["python", "-m", "pytest", "-q"]
