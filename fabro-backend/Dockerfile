# Fabro backend for Cloud Run
# Downloads the pre-built Linux binary from GitHub releases
FROM debian:bookworm-slim

ARG FABRO_VERSION=v0.176.2
ARG FABRO_BINARY_URL=https://github.com/fabro-sh/fabro/releases/download/${FABRO_VERSION}/fabro-x86_64-unknown-linux-gnu.tar.gz

# Install minimal deps (Fabro is statically linked but may need libc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and extract Fabro
# Tarball extracts to fabro-x86_64-unknown-linux-gnu/fabro
WORKDIR /opt/fabro
RUN curl -fsSL "${FABRO_BINARY_URL}" -o fabro.tar.gz \
    && tar -xzf fabro.tar.gz \
    && cp fabro-x86_64-unknown-linux-gnu/fabro /usr/local/bin/ \
    && chmod +x /usr/local/bin/fabro \
    && rm -rf /opt/fabro

# Create data directory for SQLite and run state
RUN mkdir -p /var/fabro/data

# Fabro serve defaults to port 3000
EXPOSE 3000

# Run Fabro in server mode
# Bind to 0.0.0.0 for Cloud Run
ENV FABRO_HOST=0.0.0.0
ENV FABRO_PORT=3000

CMD ["fabro", "serve", "--host", "0.0.0.0", "--port", "3000"]
