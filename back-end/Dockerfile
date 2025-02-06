# Use a specific Python version for stability
FROM python:latest

# Set the working directory
WORKDIR /app

# Copy dependencies first to optimize build cache
COPY requirements.txt .

# Install dependencies efficiently
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV FLASK_APP=run.py
ENV FLASK_ENV=production

# Expose Flask port
EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
