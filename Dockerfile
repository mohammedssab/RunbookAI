FROM python:3.11-slim

WORKDIR /app

# Install standard dependencies
RUN pip install --no-cache-dir fastapi uvicorn requests pydantic

# Copy files
COPY . /app

EXPOSE 8000

# Start server with auto-reload for development
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
